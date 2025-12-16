import json
import logging
import os
import time
import traceback
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import stripe
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from auth import get_current_user
from email_service import (
    send_order_confirmation_email,
    send_shipping_notification_email,
)
from models import (
    ApplyCouponRequest,
    CreateCheckoutSessionRequest,
    CreateCouponRequest,
    CreateEventRequest,
    CreateOnlineOrderRequest,
    CreatePaymentIntentRequest,
    CreatePaymentRequestRequest,
    CreateSaleRequest,
    CreateShippingOptionRequest,
    SaleStatus,
    StripeTerminalConfigRequest,
    TerminalConnectionTokenRequest,
    TerminalLocationRequest,
    TerminalPairingRegisterRequest,
    TerminalPairingVerifyRequest,
    TerminalPaymentIntentRequest,
    TerminalRefundRequest,
    TerminalRegisterReaderRequest,
    UpdateConfigRequest,
    UpdatePaymentRequestResultRequest,
    UpdateShippingOptionRequest,
    UpdateShippingRequest,
)
from services import (
    calculate_commission_fees,
    calculate_coupon_discount,
    cancel_payment_request,
    cancel_terminal_payment_intent,
    capture_terminal_payment_intent,
    config_table,
    create_online_order,
    create_payment_request,
    create_shipping_option,
    create_terminal_connection_token,
    create_terminal_location,
    create_terminal_payment_intent,
    create_terminal_refund,
    deduct_stock,
    delete_shipping_option,
    delete_terminal_pairing,
    delete_terminal_reader,
    dynamo_to_dict,
    events_table,
    get_all_shipping_options,
    get_card_brand_from_payment_intent,
    get_config,
    get_coupon_by_code,
    get_order_by_id,
    get_orders_by_email,
    get_payment_intent_for_refund,
    get_payment_request,
    get_pending_payment_request,
    get_products_info,
    get_terminal_pairing_status,
    get_shipping_option_by_id,
    increment_coupon_usage,
    init_stripe,
    list_terminal_locations,
    list_terminal_readers,
    register_terminal_pairing,
    register_terminal_reader,
    restore_stock,
    sales_table,
    set_config,
    set_stripe_terminal_config,
    update_order_payment_intent,
    update_order_status_with_stripe,
    update_payment_request_result,
    update_shipping_info,
    update_shipping_option,
    update_stripe_payment_status,
    validate_and_reserve_stock,
    validate_coupon,
    verify_terminal_pairing,
)

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# FastAPI アプリ
app = FastAPI(
    title="Sales API",
    description="販売・決済処理API（Stripe統合）",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# グローバル例外ハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    すべての予期しない例外をキャッチして適切に処理する
    これにより1つのエンドポイントの500エラーが他のエンドポイントに影響しない
    """
    logger.error(f"Unhandled exception: {exc}")
    logger.error(f"Request path: {request.url.path}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )


# ルーター
router = APIRouter()


# 販売エンドポイント
@router.get("/sales", response_model=dict)
async def list_sales(
    event_id: str | None = Query(default=None, description="イベントIDでフィルタ"),
    user_id: str | None = Query(default=None, description="ユーザーIDでフィルタ"),
    limit: int = Query(default=50, ge=1, le=1000, description="取得件数"),
    current_user: dict = Depends(get_current_user),
):
    """販売履歴一覧取得"""
    try:
        if event_id:
            response = sales_table.query(
                IndexName="EventIndex",
                KeyConditionExpression="event_id = :eid",
                ExpressionAttributeValues={":eid": event_id},
                ScanIndexForward=False,
                Limit=limit,
            )
        elif user_id:
            response = sales_table.query(
                IndexName="UserIndex",
                KeyConditionExpression="user_id = :uid",
                ExpressionAttributeValues={":uid": user_id},
                ScanIndexForward=False,
                Limit=limit,
            )
        else:
            response = sales_table.scan(Limit=limit)

        # クーポンデータを除外
        sales = [
            dynamo_to_dict(item)
            for item in response.get("Items", [])
            if not item.get("sale_id", "").startswith("coupon_")
        ]
        return {"sales": sales}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sales/{sale_id}", response_model=dict)
async def get_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    """販売詳細取得"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid",
            ExpressionAttributeValues={":sid": sale_id},
        )
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Sale not found")
        return {"sale": dynamo_to_dict(items[0])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sales", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_sale(
    request: CreateSaleRequest, current_user: dict = Depends(get_current_user)
):
    """販売を作成"""
    try:
        # 在庫確認・確保
        reserved_items = validate_and_reserve_stock(request.cart_items)

        # 商品情報を取得（クーポンと手数料計算のため）
        products_info = get_products_info(request.cart_items)

        # 小計計算
        subtotal = sum(item["subtotal"] for item in reserved_items)

        # クーポン適用
        discount = Decimal("0.0")
        if request.coupon_code:
            coupon = get_coupon_by_code(request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="Invalid coupon code")

            validate_coupon(coupon)
            discount = Decimal(
                str(
                    calculate_coupon_discount(coupon, request.cart_items, products_info)
                )
            )
            increment_coupon_usage(coupon)

        total = subtotal - discount

        # 手数料情報を計算（委託販売レポート用）
        commission_info = calculate_commission_fees(
            reserved_items, products_info, request.payment_method.value
        )

        sale_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)
        now = datetime.now(timezone.utc).isoformat()

        sale_item = {
            "sale_id": sale_id,
            "timestamp": timestamp,
            "event_id": request.event_id,
            "user_id": request.user_id,
            "items": reserved_items,
            "subtotal": Decimal(str(subtotal)),
            "discount": Decimal(str(discount)),
            "total": Decimal(str(total)),
            "payment_method": request.payment_method.value,
            "status": SaleStatus.PENDING.value,
            "coupon_code": request.coupon_code or "",
            "customer_email": request.customer_email or "",
            "stripe_payment_intent_id": "",
            "created_at": now,
            # 委託販売手数料情報（販売時点のレートを記録）
            "commission_details": commission_info["items"],
            "total_commission": Decimal(str(commission_info["total_commission"])),
            "total_payment_fee": Decimal(str(commission_info["total_payment_fee"])),
            "total_net_amount": Decimal(str(commission_info["total_net_amount"])),
        }

        sales_table.put_item(Item=sale_item)

        # 在庫を減らす
        deduct_stock(reserved_items, sale_id, request.user_id)

        return {"sale": dynamo_to_dict(sale_item)}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sales/{sale_id}/complete", response_model=dict)
