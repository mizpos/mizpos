"""
POS従業員管理サービス
mizpos-desktop専用の簡易認証システム
"""

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

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

# セッション有効期間（秒）: 12時間
SESSION_EXPIRY_SECONDS = 12 * 60 * 60

# PINハッシュ用のシークレットキー（環境変数から取得、なければランダム生成）
PIN_SECRET_KEY = os.environ.get("POS_PIN_SECRET_KEY", "default-secret-key-change-me")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
pos_employees_table = dynamodb.Table(POS_EMPLOYEES_TABLE)
pos_sessions_table = dynamodb.Table(POS_SESSIONS_TABLE)
offline_sales_queue_table = dynamodb.Table(OFFLINE_SALES_QUEUE_TABLE)


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""
    result = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            # 整数として表現できる場合は整数に
            if value % 1 == 0:
                result[key] = int(value)
            else:
                result[key] = float(value)
        else:
            result[key] = value
    return result


def hash_pin(pin: str, employee_number: str) -> str:
    """PINをハッシュ化

    Args:
        pin: 平文のPIN
        employee_number: 従業員番号（ソルトとして使用）

    Returns:
        ハッシュ化されたPIN
    """
    # HMAC-SHA256でハッシュ化
    message = f"{employee_number}:{pin}".encode("utf-8")
    key = PIN_SECRET_KEY.encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def verify_pin(pin: str, employee_number: str, hashed_pin: str) -> bool:
    """PINを検証

    Args:
        pin: 入力されたPIN
        employee_number: 従業員番号
        hashed_pin: 保存されているハッシュ化PIN

    Returns:
        PINが正しい場合True
    """
    return hmac.compare_digest(hash_pin(pin, employee_number), hashed_pin)


def generate_offline_verification_hash(
    session_id: str, employee_number: str, expires_at: int
) -> str:
    """オフライン検証用ハッシュを生成

    オフラインモードでもセッションを検証できるようにするためのハッシュ

    Args:
        session_id: セッションID
        employee_number: 従業員番号
        expires_at: 有効期限（Unix timestamp）

    Returns:
        検証用ハッシュ
    """
    message = f"{session_id}:{employee_number}:{expires_at}".encode("utf-8")
    key = PIN_SECRET_KEY.encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


# ==========================================
# POS従業員管理
# ==========================================


def create_pos_employee(
    employee_number: str,
    pin: str,
    display_name: str,
    event_id: str | None = None,
    publisher_id: str | None = None,
) -> dict:
    """POS従業員を作成

    Args:
        employee_number: 7桁の従業員番号
        pin: 3〜8桁の数字PIN
        display_name: 表示名
        event_id: 紐付くイベントID（オプション）
        publisher_id: 紐付くサークルID（オプション）

    Returns:
        作成された従業員データ

    Raises:
        ValueError: 従業員番号が既に存在する場合
    """
    # 重複チェック
    existing = pos_employees_table.get_item(Key={"employee_number": employee_number})
    if "Item" in existing:
        raise ValueError(f"従業員番号 {employee_number} は既に使用されています")

    now = datetime.now(timezone.utc).isoformat()
    hashed_pin = hash_pin(pin, employee_number)

    item = {
        "employee_number": employee_number,
        "pin_hash": hashed_pin,
        "display_name": display_name,
        "active": True,
        "created_at": now,
        "updated_at": now,
    }

    # GSI用のフィールド（設定されている場合のみ）
    if event_id:
        item["event_id"] = event_id
    if publisher_id:
        item["publisher_id"] = publisher_id

    pos_employees_table.put_item(Item=item)

    # レスポンス用にpin_hashを除外
    return {
        "employee_number": employee_number,
        "display_name": display_name,
        "event_id": event_id,
        "publisher_id": publisher_id,
        "active": True,
        "created_at": now,
        "updated_at": now,
    }


def get_pos_employee(employee_number: str) -> dict | None:
    """POS従業員を取得

    Args:
        employee_number: 従業員番号

    Returns:
        従業員データ（pin_hash除外）、存在しない場合はNone
    """
    response = pos_employees_table.get_item(Key={"employee_number": employee_number})
    if "Item" not in response:
        return None

    item = dynamo_to_dict(response["Item"])
    # pin_hashはレスポンスに含めない
    item.pop("pin_hash", None)
    return item


