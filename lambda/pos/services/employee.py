"""
POS従業員管理サービス
POS端末専用の簡易認証システム
"""

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import boto3
from botocore.exceptions import ClientError

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
POS_EMPLOYEES_TABLE = os.environ.get(
    "POS_EMPLOYEES_TABLE", f"{ENVIRONMENT}-mizpos-pos-employees"
)
POS_SESSIONS_TABLE = os.environ.get(
    "POS_SESSIONS_TABLE", f"{ENVIRONMENT}-mizpos-pos-sessions"
)
OFFLINE_SALES_QUEUE_TABLE = os.environ.get(
    "OFFLINE_SALES_QUEUE_TABLE", f"{ENVIRONMENT}-mizpos-offline-sales-queue"
)
PUBLISHERS_TABLE = os.environ.get(
    "PUBLISHERS_TABLE", f"{ENVIRONMENT}-mizpos-publishers"
)
ROLES_TABLE = os.environ.get("ROLES_TABLE", f"{ENVIRONMENT}-mizpos-roles")
SALES_TABLE = os.environ.get("SALES_TABLE", f"{ENVIRONMENT}-mizpos-sales")
STOCK_TABLE = os.environ.get("STOCK_TABLE", f"{ENVIRONMENT}-mizpos-stock")
COUPONS_TABLE = os.environ.get("COUPONS_TABLE", f"{ENVIRONMENT}-mizpos-coupons")

# セッション有効期間（秒）: 12時間
SESSION_EXPIRY_SECONDS = 12 * 60 * 60

# PINハッシュ用のシークレットキー
PIN_SECRET_KEY = os.environ.get("POS_PIN_SECRET_KEY", "default-secret-key-change-me")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
pos_employees_table = dynamodb.Table(POS_EMPLOYEES_TABLE)
pos_sessions_table = dynamodb.Table(POS_SESSIONS_TABLE)
offline_sales_queue_table = dynamodb.Table(OFFLINE_SALES_QUEUE_TABLE)
publishers_table = dynamodb.Table(PUBLISHERS_TABLE)
roles_table = dynamodb.Table(ROLES_TABLE)
sales_table = dynamodb.Table(SALES_TABLE)
stock_table = dynamodb.Table(STOCK_TABLE)
coupons_table = dynamodb.Table(COUPONS_TABLE)


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""
    result = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            if value % 1 == 0:
                result[key] = int(value)
            else:
                result[key] = float(value)
        else:
            result[key] = value
    return result


def hash_pin(pin: str, employee_number: str) -> str:
    """PINをハッシュ化"""
    message = f"{employee_number}:{pin}".encode("utf-8")
    key = PIN_SECRET_KEY.encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def verify_pin(pin: str, employee_number: str, hashed_pin: str) -> bool:
    """PINを検証"""
    return hmac.compare_digest(hash_pin(pin, employee_number), hashed_pin)


def generate_offline_verification_hash(
    session_id: str, employee_number: str, expires_at: int
) -> str:
    """オフライン検証用ハッシュを生成"""
    message = f"{session_id}:{employee_number}:{expires_at}".encode("utf-8")
    key = PIN_SECRET_KEY.encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def get_user_circles(user_id: str) -> list[dict]:
    """ユーザーに紐づくサークル情報のリストを取得"""
    if not user_id:
        return []

    response = roles_table.query(
        KeyConditionExpression="user_id = :user_id",
        FilterExpression="role_type IN (:admin, :sales)",
        ExpressionAttributeValues={
            ":user_id": user_id,
            ":admin": "publisher_admin",
            ":sales": "publisher_sales",
        },
    )

    publisher_ids = set()
    for role in response.get("Items", []):
        if "publisher_id" in role and role["publisher_id"]:
            publisher_ids.add(role["publisher_id"])

    circles = []
    for publisher_id in publisher_ids:
        try:
            pub_response = publishers_table.get_item(Key={"publisher_id": publisher_id})
            if "Item" in pub_response:
                item = dynamo_to_dict(pub_response["Item"])
                circles.append(
                    {
                        "publisher_id": item["publisher_id"],
                        "name": item.get("name", ""),
                    }
                )
        except ClientError:
            continue

    return circles


# ==========================================
# POS認証・セッション管理
# ==========================================


def authenticate_pos_employee(
    employee_number: str, pin: str, terminal_id: str
) -> Optional[dict]:
    """POS従業員を認証してセッションを作成"""
    response = pos_employees_table.get_item(Key={"employee_number": employee_number})
    if "Item" not in response:
        return None

    employee = response["Item"]

    if not employee.get("active", True):
        return None

    if not verify_pin(pin, employee_number, employee["pin_hash"]):
        return None

    # 既存のセッションを無効化
    invalidate_terminal_sessions(terminal_id)

    # 新しいセッションを作成
    session_id = str(uuid.uuid4())
    now = int(datetime.now(timezone.utc).timestamp())
    expires_at = now + SESSION_EXPIRY_SECONDS

    session_item = {
        "session_id": session_id,
        "employee_number": employee_number,
        "terminal_id": terminal_id,
        "display_name": employee["display_name"],
        "event_id": employee.get("event_id"),
        "publisher_id": employee.get("publisher_id"),
        "created_at": now,
        "expires_at": expires_at,
    }

    pos_sessions_table.put_item(Item=session_item)

    offline_hash = generate_offline_verification_hash(
        session_id, employee_number, expires_at
    )

    circles = []
    user_id = employee.get("user_id")
    if user_id:
        circles = get_user_circles(user_id)

    return {
        "session_id": session_id,
        "employee_number": employee_number,
        "display_name": employee["display_name"],
        "event_id": employee.get("event_id"),
        "publisher_id": employee.get("publisher_id"),
        "circles": circles,
        "expires_at": expires_at,
        "offline_verification_hash": offline_hash,
    }