async def complete_sale(
    sale_id: str,
    stripe_payment_intent_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """販売を完了にする"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid",
            ExpressionAttributeValues={":sid": sale_id},
        )
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Sale not found")

        sale = items[0]
        timestamp = sale["timestamp"]

        update_expression = "SET #st = :status"
        expression_values = {":status": SaleStatus.COMPLETED.value}
        expression_names = {"#st": "status"}

        if stripe_payment_intent_id:
            update_expression += ", stripe_payment_intent_id = :pi"
            expression_values[":pi"] = stripe_payment_intent_id

        response = sales_table.update_item(
            Key={"sale_id": sale_id, "timestamp": timestamp},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW",
        )

        return {"sale": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sales/{sale_id}/cancel", response_model=dict)
async def cancel_sale(sale_id: str, current_user: dict = Depends(get_current_user)):
    """販売をキャンセル（在庫を戻す）"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid",
            ExpressionAttributeValues={":sid": sale_id},
        )
        items = response.get("Items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Sale not found")

        sale = items[0]
        timestamp = sale["timestamp"]

        if sale.get("status") == SaleStatus.CANCELLED.value:
            raise HTTPException(status_code=400, detail="Sale already cancelled")

        # 在庫を戻す
        restore_stock(sale)

        # ステータスを更新
        response = sales_table.update_item(
            Key={"sale_id": sale_id, "timestamp": timestamp},
            UpdateExpression="SET #st = :status",
            ExpressionAttributeNames={"#st": "status"},
            ExpressionAttributeValues={":status": SaleStatus.CANCELLED.value},
            ReturnValues="ALL_NEW",
        )

        return {"sale": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Stripe関連エンドポイント
@router.post("/stripe/payment-intent", response_model=dict)
async def create_payment_intent(
    request: CreatePaymentIntentRequest, current_user: dict = Depends(get_current_user)
):
    """Stripe Payment Intent を作成"""
    init_stripe()
    try:
        intent = stripe.PaymentIntent.create(
            amount=request.amount,
            currency=request.currency,
            receipt_email=request.customer_email,
            metadata=request.metadata or {},
        )
        return {
            "payment_intent": {
                "id": intent.id,
                "client_secret": intent.client_secret,
                "amount": intent.amount,
                "currency": intent.currency,
                "status": intent.status,
            }
        }
    except stripe._error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/stripe/payment-intent/{payment_intent_id}", response_model=dict)
async def get_payment_intent(
    payment_intent_id: str, current_user: dict = Depends(get_current_user)
):
    """Stripe Payment Intent の状態を取得"""
    init_stripe()
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {
            "payment_intent": {
                "id": intent.id,
                "amount": intent.amount,
                "currency": intent.currency,
                "status": intent.status,
                "receipt_email": intent.receipt_email,
            }
        }
    except stripe._error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# クーポン管理
@router.post("/coupons", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    request: CreateCouponRequest, current_user: dict = Depends(get_current_user)
):
    """クーポンを作成"""
    try:
        existing = get_coupon_by_code(request.code)
        if existing:
            raise HTTPException(status_code=409, detail="Coupon code already exists")

        coupon_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)
        now = datetime.now(timezone.utc).isoformat()

        coupon_item = {
            "sale_id": f"coupon_{request.code}",
            "timestamp": timestamp,
            "coupon_id": coupon_id,
            "code": request.code,
            "discount_type": request.discount_type,
            "discount_value": Decimal(str(request.discount_value)),
            "max_uses": request.max_uses,
            "current_uses": 0,
            "valid_until": request.valid_until or "",
            "filter": request.filter.model_dump() if request.filter else {},
            "is_active": True,
            "created_at": now,
        }

        sales_table.put_item(Item=coupon_item)

        return {"coupon": dynamo_to_dict(coupon_item)}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/coupons/{code}", response_model=dict)
