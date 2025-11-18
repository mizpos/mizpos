import json
import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3
import stripe
from botocore.exceptions import ClientError
from fastapi import HTTPException

from models import CartItem

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
SALES_TABLE = os.environ.get("SALES_TABLE", f"{ENVIRONMENT}-mizpos-sales")
STOCK_TABLE = os.environ.get("STOCK_TABLE", f"{ENVIRONMENT}-mizpos-stock")
STOCK_HISTORY_TABLE = os.environ.get(
    "STOCK_HISTORY_TABLE", f"{ENVIRONMENT}-mizpos-stock-history"
)
EVENTS_TABLE = os.environ.get("EVENTS_TABLE", f"{ENVIRONMENT}-mizpos-events")
CONFIG_TABLE = os.environ.get("CONFIG_TABLE", f"{ENVIRONMENT}-mizpos-config")
PUBLISHERS_TABLE = os.environ.get(
    "PUBLISHERS_TABLE", f"{ENVIRONMENT}-mizpos-publishers"
)
STRIPE_SECRET_ARN = os.environ.get("STRIPE_SECRET_ARN", "")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
sales_table = dynamodb.Table(SALES_TABLE)
stock_table = dynamodb.Table(STOCK_TABLE)
stock_history_table = dynamodb.Table(STOCK_HISTORY_TABLE)
events_table = dynamodb.Table(EVENTS_TABLE)
config_table = dynamodb.Table(CONFIG_TABLE)
publishers_table = dynamodb.Table(PUBLISHERS_TABLE)


def init_stripe() -> None:
    """Stripe APIキーを初期化"""
    if not stripe.api_key and STRIPE_SECRET_ARN:
        try:
            secret_response = secrets_client.get_secret_value(
                SecretId=STRIPE_SECRET_ARN
            )
            secret_data = json.loads(secret_response["SecretString"])
            stripe.api_key = secret_data.get("api_key", "")
        except ClientError:
            pass


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""
    result = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        else:
            result[key] = value
    return result


def record_stock_history(
    product_id: str,
    quantity_before: int,
    quantity_after: int,
    quantity_change: int,
    reason: str,
    operator_id: str = "",
) -> None:
    """在庫変動履歴を記録"""
    timestamp = int(time.time() * 1000)
    history_item = {
        "product_id": product_id,
        "timestamp": timestamp,
        "quantity_before": quantity_before,
        "quantity_after": quantity_after,
        "quantity_change": quantity_change,
        "reason": reason,
        "operator_id": operator_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    stock_history_table.put_item(Item=history_item)


def validate_and_reserve_stock(cart_items: list[CartItem]) -> list[dict]:
    """在庫を確認し、販売用に確保する"""
    reserved_items = []

    for item in cart_items:
        product_response = stock_table.get_item(Key={"product_id": item.product_id})
        product = product_response.get("Item")

        if not product:
            raise HTTPException(
                status_code=404, detail=f"Product {item.product_id} not found"
            )

        current_stock = int(product.get("stock_quantity", 0))
        if current_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product {item.product_id}. Available: {current_stock}",
            )

        reserved_items.append(
            {
                "product_id": item.product_id,
                "product_name": product.get("name", ""),
                "quantity": item.quantity,
                "unit_price": Decimal(str(item.unit_price)),
                "subtotal": Decimal(str(item.unit_price * item.quantity)),
                "current_stock": current_stock,
            }
        )

    return reserved_items


def deduct_stock(reserved_items: list[dict], sale_id: str, user_id: str) -> None:
    """在庫を減らす"""
    for item in reserved_items:
        new_stock = item["current_stock"] - item["quantity"]
        now = datetime.now(timezone.utc).isoformat()

        stock_table.update_item(
            Key={"product_id": item["product_id"]},
            UpdateExpression="SET stock_quantity = :sq, updated_at = :ua",
            ExpressionAttributeValues={":sq": new_stock, ":ua": now},
        )

        record_stock_history(
            product_id=item["product_id"],
            quantity_before=item["current_stock"],
            quantity_after=new_stock,
            quantity_change=-item["quantity"],
            reason=f"販売 (sale_id: {sale_id})",
            operator_id=user_id,
        )


