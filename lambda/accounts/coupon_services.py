"""
クーポン管理サービス
固定金額割引・割引率クーポン、発行者紐付け/非紐付けに対応
"""

import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
COUPONS_TABLE = os.environ.get("COUPONS_TABLE", f"{ENVIRONMENT}-mizpos-coupons")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
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


# ==========================================
# クーポン管理
# ==========================================


def create_coupon(
    code: str,
    name: str,
    discount_type: str,
    discount_value: int,
    description: str | None = None,
    publisher_id: str | None = None,
    event_id: str | None = None,
    min_purchase_amount: int = 0,
    max_discount_amount: int | None = None,
    valid_from: str | None = None,
    valid_until: str | None = None,
    usage_limit: int | None = None,
    active: bool = True,
) -> dict:
    """クーポンを作成

    Args:
        code: クーポンコード（ユニーク）
        name: クーポン名
        discount_type: 割引タイプ (fixed/percentage)
        discount_value: 割引値（fixed: 円, percentage: %）
        description: 説明
        publisher_id: 紐付くサークルID
        event_id: 紐付くイベントID
        min_purchase_amount: 最低購入金額
        max_discount_amount: 最大割引額（percentage用）
        valid_from: 有効期間開始
        valid_until: 有効期間終了
        usage_limit: 利用回数上限
        active: 有効フラグ

    Returns:
        作成されたクーポンデータ

    Raises:
        ValueError: クーポンコードが既に存在する場合
    """
    # コード重複チェック
    existing = get_coupon_by_code(code)
    if existing:
        raise ValueError(f"クーポンコード '{code}' は既に使用されています")

    coupon_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "coupon_id": coupon_id,
        "code": code.upper(),  # コードは大文字で統一
        "name": name,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "min_purchase_amount": min_purchase_amount,
        "usage_count": 0,
        "active": active,
        "created_at": now,
        "updated_at": now,
    }

    # オプションフィールド
    if description:
        item["description"] = description
    if publisher_id:
        item["publisher_id"] = publisher_id
    if event_id:
        item["event_id"] = event_id
    if max_discount_amount is not None:
        item["max_discount_amount"] = max_discount_amount
    if valid_from:
        item["valid_from"] = valid_from
    if valid_until:
        item["valid_until"] = valid_until
    if usage_limit is not None:
        item["usage_limit"] = usage_limit

    coupons_table.put_item(Item=item)

    return dynamo_to_dict(item)


def get_coupon(coupon_id: str) -> dict | None:
    """クーポンをIDで取得

    Args:
        coupon_id: クーポンID

    Returns:
        クーポンデータ、存在しない場合はNone
    """
    response = coupons_table.get_item(Key={"coupon_id": coupon_id})
    if "Item" not in response:
        return None
    return dynamo_to_dict(response["Item"])


def get_coupon_by_code(code: str) -> dict | None:
    """クーポンをコードで取得

    Args:
        code: クーポンコード

    Returns:
        クーポンデータ、存在しない場合はNone
    """
    response = coupons_table.query(
        IndexName="CodeIndex",
        KeyConditionExpression="code = :code",
        ExpressionAttributeValues={":code": code.upper()},
    )

    items = response.get("Items", [])
    if not items:
        return None
    return dynamo_to_dict(items[0])


def list_coupons(
    publisher_id: str | None = None,
    event_id: str | None = None,
    active_only: bool = False,
) -> list[dict]:
    """クーポン一覧を取得

    Args:
        publisher_id: サークルIDでフィルタ
        event_id: イベントIDでフィルタ
        active_only: 有効なクーポンのみ取得

    Returns:
        クーポンデータのリスト
    """
    if publisher_id:
        response = coupons_table.query(
            IndexName="PublisherIndex",
            KeyConditionExpression="publisher_id = :pid",
            ExpressionAttributeValues={":pid": publisher_id},
        )
    elif event_id:
        response = coupons_table.query(
            IndexName="EventIndex",
            KeyConditionExpression="event_id = :eid",
            ExpressionAttributeValues={":eid": event_id},
        )
    else:
        response = coupons_table.scan()

    items = [dynamo_to_dict(item) for item in response.get("Items", [])]

    if active_only:
        items = [item for item in items if item.get("active", True)]

    return items