def list_pos_employees(
    event_id: str | None = None, publisher_id: str | None = None
) -> list[dict]:
    """POS従業員一覧を取得

    Args:
        event_id: イベントIDでフィルタ（オプション）
        publisher_id: サークルIDでフィルタ（オプション）

    Returns:
        従業員データのリスト（pin_hash除外）
    """
    if event_id:
        response = pos_employees_table.query(
            IndexName="EventIndex",
            KeyConditionExpression="event_id = :eid",
            ExpressionAttributeValues={":eid": event_id},
        )
    elif publisher_id:
        response = pos_employees_table.query(
            IndexName="PublisherIndex",
            KeyConditionExpression="publisher_id = :pid",
            ExpressionAttributeValues={":pid": publisher_id},
        )
    else:
        response = pos_employees_table.scan()

    items = []
    for item in response.get("Items", []):
        employee = dynamo_to_dict(item)
        employee.pop("pin_hash", None)
        items.append(employee)

    return items


def update_pos_employee(
    employee_number: str,
    display_name: str | None = None,
    pin: str | None = None,
    event_id: str | None = None,
    publisher_id: str | None = None,
    active: bool | None = None,
) -> dict | None:
    """POS従業員を更新

    Args:
        employee_number: 従業員番号
        display_name: 表示名（オプション）
        pin: 新しいPIN（オプション）
        event_id: イベントID（オプション）
        publisher_id: サークルID（オプション）
        active: 有効/無効フラグ（オプション）

    Returns:
        更新された従業員データ、存在しない場合はNone
    """
    # 存在確認
    existing = pos_employees_table.get_item(Key={"employee_number": employee_number})
    if "Item" not in existing:
        return None

    now = datetime.now(timezone.utc).isoformat()
    update_expression = "SET updated_at = :updated"
    expression_values = {":updated": now}
    expression_names = {}

    if display_name is not None:
        update_expression += ", display_name = :dn"
        expression_values[":dn"] = display_name

    if pin is not None:
        update_expression += ", pin_hash = :ph"
        expression_values[":ph"] = hash_pin(pin, employee_number)

    if event_id is not None:
        update_expression += ", event_id = :eid"
        expression_values[":eid"] = event_id

    if publisher_id is not None:
        update_expression += ", publisher_id = :pid"
        expression_values[":pid"] = publisher_id

    if active is not None:
        # 'active' は予約語なので ExpressionAttributeNames を使用
        update_expression += ", #active = :act"
        expression_values[":act"] = active
        expression_names["#active"] = "active"

    update_kwargs = {
        "Key": {"employee_number": employee_number},
        "UpdateExpression": update_expression,
        "ExpressionAttributeValues": expression_values,
        "ReturnValues": "ALL_NEW",
    }

    if expression_names:
        update_kwargs["ExpressionAttributeNames"] = expression_names

    response = pos_employees_table.update_item(**update_kwargs)
    item = dynamo_to_dict(response["Attributes"])
    item.pop("pin_hash", None)
    return item


def delete_pos_employee(employee_number: str) -> bool:
    """POS従業員を削除

    Args:
        employee_number: 従業員番号

    Returns:
        削除成功時True
    """
    try:
        pos_employees_table.delete_item(
            Key={"employee_number": employee_number},
            ConditionExpression="attribute_exists(employee_number)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


# ==========================================
# POS認証・セッション管理
# ==========================================


def authenticate_pos_employee(
    employee_number: str, pin: str, terminal_id: str
) -> dict | None:
    """POS従業員を認証してセッションを作成

    Args:
        employee_number: 従業員番号
        pin: PIN
        terminal_id: 端末ID

    Returns:
        セッション情報、認証失敗時はNone
    """
    # 従業員を取得
    response = pos_employees_table.get_item(Key={"employee_number": employee_number})
    if "Item" not in response:
        return None

    employee = response["Item"]

    # 無効な従業員はログイン不可
    if not employee.get("active", True):
        return None

    # PIN検証
    if not verify_pin(pin, employee_number, employee["pin_hash"]):
        return None

    # 既存のセッションを無効化（同じ端末の古いセッション）
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
        "expires_at": expires_at,  # TTLで自動削除
    }

    pos_sessions_table.put_item(Item=session_item)

    # オフライン検証用ハッシュを生成
    offline_hash = generate_offline_verification_hash(
        session_id, employee_number, expires_at
    )

    return {
        "session_id": session_id,
        "employee_number": employee_number,
        "display_name": employee["display_name"],
        "event_id": employee.get("event_id"),
        "publisher_id": employee.get("publisher_id"),
        "expires_at": expires_at,
        "offline_verification_hash": offline_hash,
    }