def restore_stock(sale: dict) -> None:
    """販売キャンセル時に在庫を戻す"""
    for item in sale.get("items", []):
        product_response = stock_table.get_item(Key={"product_id": item["product_id"]})
        product = product_response.get("Item")
        if product:
            current_stock = int(product.get("stock_quantity", 0))
            new_stock = current_stock + item["quantity"]
            now = datetime.now(timezone.utc).isoformat()

            stock_table.update_item(
                Key={"product_id": item["product_id"]},
                UpdateExpression="SET stock_quantity = :sq, updated_at = :ua",
                ExpressionAttributeValues={":sq": new_stock, ":ua": now},
            )

            record_stock_history(
                product_id=item["product_id"],
                quantity_before=current_stock,
                quantity_after=new_stock,
                quantity_change=item["quantity"],
                reason=f"販売キャンセル (sale_id: {sale.get('sale_id', '')})",
                operator_id=sale.get("user_id", "system"),
            )


def calculate_coupon_discount(
    coupon: dict, cart_items: list[CartItem], products_info: dict
) -> float:
    """クーポンによる割引額を計算"""
    applicable_subtotal = 0.0
    coupon_filter = coupon.get("filter", {})

    if not coupon_filter:
        # フィルタなし = 全商品に適用
        applicable_subtotal = sum(
            item.unit_price * item.quantity for item in cart_items
        )
    else:
        product_ids_filter = coupon_filter.get("product_ids", [])
        categories_filter = coupon_filter.get("categories", [])

        for item in cart_items:
            product_info = products_info.get(item.product_id, {})
            product_category = product_info.get("category", "")

            # 商品IDまたはカテゴリがフィルタに一致
            if (product_ids_filter and item.product_id in product_ids_filter) or (
                categories_filter and product_category in categories_filter
            ):
                applicable_subtotal += item.unit_price * item.quantity

    discount_type = coupon.get("discount_type", "percentage")
    discount_value = float(coupon.get("discount_value", 0))

    if discount_type == "percentage":
        return applicable_subtotal * (discount_value / 100)
    else:  # fixed
        return min(discount_value, applicable_subtotal)


def get_coupon_by_code(code: str) -> dict | None:
    """クーポンコードからクーポンを取得"""
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": f"coupon_{code}"},
    )
    items = response.get("Items", [])
    return items[0] if items else None


def validate_coupon(coupon: dict) -> None:
    """クーポンの有効性を検証"""
    if not coupon.get("is_active", False):
        raise HTTPException(status_code=400, detail="Coupon is inactive")

    # 使用回数チェック
    max_uses = coupon.get("max_uses")
    current_uses = int(coupon.get("current_uses", 0))
    if max_uses and current_uses >= max_uses:
        raise HTTPException(status_code=400, detail="Coupon has reached max uses")

    # 有効期限チェック
    valid_until = coupon.get("valid_until")
    if valid_until:
        expiry = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail="Coupon has expired")


def increment_coupon_usage(coupon: dict) -> None:
    """クーポン使用回数を増加"""
    sales_table.update_item(
        Key={"sale_id": f"coupon_{coupon['code']}", "timestamp": coupon["timestamp"]},
        UpdateExpression="SET current_uses = current_uses + :inc",
        ExpressionAttributeValues={":inc": 1},
    )


def get_products_info(cart_items: list[CartItem]) -> dict:
    """カート内商品の情報を取得"""
    products_info = {}
    for item in cart_items:
        prod_resp = stock_table.get_item(Key={"product_id": item.product_id})
        if prod_resp.get("Item"):
            products_info[item.product_id] = dynamo_to_dict(prod_resp["Item"])
    return products_info


def get_publisher_info(publisher_id: str) -> dict | None:
    """出版社/サークル情報を取得"""
    if not publisher_id:
        return None
    try:
        response = publishers_table.get_item(Key={"publisher_id": publisher_id})
        item = response.get("Item")
        return dynamo_to_dict(item) if item else None
    except ClientError:
        return None