async def get_coupon(code: str, current_user: dict = Depends(get_current_user)):
    """クーポン情報を取得"""
    try:
        coupon = get_coupon_by_code(code)
        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")
        return {"coupon": dynamo_to_dict(coupon)}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/coupons/apply", response_model=dict)
async def apply_coupon(
    request: ApplyCouponRequest, current_user: dict = Depends(get_current_user)
):
    """クーポンを適用して割引額を計算"""
    try:
        coupon = get_coupon_by_code(request.code)
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

        validate_coupon(coupon)
        products_info = get_products_info(request.cart_items)
        discount = calculate_coupon_discount(coupon, request.cart_items, products_info)
        subtotal = sum(item.unit_price * item.quantity for item in request.cart_items)

        return {
            "subtotal": subtotal,
            "discount": discount,
            "total": subtotal - discount,
        }
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/coupons/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_coupon(code: str, current_user: dict = Depends(get_current_user)):
    """クーポンを無効化"""
    try:
        coupon = get_coupon_by_code(code)
        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")

        sales_table.update_item(
            Key={"sale_id": f"coupon_{code}", "timestamp": coupon["timestamp"]},
            UpdateExpression="SET is_active = :inactive",
            ExpressionAttributeValues={":inactive": False},
        )
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# イベント管理
@router.get("/events", response_model=dict)
async def list_events(current_user: dict = Depends(get_current_user)):
    """イベント一覧取得"""
    try:
        response = events_table.scan()
        events = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"events": events}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/events", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_event(
    request: CreateEventRequest, current_user: dict = Depends(get_current_user)
):
    """イベントを作成"""
    try:
        event_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        event_item = {
            "event_id": event_id,
            "name": request.name,
            "start_date": request.start_date,
            "end_date": request.end_date,
            "created_at": now,
        }

        events_table.put_item(Item=event_item)

        return {"event": event_item}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# オンライン販売エンドポイント（認証不要）
@router.post("/orders", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_order(request: CreateOnlineOrderRequest):
    """オンライン注文を作成（顧客向け、認証不要）"""
    try:
        order = create_online_order(
            cart_items=[item.model_dump() for item in request.cart_items],
            customer_email=request.customer_email,
            customer_name=request.customer_name,
            shipping_address=(
                request.shipping_address.model_dump()
                if request.shipping_address
                else None
            ),
            saved_address_id=request.saved_address_id,
            user_id=request.user_id,
            coupon_code=request.coupon_code,
            notes=request.notes,
        )
        return {"order": order}
    except HTTPException:
        raise
    except ClientError as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"DynamoDB error: {str(e)}") from e
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Internal server error: {str(e)}"
        ) from e


@router.get("/orders/{order_id}", response_model=dict)
async def get_order(order_id: str):
    """注文詳細を取得（認証不要、メール確認推奨）"""
    try:
        order = get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return {"order": order}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/orders", response_model=dict)
async def list_orders_by_email(
    customer_email: str = Query(..., description="顧客メールアドレス"),
    limit: int = Query(default=50, ge=1, le=100),
):
    """顧客メールアドレスで注文一覧を取得（認証不要）"""
    try:
        orders = get_orders_by_email(customer_email, limit)
        return {"orders": orders}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/orders/{order_id}/shipping", response_model=dict)
async def update_order_shipping(
    order_id: str,
    request: UpdateShippingRequest,
    current_user: dict = Depends(get_current_user),
):
    """注文の発送情報を更新（管理者のみ）"""
    try:
        order = get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        updated_order = update_shipping_info(
            order_id=order_id,
            tracking_number=request.tracking_number,
            carrier=request.carrier,
            shipping_method=request.shipping_method,
            shipping_method_other=request.shipping_method_other,
            notes=request.notes,
        )

        if not updated_order:
            raise HTTPException(
                status_code=500, detail="Failed to update shipping info"
            )

        # 発送通知メールを送信
        try:
            send_shipping_notification_email(updated_order, request.tracking_number)
        except Exception as email_error:
            # メール送信失敗してもエラーにはしない
            logger.error(f"Failed to send shipping notification email: {email_error}")

        return {"order": updated_order}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/orders/{order_id}/payment-status", response_model=dict)