def update_coupon(
    coupon_id: str,
    name: str | None = None,
    description: str | None = None,
    discount_type: str | None = None,
    discount_value: int | None = None,
    publisher_id: str | None = None,
    event_id: str | None = None,
    min_purchase_amount: int | None = None,
    max_discount_amount: int | None = None,
    valid_from: str | None = None,
    valid_until: str | None = None,
    usage_limit: int | None = None,
    active: bool | None = None,
) -> dict | None:
    """クーポンを更新

    Args:
        coupon_id: クーポンID
        その他: 更新するフィールド

    Returns:
        更新されたクーポンデータ、存在しない場合はNone
    """
    # 存在確認
    existing = coupons_table.get_item(Key={"coupon_id": coupon_id})
    if "Item" not in existing:
        return None

    now = datetime.now(timezone.utc).isoformat()
    update_expression = "SET updated_at = :updated"
    expression_values = {":updated": now}
    expression_names = {}

    if name is not None:
        update_expression += ", #name = :name"
        expression_values[":name"] = name
        expression_names["#name"] = "name"

    if description is not None:
        update_expression += ", description = :desc"
        expression_values[":desc"] = description

    if discount_type is not None:
        update_expression += ", discount_type = :dtype"
        expression_values[":dtype"] = discount_type

    if discount_value is not None:
        update_expression += ", discount_value = :dval"
        expression_values[":dval"] = discount_value

    if publisher_id is not None:
        update_expression += ", publisher_id = :pid"
        expression_values[":pid"] = publisher_id

    if event_id is not None:
        update_expression += ", event_id = :eid"
        expression_values[":eid"] = event_id

    if min_purchase_amount is not None:
        update_expression += ", min_purchase_amount = :minamt"
        expression_values[":minamt"] = min_purchase_amount

    if max_discount_amount is not None:
        update_expression += ", max_discount_amount = :maxamt"
        expression_values[":maxamt"] = max_discount_amount

    if valid_from is not None:
        update_expression += ", valid_from = :vfrom"
        expression_values[":vfrom"] = valid_from

    if valid_until is not None:
        update_expression += ", valid_until = :vuntil"
        expression_values[":vuntil"] = valid_until

    if usage_limit is not None:
        update_expression += ", usage_limit = :ulimit"
        expression_values[":ulimit"] = usage_limit

    if active is not None:
        update_expression += ", active = :active"
        expression_values[":active"] = active

    update_kwargs = {
        "Key": {"coupon_id": coupon_id},
        "UpdateExpression": update_expression,
        "ExpressionAttributeValues": expression_values,
        "ReturnValues": "ALL_NEW",
    }

    if expression_names:
        update_kwargs["ExpressionAttributeNames"] = expression_names

    response = coupons_table.update_item(**update_kwargs)
    return dynamo_to_dict(response["Attributes"])


