import os
import time
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from models import VariantType

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
STOCK_TABLE = os.environ.get("STOCK_TABLE", f"{ENVIRONMENT}-mizpos-stock")
STOCK_HISTORY_TABLE = os.environ.get(
    "STOCK_HISTORY_TABLE", f"{ENVIRONMENT}-mizpos-stock-history"
)
PUBLISHERS_TABLE = os.environ.get(
    "PUBLISHERS_TABLE", f"{ENVIRONMENT}-mizpos-publishers"
)
EVENTS_TABLE = os.environ.get("EVENTS_TABLE", f"{ENVIRONMENT}-mizpos-events")
ROLES_TABLE = os.environ.get("ROLES_TABLE", f"{ENVIRONMENT}-mizpos-roles")
USERS_TABLE = os.environ.get("USERS_TABLE", f"{ENVIRONMENT}-mizpos-users")
CDN_BUCKET_NAME = os.environ.get("CDN_BUCKET_NAME", f"{ENVIRONMENT}-mizpos-cdn-assets")
CDN_DOMAIN = os.environ.get("CDN_DOMAIN", "")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
stock_table = dynamodb.Table(STOCK_TABLE)
stock_history_table = dynamodb.Table(STOCK_HISTORY_TABLE)
publishers_table = dynamodb.Table(PUBLISHERS_TABLE)
events_table = dynamodb.Table(EVENTS_TABLE)
roles_table = dynamodb.Table(ROLES_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# S3クライアント（Presigned URL生成用）
s3_client = boto3.client("s3", config=Config(signature_version="s3v4"))


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


def build_update_expression(request_dict: dict) -> tuple[list[str], dict, dict]:
    """更新式と値を構築（予約語対応）"""
    # DynamoDB予約語のリスト（よく使うものを含む）
    reserved_keywords = {
        "name",
        "description",
        "status",
        "type",
        "value",
        "data",
        "date",
        "timestamp",
        "count",
        "size",
        "key",
        "user",
        "group",
        "comment",
    }

    update_expressions = []
    expression_values = {}
    expression_names = {}

    for field, value in request_dict.items():
        if value is not None:
            if field in (
                "price",
                "commission_rate",
                "stripe_online_fee_rate",
                "stripe_terminal_fee_rate",
            ):
                value = Decimal(str(value))
            elif field == "variant_type":
                value = value.value if isinstance(value, VariantType) else value

            # 予約語の場合はExpressionAttributeNamesを使用
            if field.lower() in reserved_keywords:
                expression_names[f"#{field}"] = field
                update_expressions.append(f"#{field} = :{field}")
            else:
                update_expressions.append(f"{field} = :{field}")

            expression_values[f":{field}"] = value

    return update_expressions, expression_values, expression_names


def get_publisher(publisher_id: str) -> dict | None:
    """出版社/サークル情報を取得"""
    try:
        response = publishers_table.get_item(Key={"publisher_id": publisher_id})
        item = response.get("Item")
        return dynamo_to_dict(item) if item else None
    except ClientError:
        return None


def get_user_id_from_email(email: str) -> str | None:
    """メールアドレスからユーザーIDを取得"""
    if not email:
        return None

    response = users_table.query(
        IndexName="EmailIndex",
        KeyConditionExpression="email = :email",
        ExpressionAttributeValues={":email": email},
    )
    items = response.get("Items", [])
    return items[0]["user_id"] if items else None


def is_system_admin(user_id: str) -> bool:
    """ユーザーがシステム管理者かチェック"""
    response = roles_table.query(
        KeyConditionExpression="user_id = :user_id",
        FilterExpression="role_type = :role_type",
        ExpressionAttributeValues={
            ":user_id": user_id,
            ":role_type": "system_admin",
        },
    )
    return len(response.get("Items", [])) > 0


def get_user_publisher_ids(user_id: str) -> list[str]:
    """ユーザーがアクセスできるpublisher_idのリストを取得"""
    response = roles_table.query(
        KeyConditionExpression="user_id = :user_id",
        FilterExpression="role_type IN (:admin, :sales)",
        ExpressionAttributeValues={
            ":user_id": user_id,
            ":admin": "publisher_admin",
            ":sales": "publisher_sales",
        },
    )

    publisher_ids = []
    for role in response.get("Items", []):
        if "publisher_id" in role and role["publisher_id"]:
            publisher_ids.append(role["publisher_id"])

    return publisher_ids


def list_publishers(user_email: str | None = None) -> list[dict]:
    """
    出版社/サークル一覧を取得（権限フィルタリング付き）

    Args:
        user_email: ユーザーのメールアドレス（権限チェック用）

    Returns:
        アクセス可能なpublishersのリスト
    """
    # 全publishersを取得
    response = publishers_table.scan()
    all_publishers = [dynamo_to_dict(item) for item in response.get("Items", [])]

    # メールアドレスがない場合は空リストを返す
    if not user_email:
        return []

    # ユーザーIDを取得
    user_id = get_user_id_from_email(user_email)
    if not user_id:
        return []

    # システム管理者は全て見える
    if is_system_admin(user_id):
        return all_publishers

    # 一般ユーザーは自分が所属するpublishersのみ
    accessible_publisher_ids = get_user_publisher_ids(user_id)
    return [p for p in all_publishers if p["publisher_id"] in accessible_publisher_ids]


def generate_presigned_upload_url(
    filename: str,
    content_type: str,
    upload_type: str = "book_cover",
    expires_in: int = 3600,
) -> dict:
    """
    S3へのアップロード用Presigned URLを生成

    Args:
        filename: オリジナルファイル名
        content_type: MIMEタイプ
        upload_type: アップロードの種類（ディレクトリ分け用）
        expires_in: URLの有効期限（秒）

    Returns:
        dict: upload_url, cdn_url, object_key, expires_in
    """
    # ファイル名から拡張子を取得
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
    else:
        ext = ""

    # 乱数プレフィックスを生成（UUID）
    random_prefix = str(uuid.uuid4())

    # オブジェクトキーを構築（乱数_オリジナルファイル名）
    safe_filename = filename.replace(" ", "_").replace("/", "_")
    if ext:
        object_key = f"{upload_type}/{random_prefix}_{safe_filename}"
    else:
        object_key = f"{upload_type}/{random_prefix}_{safe_filename}"

    # Presigned URLを生成
    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": CDN_BUCKET_NAME,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

    # CDN URLを構築
    if CDN_DOMAIN:
        cdn_url = f"https://{CDN_DOMAIN}/{object_key}"
    else:
        # CloudFrontが設定されていない場合はS3のURLを返す
        cdn_url = f"https://{CDN_BUCKET_NAME}.s3.amazonaws.com/{object_key}"

    return {
        "upload_url": presigned_url,
        "cdn_url": cdn_url,
        "object_key": object_key,
        "expires_in": expires_in,
    }


# ==========================================
# イベント管理関数
# ==========================================


def create_event(event_data: dict) -> dict:
    """イベントを新規作成

    Args:
        event_data: イベント情報

    Returns:
        作成されたイベント
    """
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "event_id": event_id,
        "name": event_data["name"],
        "description": event_data.get("description", ""),
        "start_date": event_data.get("start_date"),
        "end_date": event_data.get("end_date"),
        "location": event_data.get("location", ""),
        "publisher_id": event_data.get("publisher_id"),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    events_table.put_item(Item=item)
    return dynamo_to_dict(item)


def get_event(event_id: str) -> dict | None:
    """イベント詳細を取得

    Args:
        event_id: イベントID

    Returns:
        イベント情報（存在しない場合はNone）
    """
    response = events_table.get_item(Key={"event_id": event_id})
    item = response.get("Item")
    return dynamo_to_dict(item) if item else None


def list_events(publisher_id: str | None = None) -> list[dict]:
    """イベント一覧を取得

    Args:
        publisher_id: サークルID（指定した場合はそのサークルのイベントのみ取得）

    Returns:
        イベントのリスト
    """
    if publisher_id:
        # 特定のサークルのイベントのみ取得
        response = events_table.scan(
            FilterExpression="publisher_id = :pid",
            ExpressionAttributeValues={":pid": publisher_id},
        )
    else:
        # 全イベントを取得
        response = events_table.scan()

    items = response.get("Items", [])
    return [dynamo_to_dict(item) for item in items]


def update_event(event_id: str, update_data: dict) -> dict | None:
    """イベント情報を更新

    Args:
        event_id: イベントID
        update_data: 更新データ

    Returns:
        更新されたイベント（存在しない場合はNone）
    """
    now = datetime.now(timezone.utc).isoformat()

    # 更新式を構築
    update_expr_parts = []
    expr_attr_values = {":updated_at": now}

    for key, value in update_data.items():
        if value is not None:
            update_expr_parts.append(f"{key} = :{key}")
            expr_attr_values[f":{key}"] = value

    if not update_expr_parts:
        # 更新するデータがない場合は現在の値を返す
        return get_event(event_id)

    update_expr_parts.append("updated_at = :updated_at")
    update_expr = "SET " + ", ".join(update_expr_parts)

    try:
        response = events_table.update_item(
            Key={"event_id": event_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_attr_values,
            ReturnValues="ALL_NEW",
        )
        return dynamo_to_dict(response["Attributes"])
    except ClientError:
        return None


def delete_event(event_id: str) -> bool:
    """イベントを削除（論理削除）

    Args:
        event_id: イベントID

    Returns:
        削除成功の場合True
    """
    try:
        events_table.update_item(
            Key={"event_id": event_id},
            UpdateExpression="SET is_active = :inactive",
            ExpressionAttributeValues={":inactive": False},
        )
        return True
    except ClientError:
        return False


# エクスポート
DynamoDBClientError = ClientError
