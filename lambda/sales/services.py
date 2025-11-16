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
STOCK_HISTORY_TABLE = os.environ.get("STOCK_HISTORY_TABLE", f"{ENVIRONMENT}-mizpos-stock-history")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE", f"{ENVIRONMENT}-mizpos-events")
CONFIG_TABLE = os.environ.get("CONFIG_TABLE", f"{ENVIRONMENT}-mizpos-config")
STRIPE_SECRET_ARN = os.environ.get("STRIPE_SECRET_ARN", "")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
sales_table = dynamodb.Table(SALES_TABLE)
stock_table = dynamodb.Table(STOCK_TABLE)
stock_history_table = dynamodb.Table(STOCK_HISTORY_TABLE)
events_table = dynamodb.Table(EVENTS_TABLE)
config_table = dynamodb.Table(CONFIG_TABLE)


def init_stripe() -> None:
    """Stripe APIキーを初期化"""
    if not stripe.api_key and STRIPE_SECRET_ARN:
        try:
            secret_response = secrets_client.get_secret_value(SecretId=STRIPE_SECRET_ARN)
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
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

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
                "unit_price": float(item.unit_price),
                "subtotal": float(item.unit_price * item.quantity),
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
        applicable_subtotal = sum(item.unit_price * item.quantity for item in cart_items)
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