def delete_coupon(coupon_id: str) -> bool:
    """クーポンを削除

    Args:
        coupon_id: クーポンID

    Returns:
        削除成功時True
    """
    try:
        coupons_table.delete_item(
            Key={"coupon_id": coupon_id},
            ConditionExpression="attribute_exists(coupon_id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def increment_usage_count(coupon_id: str) -> bool:
    """クーポン使用回数をインクリメント

    Args:
        coupon_id: クーポンID

    Returns:
        成功時True
    """
    try:
        coupons_table.update_item(
            Key={"coupon_id": coupon_id},
            UpdateExpression="SET usage_count = usage_count + :inc",
            ExpressionAttributeValues={":inc": 1},
        )
        return True
    except ClientError:
        return False


# ==========================================
# クーポン適用・検証
# ==========================================


def validate_coupon(
    code: str,
    subtotal: int,
    publisher_id: str | None = None,
    event_id: str | None = None,
) -> tuple[dict | None, str | None]:
    """クーポンを検証

    Args:
        code: クーポンコード
        subtotal: 適用前の小計
        publisher_id: カート内商品のサークルID（サークル限定クーポン検証用）
        event_id: 現在のイベントID

    Returns:
        (クーポンデータ, エラーメッセージ) - 有効な場合はエラーがNone
    """
    coupon = get_coupon_by_code(code)

    if not coupon:
        return None, "クーポンが見つかりません"

    # 有効フラグチェック
    if not coupon.get("active", True):
        return None, "このクーポンは無効です"

    # 有効期間チェック
    now = datetime.now(timezone.utc).isoformat()
    if coupon.get("valid_from") and now < coupon["valid_from"]:
        return None, "このクーポンはまだ有効期間前です"
    if coupon.get("valid_until") and now > coupon["valid_until"]:
        return None, "このクーポンは有効期限切れです"

    # 利用回数チェック
    usage_limit = coupon.get("usage_limit")
    usage_count = coupon.get("usage_count", 0)
    if usage_limit is not None and usage_count >= usage_limit:
        return None, "このクーポンは利用上限に達しました"

    # 最低購入金額チェック
    min_amount = coupon.get("min_purchase_amount", 0)
    if subtotal < min_amount:
        return None, f"このクーポンは{min_amount}円以上の購入で利用可能です"

    # サークル限定チェック
    coupon_publisher_id = coupon.get("publisher_id")
    if coupon_publisher_id and coupon_publisher_id != publisher_id:
        return None, "このクーポンは指定されたサークルの商品にのみ適用可能です"

    # イベント限定チェック
    coupon_event_id = coupon.get("event_id")
    if coupon_event_id and coupon_event_id != event_id:
        return None, "このクーポンは指定されたイベントでのみ利用可能です"

    return coupon, None


def calculate_discount(
    coupon: dict,
    subtotal: int,
) -> int:
    """割引額を計算

    Args:
        coupon: クーポンデータ
        subtotal: 適用前の小計

    Returns:
        割引額（正の値）
    """
    discount_type = coupon["discount_type"]
    discount_value = coupon["discount_value"]

    if discount_type == "fixed":
        # 固定金額割引
        discount = discount_value
    else:
        # 割引率
        discount = subtotal * discount_value // 100

    # 最大割引額制限
    max_discount = coupon.get("max_discount_amount")
    if max_discount is not None:
        discount = min(discount, max_discount)

    # 小計を超えないように
    discount = min(discount, subtotal)

    return discount


def apply_coupon(
    code: str,
    subtotal: int,
    publisher_id: str | None = None,
    event_id: str | None = None,
) -> tuple[dict | None, str | None]:
    """クーポンを適用

    Args:
        code: クーポンコード
        subtotal: 適用前の小計
        publisher_id: カート内商品のサークルID
        event_id: 現在のイベントID

    Returns:
        (適用結果, エラーメッセージ) - 成功時はエラーがNone
        適用結果: {
            coupon_id, code, name, discount_type, discount_value,
            discount_amount, new_total
        }
    """
    # 検証
    coupon, error = validate_coupon(code, subtotal, publisher_id, event_id)
    if error:
        return None, error

    # 割引額計算
    discount_amount = calculate_discount(coupon, subtotal)
    new_total = subtotal - discount_amount

    return {
        "coupon_id": coupon["coupon_id"],
        "code": coupon["code"],
        "name": coupon["name"],
        "discount_type": coupon["discount_type"],
        "discount_value": coupon["discount_value"],
        "discount_amount": discount_amount,
        "new_total": new_total,
    }, None