def calculate_commission_fees(
    reserved_items: list[dict],
    products_info: dict,
    payment_method: str,
) -> dict:
    """
    販売時の手数料を計算（委託販売レポート用）

    Returns:
        {
            "items": [
                {
                    "product_id": str,
                    "publisher_id": str | None,
                    "publisher_name": str,
                    "subtotal": float,
                    "commission_rate": float,
                    "commission_amount": float,
                    "payment_fee_rate": float,
                    "payment_fee_amount": float,
                    "net_amount": float,  # 委託元への支払い額
                }
            ],
            "total_commission": float,
            "total_payment_fee": float,
            "total_net_amount": float,
        }
    """
    result_items = []
    total_commission = Decimal("0")
    total_payment_fee = Decimal("0")
    total_net = Decimal("0")

    # 出版社情報をキャッシュ
    publisher_cache = {}

    for item in reserved_items:
        product_id = item["product_id"]
        product_info = products_info.get(product_id, {})
        publisher_id = product_info.get("publisher_id")

        # 出版社情報を取得
        if publisher_id and publisher_id not in publisher_cache:
            publisher_cache[publisher_id] = get_publisher_info(publisher_id)

        publisher = publisher_cache.get(publisher_id) if publisher_id else None

        # 手数料率を取得
        if publisher:
            commission_rate = float(publisher.get("commission_rate", 0.0))
            if payment_method == "stripe_online":
                payment_fee_rate = float(publisher.get("stripe_online_fee_rate", 3.6))
            elif payment_method == "stripe_terminal":
                payment_fee_rate = float(publisher.get("stripe_terminal_fee_rate", 3.6))
            else:  # cash
                payment_fee_rate = 0.0
            publisher_name = publisher.get("name", "")
        else:
            # 出版社情報がない場合はデフォルト値
            commission_rate = 0.0
            payment_fee_rate = 0.0
            publisher_name = product_info.get("publisher", "")

        subtotal = item["subtotal"]
        commission_amount = subtotal * (Decimal(str(commission_rate)) / 100)
        payment_fee_amount = subtotal * (Decimal(str(payment_fee_rate)) / 100)
        net_amount = subtotal - commission_amount - payment_fee_amount

        result_items.append(
            {
                "product_id": product_id,
                "publisher_id": publisher_id,
                "publisher_name": publisher_name,
                "subtotal": subtotal,
                "commission_rate": Decimal(str(commission_rate)),
                "commission_amount": commission_amount,
                "payment_fee_rate": Decimal(str(payment_fee_rate)),
                "payment_fee_amount": payment_fee_amount,
                "net_amount": net_amount,
            }
        )

        total_commission += commission_amount
        total_payment_fee += payment_fee_amount
        total_net += net_amount

    return {
        "items": result_items,
        "total_commission": total_commission,
        "total_payment_fee": total_payment_fee,
        "total_net_amount": total_net,
    }


# 設定管理関数
def get_config(config_key: str) -> dict | None:
    """設定を取得"""
    response = config_table.get_item(Key={"config_key": config_key})
    item = response.get("Item")
    return dynamo_to_dict(item) if item else None


def set_config(config_key: str, value: dict) -> dict:
    """設定を保存/更新"""
    now = datetime.now(timezone.utc).isoformat()

    existing = get_config(config_key)
    created_at = existing.get("created_at", now) if existing else now

    config_item = {
        "config_key": config_key,
        "value": value,
        "updated_at": now,
        "created_at": created_at,
    }

    config_table.put_item(Item=config_item)
    return dynamo_to_dict(config_item)


def delete_config(config_key: str) -> bool:
    """設定を削除"""
    existing = get_config(config_key)
    if not existing:
        return False

    config_table.delete_item(Key={"config_key": config_key})
    return True


def get_stripe_terminal_config(config_key: str = "stripe_terminal") -> dict | None:
    """Stripe Terminal設定を取得"""
    config = get_config(config_key)
    if config:
        return config.get("value", {})
    return None


def set_stripe_terminal_config(
    location_id: str,
    reader_id: str | None = None,
    description: str | None = None,
    config_key: str = "stripe_terminal",
) -> dict:
    """Stripe Terminal設定を保存"""
    value = {
        "location_id": location_id,
        "reader_id": reader_id,
        "description": description,
    }
    config = set_config(config_key, value)

    # フラットな形式で返す
    return {
        "config_key": config["config_key"],
        "location_id": value["location_id"],
        "reader_id": value.get("reader_id"),
        "description": value.get("description"),
        "updated_at": config["updated_at"],
        "created_at": config["created_at"],
    }