def verify_pos_session(session_id: str) -> dict | None:
    """POSセッションを検証

    Args:
        session_id: セッションID

    Returns:
        セッション情報、無効な場合はNone
    """
    response = pos_sessions_table.get_item(Key={"session_id": session_id})
    if "Item" not in response:
        return None

    session = dynamo_to_dict(response["Item"])

    # 有効期限チェック
    now = int(datetime.now(timezone.utc).timestamp())
    if session["expires_at"] < now:
        return None

    return session


def refresh_pos_session(session_id: str) -> dict | None:
    """POSセッションを延長

    Args:
        session_id: セッションID

    Returns:
        更新されたセッション情報、無効な場合はNone
    """
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


def invalidate_session(session_id: str) -> bool:
    """セッションを無効化（ログアウト）

    Args:
        session_id: セッションID

    Returns:
        成功時True
    """
    try:
        pos_sessions_table.delete_item(Key={"session_id": session_id})
        return True
    except ClientError:
        return False


def invalidate_terminal_sessions(terminal_id: str) -> None:
    """端末の全セッションを無効化

    Args:
        terminal_id: 端末ID
    """
    # 端末に紐づくセッションを検索
    # 注: TerminalIndex GSIがないため、スキャンで対応
    # 大量のセッションがある場合はGSI追加を検討
    response = pos_sessions_table.scan(
        FilterExpression="terminal_id = :tid",
        ExpressionAttributeValues={":tid": terminal_id},
    )

    for session in response.get("Items", []):
        pos_sessions_table.delete_item(Key={"session_id": session["session_id"]})


def invalidate_employee_sessions(employee_number: str) -> None:
    """従業員の全セッションを無効化

    Args:
        employee_number: 従業員番号
    """
    response = pos_sessions_table.query(
        IndexName="EmployeeIndex",
        KeyConditionExpression="employee_number = :en",
        ExpressionAttributeValues={":en": employee_number},
    )

    for session in response.get("Items", []):
        pos_sessions_table.delete_item(Key={"session_id": session["session_id"]})


# ==========================================
# オフライン販売同期
# ==========================================


def queue_offline_sale(
    terminal_id: str,
    sale_data: dict,
    employee_number: str,
) -> dict:
    """オフライン販売をキューに追加

    Args:
        terminal_id: 端末ID
        sale_data: 販売データ
        employee_number: 従業員番号

    Returns:
        キューに追加されたアイテム
    """
    queue_id = str(uuid.uuid4())
    now = int(datetime.now(timezone.utc).timestamp())

    # 30日後に自動削除（同期済みでも念のため）
    expires_at = now + (30 * 24 * 60 * 60)

    item = {
        "queue_id": queue_id,
        "created_at": now,
        "terminal_id": terminal_id,
        "employee_number": employee_number,
        "sale_data": sale_data,
        "sync_status": "pending",  # pending, synced, failed
        "expires_at": expires_at,
    }

    offline_sales_queue_table.put_item(Item=item)
    return dynamo_to_dict(item)


def get_pending_offline_sales(terminal_id: str) -> list[dict]:
    """端末の未同期販売を取得

    Args:
        terminal_id: 端末ID

    Returns:
        未同期の販売データリスト
    """
    response = offline_sales_queue_table.query(
        IndexName="TerminalIndex",
        KeyConditionExpression="terminal_id = :tid",
        FilterExpression="sync_status = :status",
        ExpressionAttributeValues={":tid": terminal_id, ":status": "pending"},
    )

    return [dynamo_to_dict(item) for item in response.get("Items", [])]


def mark_offline_sale_synced(queue_id: str, created_at: int) -> None:
    """オフライン販売を同期済みにマーク

    Args:
        queue_id: キューID
        created_at: 作成日時（レンジキー）
    """
    offline_sales_queue_table.update_item(
        Key={"queue_id": queue_id, "created_at": created_at},
        UpdateExpression="SET sync_status = :status, synced_at = :synced",
        ExpressionAttributeValues={
            ":status": "synced",
            ":synced": int(datetime.now(timezone.utc).timestamp()),
        },
    )


