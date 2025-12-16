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
USERS_TABLE = os.environ.get("USERS_TABLE", f"{ENVIRONMENT}-mizpos-users")
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
users_table = dynamodb.Table(USERS_TABLE)


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


def get_card_brand_from_payment_intent(payment_intent_id: str) -> str | None:
    """
    Stripe PaymentIntentからカードブランド情報を取得

    Returns:
        カードブランド名（例: "visa", "mastercard", "jcb"）、取得できない場合はNone
    """
    try:
        init_stripe()
        payment_intent = stripe.PaymentIntent.retrieve(
            payment_intent_id,
            expand=["payment_method"],  # payment_methodを展開して取得
        )

        # payment_methodが存在するか確認
        payment_method = (
            payment_intent.get("payment_method")
            if isinstance(payment_intent, dict)
            else payment_intent.payment_method
        )

        if not payment_method:
            return None

        # payment_methodがオブジェクトの場合
        if isinstance(payment_method, dict):
            if payment_method.get("type") == "card":
                card = payment_method.get("card", {})
                return card.get("brand")
        elif hasattr(payment_method, "type"):
            if payment_method.type == "card":
                return (
                    payment_method.card.brand
                    if hasattr(payment_method, "card")
                    else None
                )

        return None
    except Exception as e:
        # エラーが発生してもNoneを返す（カードブランド取得失敗を許容）
        import logging

        logging.error(
            f"Failed to get card brand from PaymentIntent {payment_intent_id}: {e}"
        )
        return None


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""

    def convert_value(value):
        """再帰的にDecimalを変換"""
        if isinstance(value, Decimal):
            return float(value)
        elif isinstance(value, dict):
            return {k: convert_value(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [convert_value(v) for v in value]
        else:
            return value

    result = {}
    for key, value in item.items():
        result[key] = convert_value(value)
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
def find_user_by_email(email: str) -> dict | None:
    """
    emailからDynamoDBのユーザーを検索
    cognito_user_idまたはemailフィールドで一致するユーザーを返す
    """
    try:
        # 全ユーザーをスキャン（小規模テーブルを想定）
        response = users_table.scan()
        for item in response.get("Items", []):
            # cognito_user_id（email）またはemailフィールドで一致
            if item.get("cognito_user_id") == email or item.get("email") == email:
                return item
        return None
    except ClientError:
        return None


def create_online_order(
    cart_items: list,
    customer_email: str,
    customer_name: str,
    shipping_address: dict | None = None,
    saved_address_id: str | None = None,
    user_id: str | None = None,
    coupon_code: str | None = None,
    notes: str | None = None,
) -> dict:
    """オンライン注文を作成（顧客向け、認証不要）"""
    import uuid

    # 住所の取得・検証
    final_shipping_address = None

    if saved_address_id:
        # 登録済み住所を使用
        try:
            # customer_emailからユーザーを検索
            # user_idはCognito subなのでDynamoDBの検索には使えない
            user = find_user_by_email(customer_email)

            if user:
                saved_addresses = user.get("saved_addresses", [])
                for addr in saved_addresses:
                    if addr.get("address_id") == saved_address_id:
                        # 住所が見つかった
                        final_shipping_address = {
                            "name": addr.get("name"),
                            "postal_code": addr.get("postal_code"),
                            "prefecture": addr.get("prefecture"),
                            "city": addr.get("city"),
                            "address_line1": addr.get("address_line1"),
                            "address_line2": addr.get("address_line2", ""),
                            "phone_number": addr.get("phone_number"),
                        }
                        break

            if not final_shipping_address:
                # デバッグ情報を追加
                if user:
                    user_id_info = user.get("user_id", "unknown")
                    address_ids = [addr.get("address_id") for addr in saved_addresses]
                    debug_info = f"User found (user_id={user_id_info}, email={user.get('email')}, cognito_user_id={user.get('cognito_user_id')}), Available addresses: {address_ids}"
                else:
                    debug_info = f"User not found with email={customer_email}"

                raise HTTPException(
                    status_code=400,
                    detail=f"Saved address not found: {saved_address_id}. Debug: {debug_info}",
                )
        except HTTPException:
            raise
        except ClientError as e:
            raise HTTPException(
                status_code=500, detail=f"Failed to retrieve saved address: {str(e)}"
            ) from e
    elif shipping_address:
        # 直接指定された住所を使用
        final_shipping_address = shipping_address
    else:
        # どちらも指定されていない
        raise HTTPException(
            status_code=400,
            detail="Either shipping_address or saved_address_id must be provided",
        )

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

    # 送料計算（カート内の商品から最大送料を取得）
    shipping_fee = calculate_shipping_fee(cart_items_models)

    # 合計 = 小計 - 割引 + 送料
    total = subtotal - discount + Decimal(str(shipping_fee))

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
        "shipping_fee": Decimal(str(shipping_fee)),
        "total": Decimal(str(total)),
        "payment_method": "stripe_online",
        "status": "pending",
        "coupon_code": coupon_code or "",
        "customer_email": customer_email,
        "customer_name": customer_name,
        "shipping_address": final_shipping_address,
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
    """顧客メールアドレスから注文一覧を取得（10分以上経過したpending注文は除外）"""
    # DynamoDBのscanでcustomer_emailをフィルタ（本番環境ではGSI推奨）
    response = sales_table.scan(
        FilterExpression="customer_email = :email AND event_id = :eid",
        ExpressionAttributeValues={":email": customer_email, ":eid": "online"},
        Limit=limit,
    )

    # 現在時刻（ミリ秒）
    current_time_ms = int(time.time() * 1000)
    ten_minutes_ms = 10 * 60 * 1000  # 10分

    orders = []
    for item in response.get("Items", []):
        # クーポンは除外
        if item.get("sale_id", "").startswith("coupon_"):
            continue

        # pending かつ 10分以上経過した注文は除外
        if item.get("status") == "pending":
            order_timestamp = int(item.get("timestamp", 0))
            if current_time_ms - order_timestamp > ten_minutes_ms:
                continue

        orders.append(dynamo_to_dict(item))

    return orders


def update_order_payment_intent(
    order_id: str, payment_intent_id: str, payment_status: str | None = None
) -> dict | None:
    """注文のPaymentIntentとステータスを更新"""
    # DynamoDBから直接取得してtimestampを取得（Decimal型のまま）
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    if not items:
        return None

    order = items[0]
    timestamp = order["timestamp"]  # Decimal型のまま

    update_parts = ["stripe_payment_intent_id = :pi"]
    expression_values = {":pi": payment_intent_id}

    if payment_status:
        update_parts.append("stripe_payment_status = :ps")
        expression_values[":ps"] = payment_status

    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression=f"SET {', '.join(update_parts)}",
        ExpressionAttributeValues=expression_values,
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


def update_order_status(order_id: str, status: str) -> dict | None:
    """注文のステータスを更新"""
    # DynamoDBから直接取得してtimestampを取得（Decimal型のまま）
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    if not items:
        return None

    order = items[0]
    timestamp = order["timestamp"]  # Decimal型のまま

    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression="SET #st = :status",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":status": status},
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


def update_order_status_with_stripe(
    order_id: str,
    status: str,
    stripe_payment_status: str,
    card_brand: str | None = None,
) -> dict | None:
    """注文のステータスとStripe支払いステータスを更新"""
    # DynamoDBから直接取得してtimestampを取得（Decimal型のまま）
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    if not items:
        return None

    order = items[0]
    timestamp = order["timestamp"]  # Decimal型のまま

    update_parts = ["#st = :status", "stripe_payment_status = :stripe_status"]
    expression_values = {
        ":status": status,
        ":stripe_status": stripe_payment_status,
    }

    # カードブランド情報がある場合は追加
    if card_brand:
        update_parts.append("card_brand = :card_brand")
        expression_values[":card_brand"] = card_brand

    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression=f"SET {', '.join(update_parts)}",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues=expression_values,
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


def update_stripe_payment_status(
    order_id: str, stripe_payment_status: str
) -> dict | None:
    """注文のStripe支払いステータスのみ更新"""
    # DynamoDBから直接取得してtimestampを取得（Decimal型のまま）
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    if not items:
        return None

    order = items[0]
    timestamp = order["timestamp"]  # Decimal型のまま

    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression="SET stripe_payment_status = :stripe_status",
        ExpressionAttributeValues={":stripe_status": stripe_payment_status},
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


def update_shipping_info(
    order_id: str,
    tracking_number: str | None = None,
    carrier: str | None = None,
    shipping_method: str | None = None,
    shipping_method_other: str | None = None,
    notes: str | None = None,
) -> dict | None:
    """注文の発送情報を更新し、ステータスをSHIPPEDに変更"""
    # DynamoDBから直接取得してtimestampを取得（Decimal型のまま）
    response = sales_table.query(
        KeyConditionExpression="sale_id = :sid",
        ExpressionAttributeValues={":sid": order_id},
    )
    items = response.get("Items", [])
    if not items:
        return None

    order = items[0]
    timestamp = order["timestamp"]  # Decimal型のまま
    now = datetime.now(timezone.utc).isoformat()

    update_parts = ["#st = :status", "shipped_at = :shipped_at"]
    expression_values = {":status": "shipped", ":shipped_at": now}
    expression_names = {"#st": "status"}

    if tracking_number:
        update_parts.append("tracking_number = :tracking")
        expression_values[":tracking"] = tracking_number

    if carrier:
        update_parts.append("carrier = :carrier")
        expression_values[":carrier"] = carrier

    if shipping_method:
        update_parts.append("shipping_method = :shipping_method")
        expression_values[":shipping_method"] = shipping_method

    if shipping_method_other:
        update_parts.append("shipping_method_other = :shipping_method_other")
        expression_values[":shipping_method_other"] = shipping_method_other

    if notes:
        update_parts.append("shipping_notes = :notes")
        expression_values[":notes"] = notes

    response = sales_table.update_item(
        Key={"sale_id": order_id, "timestamp": timestamp},
        UpdateExpression=f"SET {', '.join(update_parts)}",
        ExpressionAttributeNames=expression_names,
        ExpressionAttributeValues=expression_values,
        ReturnValues="ALL_NEW",
    )
    return dynamo_to_dict(response["Attributes"])


# ==============================
# 送料設定管理
# ==============================


def get_all_shipping_options() -> list[dict]:
    """全送料設定を取得（is_active=Trueのみ）"""
    config = get_config("shipping_options")
    if not config:
        return []

    options = config.get("value", {}).get("options", [])
    # is_activeがTrueのもののみ返す
    return [opt for opt in options if opt.get("is_active", True)]


def get_shipping_option_by_id(shipping_option_id: str) -> dict | None:
    """IDで送料設定を取得"""
    config = get_config("shipping_options")
    if not config:
        return None

    options = config.get("value", {}).get("options", [])
    for opt in options:
        if opt.get("shipping_option_id") == shipping_option_id:
            return opt
    return None


def create_shipping_option(
    label: str, price: int, sort_order: int = 0, description: str = ""
) -> dict:
    """送料設定を作成"""
    import uuid

    shipping_option_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    new_option = {
        "shipping_option_id": shipping_option_id,
        "label": label,
        "price": price,
        "sort_order": sort_order,
        "description": description,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    # 既存の設定を取得
    config = get_config("shipping_options")
    if config:
        options = config.get("value", {}).get("options", [])
    else:
        options = []

    # 新しい設定を追加
    options.append(new_option)

    # 保存
    set_config("shipping_options", {"options": options})

    return new_option


def update_shipping_option(
    shipping_option_id: str,
    label: str | None = None,
    price: int | None = None,
    sort_order: int | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> dict | None:
    """送料設定を更新"""
    config = get_config("shipping_options")
    if not config:
        return None

    options = config.get("value", {}).get("options", [])
    updated_option = None

    for opt in options:
        if opt.get("shipping_option_id") == shipping_option_id:
            # 更新
            if label is not None:
                opt["label"] = label
            if price is not None:
                opt["price"] = price
            if sort_order is not None:
                opt["sort_order"] = sort_order
            if description is not None:
                opt["description"] = description
            if is_active is not None:
                opt["is_active"] = is_active

            opt["updated_at"] = datetime.now(timezone.utc).isoformat()
            updated_option = opt
            break

    if updated_option:
        set_config("shipping_options", {"options": options})

    return updated_option


def delete_shipping_option(shipping_option_id: str) -> bool:
    """送料設定を削除（論理削除: is_active=False）"""
    config = get_config("shipping_options")
    if not config:
        return False

    options = config.get("value", {}).get("options", [])
    deleted = False

    for opt in options:
        if opt.get("shipping_option_id") == shipping_option_id:
            opt["is_active"] = False
            opt["updated_at"] = datetime.now(timezone.utc).isoformat()
            deleted = True
            break

    if deleted:
        set_config("shipping_options", {"options": options})

    return deleted


def calculate_shipping_fee(cart_items: list[CartItem]) -> int:
    """カート内の商品から最大送料を計算"""
    max_shipping_fee = 0

    for item in cart_items:
        # 商品情報を取得
        product_response = stock_table.get_item(Key={"product_id": item.product_id})
        if "Item" not in product_response:
            continue

        product = product_response["Item"]
        shipping_option_id = product.get("shipping_option_id")

        # 送料設定がない場合はスキップ（送料無料）
        if not shipping_option_id:
            continue

        # 送料設定を取得
        shipping_option = get_shipping_option_by_id(shipping_option_id)
        if not shipping_option:
            continue

        # 最大送料を更新
        shipping_fee = shipping_option.get("price", 0)
        if shipping_fee > max_shipping_fee:
            max_shipping_fee = shipping_fee

    return max_shipping_fee


# ==============================
# Stripe Terminal サービス
# ==============================


def get_stripe_account_info() -> dict:
    """
    Stripeアカウント情報を取得（加盟店名など）

    Returns:
        {
            "merchant_name": "...",
            "business_name": "...",
            "statement_descriptor": "...",
        }
    """
    init_stripe()
    try:
        account = stripe.Account.retrieve()
        return {
            "merchant_name": account.settings.payments.statement_descriptor
            or account.business_profile.name
            or "",
            "business_name": account.business_profile.name or "",
            "statement_descriptor": account.settings.payments.statement_descriptor
            or "",
        }
    except Exception as e:
        import logging

        logging.error(f"Failed to get Stripe account info: {e}")
        return {
            "merchant_name": "",
            "business_name": "",
            "statement_descriptor": "",
        }


def create_terminal_connection_token(location_id: str | None = None) -> dict:
    """
    Stripe Terminal用のConnection Tokenを発行

    Args:
        location_id: オプションのロケーションID

    Returns:
        {"secret": "...", "object": "terminal.connection_token"}
    """
    init_stripe()
    params: dict = {}
    if location_id:
        params["location"] = location_id

    token = stripe.terminal.ConnectionToken.create(**params)
    return {"secret": token.secret, "object": token.object}


def register_terminal_reader(
    registration_code: str,
    label: str,
    location_id: str,
) -> dict:
    """
    Stripe Terminalにリーダーを登録

    Args:
        registration_code: リーダーの登録コード（ペアリング時に表示される）
        label: リーダーの識別名
        location_id: StripeのロケーションID

    Returns:
        登録されたリーダー情報
    """
    init_stripe()
    reader = stripe.terminal.Reader.create(
        registration_code=registration_code,
        label=label,
        location=location_id,
    )
    return {
        "id": reader.id,
        "label": reader.label,
        "location": reader.location,
        "device_type": reader.device_type,
        "status": reader.status,
        "serial_number": reader.serial_number,
    }


def list_terminal_readers(location_id: str | None = None) -> list[dict]:
    """
    登録済みのリーダー一覧を取得

    Args:
        location_id: フィルタリング用のロケーションID

    Returns:
        リーダー情報のリスト
    """
    init_stripe()
    params: dict = {"limit": 100}
    if location_id:
        params["location"] = location_id

    readers = stripe.terminal.Reader.list(**params)
    return [
        {
            "id": r.id,
            "label": r.label,
            "location": r.location,
            "device_type": r.device_type,
            "status": r.status,
            "serial_number": r.serial_number,
        }
        for r in readers.data
    ]


def delete_terminal_reader(reader_id: str) -> bool:
    """
    リーダーを削除

    Args:
        reader_id: 削除するリーダーのID

    Returns:
        削除成功かどうか
    """
    init_stripe()
    result = stripe.terminal.Reader.delete(reader_id)
    return result.deleted


def create_terminal_payment_intent(
    amount: int,
    currency: str = "jpy",
    description: str | None = None,
    metadata: dict | None = None,
) -> dict:
    """
    Stripe Terminal用のPaymentIntentを作成

    capture_method="manual"で作成し、後でキャプチャする

    Args:
        amount: 金額（最小通貨単位、日本円ならそのまま円）
        currency: 通貨コード
        description: 説明
        metadata: メタデータ

    Returns:
        PaymentIntent情報
    """
    init_stripe()
    params: dict = {
        "amount": amount,
        "currency": currency,
        "payment_method_types": ["card_present"],
        "capture_method": "manual",  # Terminal用は手動キャプチャ
    }

    if description:
        params["description"] = description
    if metadata:
        params["metadata"] = metadata

    intent = stripe.PaymentIntent.create(**params)
    return {
        "id": intent.id,
        "client_secret": intent.client_secret,
        "amount": intent.amount,
        "currency": intent.currency,
        "status": intent.status,
    }


def capture_terminal_payment_intent(payment_intent_id: str) -> dict:
    """
    Terminal PaymentIntentをキャプチャ（確定）

    Args:
        payment_intent_id: キャプチャするPaymentIntentのID

    Returns:
        更新されたPaymentIntent情報
    """
    init_stripe()
    intent = stripe.PaymentIntent.capture(payment_intent_id)
    return {
        "id": intent.id,
        "amount": intent.amount,
        "amount_received": intent.amount_received,
        "currency": intent.currency,
        "status": intent.status,
    }


def cancel_terminal_payment_intent(payment_intent_id: str) -> dict:
    """
    Terminal PaymentIntentをキャンセル

    Args:
        payment_intent_id: キャンセルするPaymentIntentのID

    Returns:
        キャンセルされたPaymentIntent情報
    """
    init_stripe()
    intent = stripe.PaymentIntent.cancel(payment_intent_id)
    return {
        "id": intent.id,
        "amount": intent.amount,
        "currency": intent.currency,
        "status": intent.status,
    }


def create_terminal_refund(
    payment_intent_id: str,
    amount: int | None = None,
    reason: str | None = None,
) -> dict:
    """
    Stripe Terminal決済の返金を処理

    Args:
        payment_intent_id: 返金対象のPaymentIntentID
        amount: 返金額（Noneなら全額返金）
        reason: 返金理由

    Returns:
        Refund情報
    """
    init_stripe()
    params: dict = {"payment_intent": payment_intent_id}

    if amount:
        params["amount"] = amount
    if reason:
        params["reason"] = reason

    refund = stripe.Refund.create(**params)
    return {
        "id": refund.id,
        "amount": refund.amount,
        "currency": refund.currency,
        "status": refund.status,
        "payment_intent": refund.payment_intent,
        "reason": refund.reason,
    }


def get_payment_intent_for_refund(payment_intent_id: str) -> dict | None:
    """
    返金用にPaymentIntent情報を取得

    Args:
        payment_intent_id: PaymentIntentID

    Returns:
        PaymentIntent情報（返金可能かどうかを含む）
    """
    init_stripe()
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {
            "id": intent.id,
            "amount": intent.amount,
            "amount_received": intent.amount_received,
            "currency": intent.currency,
            "status": intent.status,
            "refundable": intent.status == "succeeded",
            "metadata": dict(intent.metadata) if intent.metadata else {},
        }
    except stripe._error.StripeError:
        return None


def create_terminal_location(
    display_name: str,
    address_line1: str,
    city: str,
    state: str,
    country: str,
    postal_code: str,
) -> dict:
    """
    Stripe Terminalのロケーションを作成

    Args:
        display_name: 表示名
        address_line1: 住所1行目
        city: 市区町村
        state: 都道府県
        country: 国コード（JP）
        postal_code: 郵便番号

    Returns:
        作成されたロケーション情報
    """
    init_stripe()
    location = stripe.terminal.Location.create(
        display_name=display_name,
        address={
            "line1": address_line1,
            "city": city,
            "state": state,
            "country": country,
            "postal_code": postal_code,
        },
    )
    return {
        "id": location.id,
        "display_name": location.display_name,
        "address": dict(location.address),
    }


def list_terminal_locations() -> list[dict]:
    """
    登録済みのロケーション一覧を取得

    Returns:
        ロケーション情報のリスト
    """
    init_stripe()
    locations = stripe.terminal.Location.list(limit=100)
    return [
        {
            "id": loc.id,
            "display_name": loc.display_name,
            "address": dict(loc.address),
        }
        for loc in locations.data
    ]


# ==============================
# Terminal Pairing サービス
# ==============================

# 環境変数（ペアリング用）
TERMINAL_PAIRING_TABLE = os.environ.get(
    "TERMINAL_PAIRING_TABLE", f"{ENVIRONMENT}-mizpos-terminal-pairing"
)
TERMINAL_PAYMENT_REQUESTS_TABLE = os.environ.get(
    "TERMINAL_PAYMENT_REQUESTS_TABLE", f"{ENVIRONMENT}-mizpos-terminal-payment-requests"
)

# テーブル参照（遅延初期化）
_terminal_pairing_table = None
_terminal_payment_requests_table = None


def get_terminal_pairing_table():
    """ペアリングテーブルを遅延初期化"""
    global _terminal_pairing_table
    if _terminal_pairing_table is None:
        _terminal_pairing_table = dynamodb.Table(TERMINAL_PAIRING_TABLE)
    return _terminal_pairing_table


def get_terminal_payment_requests_table():
    """決済リクエストテーブルを遅延初期化"""
    global _terminal_payment_requests_table
    if _terminal_payment_requests_table is None:
        _terminal_payment_requests_table = dynamodb.Table(
            TERMINAL_PAYMENT_REQUESTS_TABLE
        )
    return _terminal_payment_requests_table


# ペアリング有効期限（24時間）
PAIRING_TTL_SECONDS = 24 * 60 * 60


def register_terminal_pairing(
    pin_code: str,
    pos_id: str,
    pos_name: str,
    event_id: str | None = None,
    event_name: str | None = None,
) -> dict:
    """
    ターミナルペアリングを登録（デスクトップ側から呼び出し）

    Args:
        pin_code: 6桁のPINコード
        pos_id: POS端末ID
        pos_name: POS端末名
        event_id: イベントID（オプション）
        event_name: イベント名（オプション）

    Returns:
        登録されたペアリング情報
    """
    table = get_terminal_pairing_table()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = now.timestamp() + PAIRING_TTL_SECONDS
    expires_at_iso = datetime.fromtimestamp(expires_at, timezone.utc).isoformat()

    # 既存のPINコードがあれば上書き
    pairing_item = {
        "pin_code": pin_code,
        "pos_id": pos_id,
        "pos_name": pos_name,
        "event_id": event_id or "",
        "event_name": event_name or "",
        "created_at": now_iso,
        "expires_at": expires_at_iso,
        "ttl": int(expires_at),  # DynamoDB TTL用
    }

    table.put_item(Item=pairing_item)

    return {
        "pin_code": pin_code,
        "pos_id": pos_id,
        "pos_name": pos_name,
        "event_id": event_id,
        "event_name": event_name,
        "created_at": now_iso,
        "expires_at": expires_at_iso,
    }


def verify_terminal_pairing(pin_code: str) -> dict | None:
    """
    ターミナルペアリングを検証（ターミナル側から呼び出し）

    検証成功時に terminal_connected フラグを True に更新する

    Args:
        pin_code: 6桁のPINコード

    Returns:
        ペアリング情報（有効な場合）、または None
    """
    table = get_terminal_pairing_table()
    response = table.get_item(Key={"pin_code": pin_code})
    item = response.get("Item")

    if not item:
        return None

    # 有効期限チェック
    expires_at = datetime.fromisoformat(item["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        # 期限切れ
        return None

    # terminal_connected フラグを更新
    connected_at = datetime.now(timezone.utc).isoformat()
    table.update_item(
        Key={"pin_code": pin_code},
        UpdateExpression="SET terminal_connected = :connected, terminal_connected_at = :connected_at",
        ExpressionAttributeValues={
            ":connected": True,
            ":connected_at": connected_at,
        },
    )

    return {
        "pin_code": item["pin_code"],
        "pos_id": item["pos_id"],
        "pos_name": item["pos_name"],
        "event_id": item.get("event_id") or None,
        "event_name": item.get("event_name") or None,
        "created_at": item["created_at"],
        "expires_at": item["expires_at"],
        "terminal_connected": True,
        "terminal_connected_at": connected_at,
    }


def get_terminal_pairing_status(pin_code: str) -> dict | None:
    """
    ターミナルペアリング状態を取得（デスクトップ側からポーリング用）

    Args:
        pin_code: 6桁のPINコード

    Returns:
        ペアリング情報（terminal_connected フラグ含む）、または None
    """
    table = get_terminal_pairing_table()
    response = table.get_item(Key={"pin_code": pin_code})
    item = response.get("Item")

    if not item:
        return None

    # 有効期限チェック
    expires_at = datetime.fromisoformat(item["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        # 期限切れ
        return None

    return {
        "pin_code": item["pin_code"],
        "pos_id": item["pos_id"],
        "pos_name": item["pos_name"],
        "event_id": item.get("event_id") or None,
        "event_name": item.get("event_name") or None,
        "created_at": item["created_at"],
        "expires_at": item["expires_at"],
        "terminal_connected": item.get("terminal_connected", False),
        "terminal_connected_at": item.get("terminal_connected_at"),
    }


def delete_terminal_pairing(pin_code: str) -> bool:
    """
    ターミナルペアリングを解除

    Args:
        pin_code: 6桁のPINコード

    Returns:
        削除成功かどうか
    """
    table = get_terminal_pairing_table()

    # 存在確認
    response = table.get_item(Key={"pin_code": pin_code})
    if not response.get("Item"):
        return False

    table.delete_item(Key={"pin_code": pin_code})
    return True


# ==============================
# Terminal Payment Request サービス
# ==============================

# 決済リクエスト有効期限（5分）
PAYMENT_REQUEST_TTL_SECONDS = 5 * 60


def create_payment_request(
    pin_code: str,
    amount: int,
    currency: str = "jpy",
    description: str | None = None,
    sale_id: str | None = None,
    items: list | None = None,
) -> dict:
    """
    決済リクエストを作成（デスクトップ側から呼び出し）

    Args:
        pin_code: ペアリングPINコード
        amount: 決済金額
        currency: 通貨コード
        description: 説明
        sale_id: 販売ID
        items: 商品リスト

    Returns:
        作成された決済リクエスト
    """
    import uuid

    # ペアリング確認
    pairing = verify_terminal_pairing(pin_code)
    if not pairing:
        raise HTTPException(status_code=404, detail="Pairing not found or expired")

    table = get_terminal_payment_requests_table()
    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    expires_at = now.timestamp() + PAYMENT_REQUEST_TTL_SECONDS

    request_item = {
        "request_id": request_id,
        "pin_code": pin_code,
        "amount": amount,
        "currency": currency,
        "description": description or "",
        "sale_id": sale_id or "",
        "items": items or [],
        "status": "pending",
        "payment_intent_id": "",
        "error_message": "",
        "created_at": now_iso,
        "updated_at": now_iso,
        "ttl": int(expires_at),  # DynamoDB TTL用
    }

    table.put_item(Item=request_item)

    return {
        "request_id": request_id,
        "pin_code": pin_code,
        "amount": amount,
        "currency": currency,
        "description": description,
        "sale_id": sale_id,
        "items": items,
        "status": "pending",
        "payment_intent_id": None,
        "error_message": None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }


def get_pending_payment_request(pin_code: str) -> dict | None:
    """
    ペンディング状態の決済リクエストを取得（ターミナル側からポーリング）

    Args:
        pin_code: ペアリングPINコード

    Returns:
        ペンディング状態の決済リクエスト（存在する場合）
    """
    table = get_terminal_payment_requests_table()

    # PINコードでフィルタしてpending状態のリクエストを取得
    # GSIを使用する場合はそちらを優先（ここではスキャン）
    response = table.scan(
        FilterExpression="pin_code = :pin AND #st = :status",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":pin": pin_code, ":status": "pending"},
    )

    items = response.get("Items", [])
    if not items:
        return None

    # 最新のリクエストを返す（created_atでソート）
    sorted_items = sorted(items, key=lambda x: x["created_at"], reverse=True)
    item = sorted_items[0]

    return dynamo_to_dict(
        {
            "request_id": item["request_id"],
            "pin_code": item["pin_code"],
            "amount": item["amount"],
            "currency": item["currency"],
            "description": item.get("description") or None,
            "sale_id": item.get("sale_id") or None,
            "items": item.get("items") or None,
            "status": item["status"],
            "payment_intent_id": item.get("payment_intent_id") or None,
            "error_message": item.get("error_message") or None,
            "created_at": item["created_at"],
            "updated_at": item["updated_at"],
        }
    )


def get_payment_request(request_id: str) -> dict | None:
    """
    決済リクエストを取得

    Args:
        request_id: リクエストID

    Returns:
        決済リクエスト情報
    """
    table = get_terminal_payment_requests_table()
    response = table.get_item(Key={"request_id": request_id})
    item = response.get("Item")

    if not item:
        return None

    return dynamo_to_dict(
        {
            "request_id": item["request_id"],
            "pin_code": item["pin_code"],
            "amount": item["amount"],
            "currency": item["currency"],
            "description": item.get("description") or None,
            "sale_id": item.get("sale_id") or None,
            "items": item.get("items") or None,
            "status": item["status"],
            "payment_intent_id": item.get("payment_intent_id") or None,
            "error_message": item.get("error_message") or None,
            "card_details": item.get("card_details") or None,
            "created_at": item["created_at"],
            "updated_at": item["updated_at"],
        }
    )


def update_payment_request_result(
    request_id: str,
    status: str,
    payment_intent_id: str | None = None,
    error_message: str | None = None,
    card_details: dict | None = None,
) -> dict | None:
    """
    決済リクエストの結果を更新（ターミナル側から呼び出し）

    Args:
        request_id: リクエストID
        status: ステータス（completed, failed, cancelled）
        payment_intent_id: Stripe PaymentIntent ID
        error_message: エラーメッセージ
        card_details: カード詳細情報（レシート表示用）

    Returns:
        更新された決済リクエスト
    """
    table = get_terminal_payment_requests_table()
    now_iso = datetime.now(timezone.utc).isoformat()

    update_parts = ["#st = :status", "updated_at = :updated_at"]
    expression_values = {":status": status, ":updated_at": now_iso}
    expression_names = {"#st": "status"}

    if payment_intent_id:
        update_parts.append("payment_intent_id = :pi")
        expression_values[":pi"] = payment_intent_id

    if error_message:
        update_parts.append("error_message = :err")
        expression_values[":err"] = error_message

    if card_details:
        update_parts.append("card_details = :cd")
        expression_values[":cd"] = card_details

    try:
        response = table.update_item(
            Key={"request_id": request_id},
            UpdateExpression=f"SET {', '.join(update_parts)}",
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW",
        )
        return dynamo_to_dict(response["Attributes"])
    except ClientError:
        return None


def cancel_payment_request(request_id: str) -> bool:
    """
    決済リクエストをキャンセル

    Args:
        request_id: リクエストID

    Returns:
        キャンセル成功かどうか
    """
    result = update_payment_request_result(request_id, "cancelled")
    return result is not None