# オンライン販売用のサービス関数
def create_online_order(
    cart_items: list,
    customer_email: str,
    customer_name: str,
    shipping_address: dict,
    coupon_code: str | None = None,
    notes: str | None = None,
) -> dict:
    """オンライン注文を作成（顧客向け、認証不要）"""
    import uuid

    # 在庫確認・確保
    from models import CartItem

    cart_items_models = [CartItem(**item) for item in cart_items]
    reserved_items = validate_and_reserve_stock(cart_items_models)

    # 商品情報を取得
    products_info = get_products_info(cart_items_models)

    # 小計計算
    subtotal = sum(item["subtotal"] for item in reserved_items)

    # クーポン適用
    discount = Decimal("0.0")
    if coupon_code:
        coupon = get_coupon_by_code(coupon_code)
        if coupon:
            validate_coupon(coupon)
            discount = Decimal(
                str(calculate_coupon_discount(coupon, cart_items_models, products_info))
            )
            increment_coupon_usage(coupon)

    total = subtotal - discount

    # 手数料情報を計算（オンライン販売はstripe_online）
    commission_info = calculate_commission_fees(
        reserved_items, products_info, "stripe_online"
    )

    order_id = str(uuid.uuid4())
    timestamp = int(time.time() * 1000)
    now = datetime.now(timezone.utc).isoformat()

    # オンライン注文として保存（event_idは"online"固定、user_idは"customer"固定）
    order_item = {
        "sale_id": order_id,
        "timestamp": timestamp,
        "event_id": "online",
        "user_id": "customer",
        "items": reserved_items,
        "subtotal": Decimal(str(subtotal)),
        "discount": Decimal(str(discount)),
        "total": Decimal(str(total)),
        "payment_method": "stripe_online",
        "status": "pending",
        "coupon_code": coupon_code or "",
        "customer_email": customer_email,
        "customer_name": customer_name,
        "shipping_address": shipping_address,
        "notes": notes or "",
        "stripe_payment_intent_id": "",
        "stripe_checkout_session_id": "",
        "created_at": now,
        # 委託販売手数料情報
        "commission_details": commission_info["items"],
        "total_commission": Decimal(str(commission_info["total_commission"])),
        "total_payment_fee": Decimal(str(commission_info["total_payment_fee"])),
        "total_net_amount": Decimal(str(commission_info["total_net_amount"])),
    }

    sales_table.put_item(Item=order_item)

    # 在庫を減らす（注文時点で確保）
    deduct_stock(reserved_items, order_id, "customer")

    return dynamo_to_dict(order_item)


def get_order_by_id(order_id: str) -> dict | None:
    """注文IDから注文を取得"""
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    return dynamo_to_dict(items[0]) if items else None


def get_orders_by_email(customer_email: str, limit: int = 50) -> list[dict]:
    """顧客メールアドレスから注文一覧を取得"""
    # DynamoDBのscanでcustomer_emailをフィルタ（本番環境ではGSI推奨）
    response = sales_table.scan(
        FilterExpression="customer_email = :email AND event_id = :eid",
        ExpressionAttributeValues={":email": customer_email, ":eid": "online"},
        Limit=limit,
    )
    orders = [
        dynamo_to_dict(item)
        for item in response.get("Items", [])
        if not item.get("sale_id", "").startswith("coupon_")
    ]
    return orders


def update_order_payment_intent(order_id: str, payment_intent_id: str) -> dict | None:
    """注文のPaymentIntentを更新"""
    order = get_order_by_id(order_id)
    if not order:
        return None

    timestamp = order["timestamp"]
    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression="SET stripe_payment_intent_id = :pi",
        ExpressionAttributeValues={":pi": payment_intent_id},
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


def update_order_status(order_id: str, status: str) -> dict | None:
    """注文のステータスを更新"""
    order = get_order_by_id(order_id)
    if not order:
        return None

    timestamp = order["timestamp"]
    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression="SET #st = :status",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":status": status},
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])