def mark_offline_sale_failed(queue_id: str, created_at: int, error: str) -> None:
    """オフライン販売を同期失敗にマーク

    Args:
        queue_id: キューID
        created_at: 作成日時（レンジキー）
        error: エラーメッセージ
    """
    offline_sales_queue_table.update_item(
        Key={"queue_id": queue_id, "created_at": created_at},
        UpdateExpression="SET sync_status = :status, error_message = :err",
        ExpressionAttributeValues={":status": "failed", ":err": error},
    )


def save_offline_sale_to_db(sale_data: dict) -> dict:
    """オフライン販売データをDBに保存

    Args:
        sale_data: POS端末からの販売データ
            {
                sale_id, timestamp, items, total_amount,
                payment_method, employee_number, event_id, terminal_id
            }

    Returns:
        保存された販売レコード
    """
    sale_id = sale_data.get("sale_id")
    if not sale_id:
        sale_id = str(uuid.uuid4())

    timestamp = sale_data.get("timestamp")
    if not timestamp:
        timestamp = int(datetime.now(timezone.utc).timestamp())

    now_iso = datetime.now(timezone.utc).isoformat()

    # itemsをDynamoDB用に変換
    sale_items = []
    for item in sale_data.get("items", []):
        # product情報が含まれている場合はproduct_idを抽出
        product_id = item.get("product_id")
        if not product_id and "product" in item:
            product_id = item["product"].get("product_id")

        quantity = item.get("quantity", 1)

        # unit_priceまたはsubtotal/quantityから計算
        unit_price = item.get("unit_price")
        if unit_price is None:
            subtotal = item.get("subtotal", 0)
            unit_price = subtotal // quantity if quantity > 0 else 0

        # productオブジェクトから価格を取得
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

    # 販売レコードを作成
    sale_item = {
        "sale_id": sale_id,
        "timestamp": timestamp,
        "items": sale_items,
        "total_amount": Decimal(str(sale_data.get("total_amount", 0))),
        "payment_method": sale_data.get("payment_method", "cash"),
        "status": "completed",
        "employee_number": sale_data.get("employee_number", "unknown"),
        "terminal_id": sale_data.get("terminal_id"),
        "source": "pos_offline",  # オフライン同期からの販売を識別
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

# Sales/Stockテーブル（環境変数から取得）
SALES_TABLE = os.environ.get("SALES_TABLE", f"{ENVIRONMENT}-mizpos-sales")
STOCK_TABLE = os.environ.get("STOCK_TABLE", f"{ENVIRONMENT}-mizpos-stock")

sales_table = dynamodb.Table(SALES_TABLE)
stock_table = dynamodb.Table(STOCK_TABLE)


def record_pos_sale(
    session_id: str,
    items: list[dict],
    total_amount: int,
    payment_method: str,
    event_id: str | None = None,
    terminal_id: str | None = None,
) -> dict:
    """POS端末からの販売をリアルタイムで記録

    Args:
        session_id: POSセッションID
        items: 販売アイテム [{product_id, quantity, unit_price}]
        total_amount: 合計金額
        payment_method: 支払い方法 (cash/card/other)
        event_id: イベントID
        terminal_id: 端末ID

    Returns:
        作成された販売レコード

    Raises:
        ValueError: セッションが無効な場合
    """
    # セッションを検証
    session = verify_pos_session(session_id)
    if not session:
        raise ValueError("Invalid or expired session")

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
                # 在庫不足だが処理は継続（対面販売では在庫エラーを無視）
                pass
            else:
                raise

        sale_items.append(
            {
                "product_id": product_id,
                "quantity": quantity,
                "unit_price": Decimal(str(unit_price)),
                "subtotal": Decimal(str(unit_price * quantity)),
            }
        )

    # 販売レコードを作成
    sale_item = {
        "sale_id": sale_id,
        "timestamp": now,
        "items": sale_items,
        "total_amount": Decimal(str(total_amount)),
        "payment_method": payment_method,
        "status": "completed",
        "employee_number": session["employee_number"],
        "terminal_id": terminal_id or session.get("terminal_id"),
        "source": "pos",  # POS端末からの販売を識別
        "created_at": now_iso,
    }

    if event_id:
        sale_item["event_id"] = event_id

    sales_table.put_item(Item=sale_item)

    return {
        "sale_id": sale_id,
        "timestamp": now,
        "total_amount": total_amount,
        "status": "completed",
    }