async def get_order_payment_status(order_id: str):
    """注文のPaymentIntentステータスを確認"""
    init_stripe()
    try:
        order = get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        payment_intent_id = order.get("stripe_payment_intent_id")
        if not payment_intent_id:
            return {
                "order_id": order_id,
                "payment_status": "no_payment_intent",
                "order_status": order.get("status"),
            }

        try:
            intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            intent_status = (
                intent.get("status") if isinstance(intent, dict) else intent.status
            )

            return {
                "order_id": order_id,
                "payment_status": intent_status,
                "order_status": order.get("status"),
            }
        except stripe._error.StripeError as e:
            logger.error(f"Failed to retrieve PaymentIntent: {e}")
            return {
                "order_id": order_id,
                "payment_status": "error",
                "order_status": order.get("status"),
                "error": str(e),
            }
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/orders/{order_id}/receipt", response_model=dict)
async def get_order_receipt(order_id: str):
    """注文の領収書URLを取得（認証不要）"""
    init_stripe()
    try:
        order = get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        payment_intent_id = order.get("stripe_payment_intent_id")
        if not payment_intent_id:
            raise HTTPException(
                status_code=400, detail="Payment intent not found for this order"
            )

        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            intent_status = (
                payment_intent.get("status")
                if isinstance(payment_intent, dict)
                else payment_intent.status
            )

            if intent_status != "succeeded":
                raise HTTPException(
                    status_code=400,
                    detail="Payment has not been completed yet",
                )

            # Chargeから領収書URLを取得
            latest_charge = (
                payment_intent.get("latest_charge")
                if isinstance(payment_intent, dict)
                else payment_intent.latest_charge
            )

            if latest_charge:
                charge_id = (
                    latest_charge
                    if isinstance(latest_charge, str)
                    else latest_charge.id
                )
                charge = stripe.Charge.retrieve(charge_id)
                receipt_url = (
                    charge.get("receipt_url")
                    if isinstance(charge, dict)
                    else charge.receipt_url
                )

                if receipt_url:
                    return {
                        "order_id": order_id,
                        "receipt_url": receipt_url,
                    }

            raise HTTPException(
                status_code=404, detail="Receipt not found for this order"
            )

        except stripe._error.StripeError as e:
            logger.error(f"Failed to retrieve receipt: {e}")
            raise HTTPException(
                status_code=500, detail=f"Stripe error: {str(e)}"
            ) from e

    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/orders/{order_id}/payment-intent", response_model=dict)
