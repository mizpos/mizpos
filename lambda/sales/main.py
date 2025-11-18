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

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

from auth import get_current_user
from models import (
    ApplyCouponRequest,
    CreateCheckoutSessionRequest,
    CreateCouponRequest,
    CreateEventRequest,
    CreateOnlineOrderRequest,
    CreatePaymentIntentRequest,
    CreateSaleRequest,
    SaleStatus,
    StripeTerminalConfigRequest,
    UpdateConfigRequest,
)
from services import (
    calculate_commission_fees,
    calculate_coupon_discount,
    config_table,
    create_online_order,
    deduct_stock,
    dynamo_to_dict,
    events_table,
    get_config,
    get_coupon_by_code,
    get_order_by_id,
    get_orders_by_email,
    get_products_info,
    increment_coupon_usage,
    init_stripe,
    restore_stock,
    sales_table,
    set_config,
    set_stripe_terminal_config,
    update_order_payment_intent,
    update_order_status,
    validate_and_reserve_stock,
    validate_coupon,
)

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
        discount = 0.0
        if request.coupon_code:
            coupon = get_coupon_by_code(request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="Invalid coupon code")

            validate_coupon(coupon)
            discount = calculate_coupon_discount(
                coupon, request.cart_items, products_info
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
    except stripe.error.StripeError as e:
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
    except stripe.error.StripeError as e:
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
            shipping_address=request.shipping_address.model_dump(),
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
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") from e


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
                if intent.status in [
                    "requires_payment_method",
                    "requires_confirmation",
                ]:
                    return {
                        "payment_intent": {
                            "id": intent.id,
                            "client_secret": intent.client_secret,
                            "amount": intent.amount,
                            "currency": intent.currency,
                            "status": intent.status,
                        }
                    }
            except stripe.error.StripeError:
                pass  # 既存のPaymentIntentが見つからない場合は新規作成

        # 新規PaymentIntent作成
        amount_jpy = int(float(order["total"]))
        intent = stripe.PaymentIntent.create(
            amount=amount_jpy,
            currency="jpy",
            receipt_email=order.get("customer_email"),
            metadata={
                "order_id": order_id,
                "customer_name": order.get("customer_name", ""),
            },
        )

        # 注文にPaymentIntentを紐付け
        update_order_payment_intent(order_id, intent.id)

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
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


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
    except stripe.error.StripeError as e:
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

            if order_id:
                # 注文ステータスを「完了」に更新
                update_order_status(order_id, SaleStatus.COMPLETED.value)

        elif event["type"] == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            order_id = payment_intent.get("metadata", {}).get("order_id")

            if order_id:
                # 注文ステータスを「キャンセル」に更新し、在庫を戻す
                order = get_order_by_id(order_id)
                if order and order.get("status") == "pending":
                    restore_stock(order)
                    update_order_status(order_id, SaleStatus.CANCELLED.value)

        elif event["type"] == "checkout.session.completed":
            _session = event["data"]["object"]  # noqa: F841
            # Checkoutセッションから注文を作成
            # （必要に応じて実装）
            pass

        return {"status": "success"}
    except stripe.error.SignatureVerificationError as e:
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
        logger.info(f"Request completed - Status: {response.get('statusCode', 'unknown')}")
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