def verify_pos_session(session_id: str) -> Optional[dict]:
    """POSセッションを検証"""
    response = pos_sessions_table.get_item(Key={"session_id": session_id})
    if "Item" not in response:
        return None

    session = dynamo_to_dict(response["Item"])

    now = int(datetime.now(timezone.utc).timestamp())
    if session["expires_at"] < now:
        return None

    return session


def refresh_pos_session(session_id: str) -> Optional[dict]:
    """POSセッションを延長"""
    session = verify_pos_session(session_id)
    if not session:
        return None

    now = int(datetime.now(timezone.utc).timestamp())
    new_expires_at = now + SESSION_EXPIRY_SECONDS

    pos_sessions_table.update_item(
        Key={"session_id": session_id},
        UpdateExpression="SET expires_at = :exp",
        ExpressionAttributeValues={":exp": new_expires_at},
    )

    session["expires_at"] = new_expires_at
    session["offline_verification_hash"] = generate_offline_verification_hash(
        session_id, session["employee_number"], new_expires_at
    )

    return session


def set_session_event(session_id: str, event_id: str) -> Optional[dict]:
    """POSセッションにイベントIDを設定"""
    session = verify_pos_session(session_id)
    if not session:
        return None

    pos_sessions_table.update_item(
        Key={"session_id": session_id},
        UpdateExpression="SET event_id = :eid",
        ExpressionAttributeValues={":eid": event_id},
    )

    session["event_id"] = event_id
    return session


def invalidate_session(session_id: str) -> bool:
    """セッションを無効化（ログアウト）"""
    try:
        pos_sessions_table.delete_item(Key={"session_id": session_id})
        return True
    except ClientError:
        return False


def invalidate_terminal_sessions(terminal_id: str) -> None:
    """端末の全セッションを無効化"""
    response = pos_sessions_table.scan(
        FilterExpression="terminal_id = :tid",
        ExpressionAttributeValues={":tid": terminal_id},
    )

    for session in response.get("Items", []):
        pos_sessions_table.delete_item(Key={"session_id": session["session_id"]})


# ==========================================
# オフライン販売同期
# ==========================================


def get_pending_offline_sales(terminal_id: str) -> list[dict]:
    """端末の未同期販売を取得"""
    response = offline_sales_queue_table.query(
        IndexName="TerminalIndex",
        KeyConditionExpression="terminal_id = :tid",
        FilterExpression="sync_status = :status",
        ExpressionAttributeValues={":tid": terminal_id, ":status": "pending"},
    )

    return [dynamo_to_dict(item) for item in response.get("Items", [])]


def mark_offline_sale_synced(queue_id: str, created_at: int) -> None:
    """オフライン販売を同期済みにマーク"""
    offline_sales_queue_table.update_item(
        Key={"queue_id": queue_id, "created_at": created_at},
        UpdateExpression="SET sync_status = :status, synced_at = :synced",
        ExpressionAttributeValues={
            ":status": "synced",
            ":synced": int(datetime.now(timezone.utc).timestamp()),
        },
    )


def mark_offline_sale_failed(queue_id: str, created_at: int, error: str) -> None:
    """オフライン販売を同期失敗にマーク"""
    offline_sales_queue_table.update_item(
        Key={"queue_id": queue_id, "created_at": created_at},
        UpdateExpression="SET sync_status = :status, error_message = :err",
        ExpressionAttributeValues={":status": "failed", ":err": error},
    )