async def create_order_payment_intent(order_id: str):
    """注文用のStripe PaymentIntentを作成"""
    init_stripe()
    try:
        order = get_order_by_id(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Order is not pending")

        # 既にPaymentIntentがある場合は取得
        existing_pi_id = order.get("stripe_payment_intent_id")
        if existing_pi_id:
            try:
                intent = stripe.PaymentIntent.retrieve(existing_pi_id)
                intent_status = (
                    intent.get("status") if isinstance(intent, dict) else intent.status
                )
                if intent_status in [
                    "requires_payment_method",
                    "requires_confirmation",
                ]:
                    if isinstance(intent, dict):
                        return {
                            "payment_intent": {
                                "id": intent.get("id"),
                                "client_secret": intent.get("client_secret"),
                                "amount": intent.get("amount"),
                                "currency": intent.get("currency"),
                                "status": intent.get("status"),
                            }
                        }
                    else:
                        return {
                            "payment_intent": {
                                "id": intent.id,
                                "client_secret": intent.client_secret,
                                "amount": intent.amount,
                                "currency": intent.currency,
                                "status": intent.status,
                            }
                        }
            except stripe._error.StripeError:
                pass  # 既存のPaymentIntentが見つからない場合は新規作成

        # 新規PaymentIntent作成
        total = order["total"]
        # Decimalまたはfloatをintに変換
        amount_jpy = (
            int(total)
            if isinstance(total, (int, float, Decimal))
            else int(float(total))
        )
        intent = stripe.PaymentIntent.create(
            amount=amount_jpy,
            currency="jpy",
            receipt_email=order.get("customer_email"),
            automatic_payment_methods={"enabled": True},
            metadata={
                "order_id": order_id,
                "customer_name": order.get("customer_name", ""),
                "subtotal": str(order.get("subtotal", 0)),
                "discount": str(order.get("discount", 0)),
                "shipping_fee": str(order.get("shipping_fee", 0)),
            },
        )

        # 注文にPaymentIntentとステータスを紐付け
        intent_id = intent.get("id") if isinstance(intent, dict) else intent.id
        intent_status = (
            intent.get("status") if isinstance(intent, dict) else intent.status
        )
        update_order_payment_intent(order_id, intent_id, intent_status)

        # 辞書とオブジェクトの両方に対応
        if isinstance(intent, dict):
            return {
                "payment_intent": {
                    "id": intent.get("id"),
                    "client_secret": intent.get("client_secret"),
                    "amount": intent.get("amount"),
                    "currency": intent.get("currency"),
                    "status": intent.get("status"),
                }
            }
        else:
            return {
                "payment_intent": {
                    "id": intent.id,
                    "client_secret": intent.client_secret,
                    "amount": intent.amount,
                    "currency": intent.currency,
                    "status": intent.status,
                }
            }
    except HTTPException:
        raise
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ClientError as e:
        logger.error(f"DynamoDB error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) from e
    except AttributeError as e:
        logger.error(f"AttributeError in payment intent creation: {str(e)}")
        logger.error(f"Order data: {order}")
        logger.error(
            f"Intent response: {intent if 'intent' in locals() else 'intent not created'}"
        )
        raise HTTPException(status_code=500, detail=f"AttributeError: {str(e)}") from e


@router.post("/checkout/session", response_model=dict)
async def create_checkout_session(request: CreateCheckoutSessionRequest):
    """Stripe Checkoutセッションを作成（オプション機能）"""
    init_stripe()
    try:
        # 在庫確認
        from models import CartItem

        cart_items = [CartItem(**item.model_dump()) for item in request.cart_items]
        reserved_items = validate_and_reserve_stock(cart_items)

        # Stripe Checkoutの商品ラインアイテム作成
        line_items = []
        for item in reserved_items:
            line_items.append(
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {
                            "name": item["product_name"],
                        },
                        "unit_amount": int(item["unit_price"]),
                    },
                    "quantity": item["quantity"],
                }
            )

        # Checkoutセッション作成
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            customer_email=request.customer_email,
            metadata={
                "cart_items": str([item.model_dump() for item in request.cart_items]),
                "coupon_code": request.coupon_code or "",
            },
        )

        return {"checkout_session": {"id": session.id, "url": session.url}}
    except HTTPException:
        raise
    except stripe._error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Stripe Webhookエンドポイント
@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    """Stripe Webhookイベントを処理"""
    init_stripe()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # Webhook署名検証用のシークレットを取得
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            # 開発環境では署名検証をスキップ（本番環境では必須）
            import json

            event = json.loads(payload)

        # イベントタイプに応じて処理
        if event["type"] == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            payment_status = payment_intent.get("status", "succeeded")
            payment_intent_id = payment_intent.get("id")

            if order_id:
                # カードブランド情報を取得
                card_brand = None
                if payment_intent_id:
                    card_brand = get_card_brand_from_payment_intent(payment_intent_id)

                # 注文ステータスを「完了」に更新し、Stripeステータスとカードブランドも保存
                update_order_status_with_stripe(
                    order_id, SaleStatus.COMPLETED.value, payment_status, card_brand
                )

                # 購入完了メールを送信
                try:
                    order = get_order_by_id(order_id)
                    if order:
                        send_order_confirmation_email(order)
                except Exception as email_error:
                    # メール送信失敗してもエラーにはしない
                    logger.error(
                        f"Failed to send order confirmation email: {email_error}"
                    )

        elif event["type"] == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            payment_status = payment_intent.get("status", "failed")

            if order_id:
                # 注文ステータスを「キャンセル」に更新し、在庫を戻す
                order = get_order_by_id(order_id)
                if order and order.get("status") == "pending":
                    restore_stock(order)
                    update_order_status_with_stripe(
                        order_id, SaleStatus.CANCELLED.value, payment_status
                    )

        elif event["type"] == "payment_intent.processing":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            payment_status = payment_intent.get("status", "processing")

            if order_id:
                # Stripeステータスのみ更新（注文ステータスはpendingのまま）
                update_stripe_payment_status(order_id, payment_status)

        elif event["type"] == "payment_intent.canceled":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")
            payment_status = payment_intent.get("status", "canceled")

            if order_id:
                order = get_order_by_id(order_id)
                if order and order.get("status") == "pending":
                    restore_stock(order)
                    update_order_status_with_stripe(
                        order_id, SaleStatus.CANCELLED.value, payment_status
                    )

        elif event["type"] == "checkout.session.completed":
            _session = event["data"]["object"]  # noqa: F841
            # Checkoutセッションから注文を作成
            # （必要に応じて実装）
            pass

        return {"status": "success"}
    except stripe._error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature") from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# 設定管理エンドポイント
