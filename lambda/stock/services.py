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
CDN_BUCKET_NAME = os.environ.get("CDN_BUCKET_NAME", f"{ENVIRONMENT}-mizpos-cdn-assets")
CDN_DOMAIN = os.environ.get("CDN_DOMAIN", "")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
stock_table = dynamodb.Table(STOCK_TABLE)
stock_history_table = dynamodb.Table(STOCK_HISTORY_TABLE)
publishers_table = dynamodb.Table(PUBLISHERS_TABLE)

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


def list_publishers() -> list[dict]:
    """全出版社/サークル一覧を取得"""
    response = publishers_table.scan()
    return [dynamo_to_dict(item) for item in response.get("Items", [])]


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


# エクスポート
DynamoDBClientError = ClientError