def save_offline_sale_to_db(sale_data: dict) -> dict:
    """オフライン販売データをDBに保存"""
    sale_id = sale_data.get("sale_id")
    if not sale_id:
        sale_id = str(uuid.uuid4())

    timestamp = sale_data.get("timestamp")
    if not timestamp:
        timestamp = int(datetime.now(timezone.utc).timestamp())

    now_iso = datetime.now(timezone.utc).isoformat()

    sale_items = []
    for item in sale_data.get("items", []):
        product_id = item.get("product_id")
        if not product_id and "product" in item:
            product_id = item["product"].get("product_id")

        quantity = item.get("quantity", 1)

        unit_price = item.get("unit_price")
        if unit_price is None:
            subtotal = item.get("subtotal", 0)
            unit_price = subtotal // quantity if quantity > 0 else 0

        if unit_price is None or unit_price == 0:
            if "product" in item:
                unit_price = item["product"].get("price", 0)

        sale_items.append(
            {
                "product_id": product_id,
                "quantity": quantity,
                "unit_price": Decimal(str(unit_price)),
                "subtotal": Decimal(str(unit_price * quantity)),
            }
        )

    sale_item = {
        "sale_id": sale_id,
        "timestamp": timestamp,
        "items": sale_items,
        "total_amount": Decimal(str(sale_data.get("total_amount", 0))),
        "payment_method": sale_data.get("payment_method", "cash"),
        "status": "completed",
        "employee_number": sale_data.get("employee_number", "unknown"),
        "terminal_id": sale_data.get("terminal_id"),
        "source": "pos_offline",
        "created_at": now_iso,
        "synced_at": now_iso,
    }

    if sale_data.get("event_id"):
        sale_item["event_id"] = sale_data["event_id"]

    sales_table.put_item(Item=sale_item)

    return {
        "sale_id": sale_id,
        "timestamp": timestamp,
        "total_amount": int(sale_data.get("total_amount", 0)),
        "status": "completed",
    }


# ==========================================
# POS販売記録（リアルタイム）
# ==========================================


def record_pos_sale(
    session_id: str,
    items: list[dict],
    total_amount: int,
    payment_method: str,
    event_id: Optional[str] = None,
    terminal_id: Optional[str] = None,
    coupon_code: Optional[str] = None,
    subtotal: Optional[int] = None,
) -> dict:
    """POS端末からの販売をリアルタイムで記録"""
    from services.coupon import calculate_discount, increment_usage_count, validate_coupon

    session = verify_pos_session(session_id)
    if not session:
        raise ValueError("Invalid or expired session")

    # クーポン処理
    coupon_info = None
    discount_amount = 0
    if coupon_code:
        actual_subtotal = subtotal if subtotal is not None else total_amount
        coupon, error = validate_coupon(
            code=coupon_code,
            subtotal=actual_subtotal,
            publisher_id=session.get("publisher_id"),
            event_id=event_id or session.get("event_id"),
        )
        if error:
            raise ValueError(f"クーポンエラー: {error}")

        discount_amount = calculate_discount(coupon, actual_subtotal)
        coupon_info = {
            "coupon_id": coupon["coupon_id"],
            "code": coupon["code"],
            "discount_amount": discount_amount,
        }

        increment_usage_count(coupon["coupon_id"])

    sale_id = str(uuid.uuid4())
    now = int(datetime.now(timezone.utc).timestamp())
    now_iso = datetime.now(timezone.utc).isoformat()

    # 在庫を減らし、販売詳細を構築
    sale_items = []
    for item in items:
        product_id = item["product_id"]
        quantity = item["quantity"]
        unit_price = item["unit_price"]

        # 在庫を減らす
        try:
            stock_table.update_item(
                Key={"product_id": product_id},
                UpdateExpression="SET stock = stock - :qty, updated_at = :updated",
                ExpressionAttributeValues={
                    ":qty": quantity,
                    ":updated": now_iso,
                },
                ConditionExpression="stock >= :qty",
            )
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                pass  # 在庫不足は無視（対面販売）
            else:
                raise

        sale_item_data = {
            "product_id": product_id,
            "quantity": quantity,
            "unit_price": Decimal(str(unit_price)),
            "subtotal": Decimal(str(unit_price * quantity)),
        }

        if item.get("product_name"):
            sale_item_data["product_name"] = item["product_name"]
        if item.get("circle_name"):
            sale_item_data["circle_name"] = item["circle_name"]
        if item.get("jan"):
            sale_item_data["jan"] = item["jan"]
        if item.get("jan2"):
            sale_item_data["jan2"] = item["jan2"]
        if item.get("isbn"):
            sale_item_data["isbn"] = item["isbn"]
        if item.get("isdn"):
            sale_item_data["isdn"] = item["isdn"]

        sale_items.append(sale_item_data)

    sale_item = {
        "sale_id": sale_id,
        "timestamp": now,
        "items": sale_items,
        "total_amount": Decimal(str(total_amount)),
        "payment_method": payment_method,
        "status": "completed",
        "employee_number": session["employee_number"],
        "terminal_id": terminal_id or session.get("terminal_id"),
        "source": "pos",
        "created_at": now_iso,
    }

    if event_id:
        sale_item["event_id"] = event_id

    if coupon_info:
        sale_item["coupon_code"] = coupon_info["code"]
        sale_item["coupon_id"] = coupon_info["coupon_id"]
        sale_item["discount_amount"] = Decimal(str(coupon_info["discount_amount"]))
        if subtotal is not None:
            sale_item["subtotal"] = Decimal(str(subtotal))

    sales_table.put_item(Item=sale_item)

    result = {
        "sale_id": sale_id,
        "timestamp": now,
        "total_amount": total_amount,
        "status": "completed",
    }

    if coupon_info:
        result["coupon_code"] = coupon_info["code"]
        result["discount_amount"] = coupon_info["discount_amount"]

    return result