@router.get("/config/stripe-terminal", response_model=dict)
async def get_stripe_terminal_config_endpoint(
    config_key: str = Query(
        default="stripe_terminal", description="設定キー（デフォルト: stripe_terminal）"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Stripe Terminal設定を取得"""
    try:
        config = get_config(config_key)
        if not config:
            raise HTTPException(
                status_code=404, detail=f"Config '{config_key}' not found"
            )

        value = config.get("value", {})
        return {
            "config": {
                "config_key": config["config_key"],
                "location_id": value.get("location_id", ""),
                "reader_id": value.get("reader_id"),
                "description": value.get("description"),
                "updated_at": config["updated_at"],
                "created_at": config["created_at"],
            }
        }
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/config/stripe-terminal", response_model=dict)
async def update_stripe_terminal_config_endpoint(
    request: StripeTerminalConfigRequest,
    config_key: str = Query(
        default="stripe_terminal", description="設定キー（デフォルト: stripe_terminal）"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Stripe Terminal設定を作成/更新"""
    try:
        result = set_stripe_terminal_config(
            location_id=request.location_id,
            reader_id=request.reader_id,
            description=request.description,
            config_key=config_key,
        )
        return {"config": result}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/config", response_model=dict)
async def list_configs(current_user: dict = Depends(get_current_user)):
    """全設定一覧を取得"""
    try:
        response = config_table.scan()
        configs = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"configs": configs}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/config/{config_key}", response_model=dict)
async def get_config_endpoint(
    config_key: str, current_user: dict = Depends(get_current_user)
):
    """任意の設定を取得"""
    try:
        config = get_config(config_key)
        if not config:
            raise HTTPException(
                status_code=404, detail=f"Config '{config_key}' not found"
            )
        return {"config": config}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/config/{config_key}", response_model=dict)
async def update_config_endpoint(
    config_key: str,
    request: UpdateConfigRequest,
    current_user: dict = Depends(get_current_user),
):
    """任意の設定を作成/更新"""
    try:
        result = set_config(config_key, request.value)
        return {"config": result}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# 送料設定管理エンドポイント
# ==========================================


@router.get("/shipping-options", response_model=dict)
async def list_shipping_options():
    """送料設定一覧を取得（is_active=Trueのみ、認証不要）"""
    try:
        options = get_all_shipping_options()
        # sort_orderでソート
        options_sorted = sorted(options, key=lambda x: x.get("sort_order", 0))
        return {"shipping_options": options_sorted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/shipping-options/{shipping_option_id}", response_model=dict)
async def get_shipping_option_detail(shipping_option_id: str):
    """送料設定詳細を取得（認証不要）"""
    try:
        option = get_shipping_option_by_id(shipping_option_id)
        if not option:
            raise HTTPException(status_code=404, detail="Shipping option not found")
        return {"shipping_option": option}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/shipping-options", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def create_shipping_option_endpoint(
    request: CreateShippingOptionRequest,
    current_user: dict = Depends(get_current_user),
):
    """送料設定を作成（Admin用）"""
    try:
        new_option = create_shipping_option(
            label=request.label,
            price=request.price,
            sort_order=request.sort_order,
            description=request.description,
        )
        return {"shipping_option": new_option}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/shipping-options/{shipping_option_id}", response_model=dict)
async def update_shipping_option_endpoint(
    shipping_option_id: str,
    request: UpdateShippingOptionRequest,
    current_user: dict = Depends(get_current_user),
):
    """送料設定を更新（Admin用）"""
    try:
        updated_option = update_shipping_option(
            shipping_option_id=shipping_option_id,
            label=request.label,
            price=request.price,
            sort_order=request.sort_order,
            description=request.description,
            is_active=request.is_active,
        )
        if not updated_option:
            raise HTTPException(status_code=404, detail="Shipping option not found")
        return {"shipping_option": updated_option}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/shipping-options/{shipping_option_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_shipping_option_endpoint(
    shipping_option_id: str,
    current_user: dict = Depends(get_current_user),
):
    """送料設定を削除（論理削除、Admin用）"""
    try:
        deleted = delete_shipping_option(shipping_option_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Shipping option not found")
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# Stripe Terminal エンドポイント
# ==========================================


@router.post("/terminal/connection-token", response_model=dict)
async def create_connection_token(
    request: TerminalConnectionTokenRequest | None = None,
):
    """
    Stripe Terminal用のConnection Tokenを発行

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        location_id = request.location_id if request else None
        token = create_terminal_connection_token(location_id)
        return {"connection_token": token}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error creating connection token: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating connection token: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/account", response_model=dict)
async def get_account_info():
    """
    Stripeアカウント情報を取得（加盟店名など）

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        from services import get_stripe_account_info

        account_info = get_stripe_account_info()
        return {"account": account_info}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error getting account info: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error getting account info: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/locations", response_model=dict)
async def list_locations():
    """
    登録済みのロケーション一覧を取得

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        locations = list_terminal_locations()
        return {"locations": locations}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error listing locations: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error listing locations: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/locations", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def create_location(
    request: TerminalLocationRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Stripe Terminalのロケーションを作成（Admin用）
    """
    try:
        location = create_terminal_location(
            display_name=request.display_name,
            address_line1=request.address_line1,
            city=request.city,
            state=request.state,
            country=request.country,
            postal_code=request.postal_code,
        )
        return {"location": location}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error creating location: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating location: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/readers", response_model=dict)
async def list_readers(
    location_id: str | None = Query(
        default=None, description="ロケーションIDでフィルタ"
    ),
):
    """
    登録済みのリーダー一覧を取得

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        readers = list_terminal_readers(location_id)
        return {"readers": readers}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error listing readers: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error listing readers: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/readers", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def register_reader(
    request: TerminalRegisterReaderRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Stripe Terminalにリーダーを登録（Admin用）
    """
    try:
        reader = register_terminal_reader(
            registration_code=request.registration_code,
            label=request.label,
            location_id=request.location_id,
        )
        return {"reader": reader}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error registering reader: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error registering reader: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/terminal/readers/{reader_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reader(
    reader_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    リーダーを削除（Admin用）
    """
    try:
        deleted = delete_terminal_reader(reader_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Reader not found")
        return None
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error deleting reader: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting reader: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/payment-intents",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_terminal_pi(request: TerminalPaymentIntentRequest):
    """
    Terminal用PaymentIntentを作成

    認証不要（モバイルアプリから呼び出し）
    capture_method="manual"で作成される
    """
    try:
        # メタデータにsale_idとpnrを追加
        metadata = request.metadata or {}
        if request.sale_id:
            metadata["sale_id"] = request.sale_id
        if request.pnr:
            metadata["pnr"] = request.pnr

        payment_intent = create_terminal_payment_intent(
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            metadata=metadata if metadata else None,
        )
        return {"payment_intent": payment_intent}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error creating terminal payment intent: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating terminal payment intent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/payment-intents/{payment_intent_id}/capture", response_model=dict
)
async def capture_terminal_pi(payment_intent_id: str):
    """
    Terminal PaymentIntentをキャプチャ（確定）

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        result = capture_terminal_payment_intent(payment_intent_id)
        return {"payment_intent": result}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error capturing payment intent: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error capturing payment intent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/payment-intents/{payment_intent_id}/cancel", response_model=dict
)
async def cancel_terminal_pi(payment_intent_id: str):
    """
    Terminal PaymentIntentをキャンセル

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        result = cancel_terminal_payment_intent(payment_intent_id)
        return {"payment_intent": result}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error canceling payment intent: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error canceling payment intent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/payment-intents/{payment_intent_id}", response_model=dict)
async def get_terminal_pi(payment_intent_id: str):
    """
    PaymentIntent情報を取得（返金可否確認用）

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        result = get_payment_intent_for_refund(payment_intent_id)
        if not result:
            raise HTTPException(status_code=404, detail="PaymentIntent not found")
        return {"payment_intent": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment intent: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/terminal/refunds", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def create_refund(request: TerminalRefundRequest):
    """
    Terminal決済の返金を処理

    認証不要（モバイルアプリから呼び出し）
    """
    try:
        refund = create_terminal_refund(
            payment_intent_id=request.payment_intent_id,
            amount=request.amount,
            reason=request.reason,
        )
        return {"refund": refund}
    except stripe._error.StripeError as e:
        logger.error(f"Stripe error creating refund: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error creating refund: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# Terminal Pairing エンドポイント
# ==========================================


@router.post(
    "/terminal/pairing/register",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def register_pairing(request: TerminalPairingRegisterRequest):
    """
    ターミナルペアリングを登録（デスクトップ側から呼び出し）

    6桁のPINコードを登録し、ターミナルとの連携を準備する
    """
    try:
        pairing = register_terminal_pairing(
            pin_code=request.pin_code,
            pos_id=request.pos_id,
            pos_name=request.pos_name,
            event_id=request.event_id,
            event_name=request.event_name,
        )
        return {"pairing": pairing}
    except Exception as e:
        logger.error(f"Error registering pairing: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/terminal/pairing/verify", response_model=dict)
async def verify_pairing(request: TerminalPairingVerifyRequest):
    """
    ターミナルペアリングを検証（ターミナル側から呼び出し）

    PINコードが有効な場合、POS情報を返す
    """
    try:
        pairing = verify_terminal_pairing(request.pin_code)
        if not pairing:
            raise HTTPException(status_code=404, detail="Pairing not found or expired")
        return {"pairing": pairing}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying pairing: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/terminal/pairing/{pin_code}", response_model=dict)
async def delete_pairing(pin_code: str):
    """
    ターミナルペアリングを解除

    デスクトップまたはターミナルから呼び出し可能
    """
    try:
        success = delete_terminal_pairing(pin_code)
        if not success:
            raise HTTPException(status_code=404, detail="Pairing not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting pairing: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/pairing/{pin_code}", response_model=dict)
async def get_pairing_status(pin_code: str):
    """
    ターミナルペアリング状態を取得（デスクトップ側からポーリング用）

    ターミナルが接続したかどうかを確認する
    """
    try:
        pairing = get_terminal_pairing_status(pin_code)
        if not pairing:
            raise HTTPException(status_code=404, detail="Pairing not found or expired")
        return {"pairing": pairing}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pairing status: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# Terminal Payment Request エンドポイント
# ==========================================


@router.post(
    "/terminal/payment-requests",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment_request_endpoint(request: CreatePaymentRequestRequest):
    """
    決済リクエストを作成（デスクトップ側から呼び出し）

    ターミナルがポーリングで取得し、決済を実行する
    """
    try:
        items_dict = None
        if request.items:
            items_dict = [item.model_dump() for item in request.items]

        payment_request = create_payment_request(
            pin_code=request.pin_code,
            amount=request.amount,
            currency=request.currency,
            description=request.description,
            sale_id=request.sale_id,
            items=items_dict,
        )
        return {"payment_request": payment_request}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating payment request: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/payment-requests/pending/{pin_code}", response_model=dict)
async def get_pending_payment_request_endpoint(pin_code: str):
    """
    ペンディング状態の決済リクエストを取得（ターミナル側からポーリング）

    決済リクエストが存在しない場合はnullを返す
    """
    try:
        payment_request = get_pending_payment_request(pin_code)
        return {"payment_request": payment_request}
    except Exception as e:
        logger.error(f"Error getting pending payment request: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminal/payment-requests/{request_id}", response_model=dict)
async def get_payment_request_endpoint(request_id: str):
    """
    決済リクエストを取得（デスクトップ側からステータス確認）
    """
    try:
        payment_request = get_payment_request(request_id)
        if not payment_request:
            raise HTTPException(status_code=404, detail="Payment request not found")
        return {"payment_request": payment_request}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment request: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/terminal/payment-requests/{request_id}/result", response_model=dict)
async def update_payment_request_result_endpoint(
    request_id: str, request: UpdatePaymentRequestResultRequest
):
    """
    決済リクエストの結果を更新（ターミナル側から呼び出し）

    決済完了、失敗、キャンセルのいずれかを報告
    """
    try:
        # card_detailsをdictに変換
        card_details_dict = None
        if request.card_details:
            card_details_dict = request.card_details.model_dump(exclude_none=True)

        result = update_payment_request_result(
            request_id=request_id,
            status=request.status.value,
            payment_intent_id=request.payment_intent_id,
            error_message=request.error_message,
            card_details=card_details_dict,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Payment request not found")
        return {"payment_request": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating payment request result: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/terminal/payment-requests/{request_id}", response_model=dict)
async def cancel_payment_request_endpoint(request_id: str):
    """
    決済リクエストをキャンセル（デスクトップ側から呼び出し）
    """
    try:
        success = cancel_payment_request(request_id)
        if not success:
            raise HTTPException(status_code=404, detail="Payment request not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error canceling payment request: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)


# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    """
    Lambda関数のエントリーポイント
    全体をtry-exceptでラップしてLambda関数のクラッシュを防止
    """
    try:
        # リクエスト情報をログ出力
        request_context = event.get("requestContext", {})
        http_info = request_context.get("http", {})
        method = http_info.get("method", event.get("httpMethod", ""))
        path = http_info.get("path", event.get("path", ""))

        logger.info(f"Request received - Method: {method}, Path: {path}")

        # OPTIONS リクエストは認証なしで即座にCORSレスポンスを返す
        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "300",
                },
                "body": "",
            }

        # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
        environment = os.environ.get("ENVIRONMENT", "dev")
        api_gateway_base_path = f"/{environment}/sales"
        mangum_handler = Mangum(
            app, lifespan="off", api_gateway_base_path=api_gateway_base_path
        )
        response = mangum_handler(event, context)
        logger.info(
            f"Request completed - Status: {response.get('statusCode', 'unknown')}"
        )
        return response

    except Exception as e:
        # Lambda関数レベルでの致命的なエラーをキャッチ
        logger.error(f"Fatal error in Lambda handler: {e}")
        logger.error(f"Event: {json.dumps(event, default=str)}")
        logger.error(f"Traceback: {traceback.format_exc()}")

        # エラーレスポンスを返す（Lambda関数自体はクラッシュしない）
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "detail": "Lambda handler error",
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                }
            ),
        }
