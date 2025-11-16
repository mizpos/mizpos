import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import stripe
from botocore.exceptions import ClientError
from fastapi import APIRouter, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from models import (
    ApplyCouponRequest,
    CreateCouponRequest,
    CreateEventRequest,
    CreatePaymentIntentRequest,
    CreateSaleRequest,
    SaleStatus,
    StripeTerminalConfigRequest,
)
from services import (
    calculate_coupon_discount,
    config_table,
    deduct_stock,
    dynamo_to_dict,
    events_table,
    get_config,
    get_coupon_by_code,
    get_products_info,
    get_stripe_terminal_config,
    increment_coupon_usage,
    init_stripe,
    restore_stock,
    sales_table,
    set_stripe_terminal_config,
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

# ルーター
router = APIRouter()


# 販売エンドポイント
@router.get("/sales", response_model=dict)
async def list_sales(
    event_id: str | None = Query(default=None, description="イベントIDでフィルタ"),
    user_id: str | None = Query(default=None, description="ユーザーIDでフィルタ"),
    limit: int = Query(default=50, ge=1, le=1000, description="取得件数"),
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
async def get_sale(sale_id: str):
    """販売詳細取得"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid", ExpressionAttributeValues={":sid": sale_id}
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
async def create_sale(request: CreateSaleRequest):
    """販売を作成"""
    try:
        # 在庫確認・確保
        reserved_items = validate_and_reserve_stock(request.cart_items)

        # 小計計算
        subtotal = sum(item["subtotal"] for item in reserved_items)

        # クーポン適用
        discount = 0.0
        if request.coupon_code:
            coupon = get_coupon_by_code(request.coupon_code)
            if not coupon:
                raise HTTPException(status_code=400, detail="Invalid coupon code")

            validate_coupon(coupon)
            products_info = get_products_info(request.cart_items)
            discount = calculate_coupon_discount(coupon, request.cart_items, products_info)
            increment_coupon_usage(coupon)

        total = subtotal - discount

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
async def complete_sale(sale_id: str, stripe_payment_intent_id: str | None = None):
    """販売を完了にする"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid", ExpressionAttributeValues={":sid": sale_id}
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
async def cancel_sale(sale_id: str):
    """販売をキャンセル（在庫を戻す）"""
    try:
        response = sales_table.query(
            KeyConditionExpression="sale_id = :sid", ExpressionAttributeValues={":sid": sale_id}
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
async def create_payment_intent(request: CreatePaymentIntentRequest):
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
async def get_payment_intent(payment_intent_id: str):
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
async def create_coupon(request: CreateCouponRequest):
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
async def get_coupon(code: str):
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
async def apply_coupon(request: ApplyCouponRequest):
    """クーポンを適用して割引額を計算"""
    try:
        coupon = get_coupon_by_code(request.code)
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

        validate_coupon(coupon)
        products_info = get_products_info(request.cart_items)
        discount = calculate_coupon_discount(coupon, request.cart_items, products_info)
        subtotal = sum(item.unit_price * item.quantity for item in request.cart_items)

        return {"subtotal": subtotal, "discount": discount, "total": subtotal - discount}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/coupons/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_coupon(code: str):
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
async def list_events():
    """イベント一覧取得"""
    try:
        response = events_table.scan()
        events = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"events": events}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/events", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_event(request: CreateEventRequest):
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


# 設定管理エンドポイント
@router.get("/config/stripe-terminal", response_model=dict)
async def get_stripe_terminal_config_endpoint(
    config_key: str = Query(default="stripe_terminal", description="設定キー（デフォルト: stripe_terminal）"),
):
    """Stripe Terminal設定を取得"""
    try:
        config = get_config(config_key)
        if not config:
            raise HTTPException(status_code=404, detail=f"Config '{config_key}' not found")

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
    config_key: str = Query(default="stripe_terminal", description="設定キー（デフォルト: stripe_terminal）"),
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
async def list_configs():
    """全設定一覧を取得"""
    try:
        response = config_table.scan()
        configs = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"configs": configs}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/config/{config_key}", response_model=dict)
async def get_config_endpoint(config_key: str):
    """任意の設定を取得"""
    try:
        config = get_config(config_key)
        if not config:
            raise HTTPException(status_code=404, detail=f"Config '{config_key}' not found")
        return {"config": config}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)

# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
    environment = os.environ.get("ENVIRONMENT", "dev")
    api_gateway_base_path = f"/{environment}/sales"
    mangum_handler = Mangum(app, lifespan="off", api_gateway_base_path=api_gateway_base_path)
    return mangum_handler(event, context)
