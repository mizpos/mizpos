"""
クーポン関連サービス
POS端末用のクーポン適用・検証機能
"""

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple

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


def get_coupon_by_code(code: str) -> Optional[dict]:
    """クーポンコードで検索"""
    try:
        response = coupons_table.query(
            IndexName="CodeIndex",
            KeyConditionExpression="code = :code",
            ExpressionAttributeValues={":code": code.upper()},
        )
        items = response.get("Items", [])
        if items:
            return dynamo_to_dict(items[0])
        return None
    except ClientError:
        return None


def validate_coupon(
    code: str,
    subtotal: int,
    publisher_id: Optional[str] = None,
    event_id: Optional[str] = None,
) -> Tuple[Optional[dict], Optional[str]]:
    """クーポンを検証

    Returns:
        (クーポン情報, エラーメッセージ) のタプル
        成功時: (coupon, None)
        失敗時: (None, error_message)
    """
    coupon = get_coupon_by_code(code)
    if not coupon:
        return None, "クーポンが見つかりません"

    # 有効フラグ確認
    if not coupon.get("active", True):
        return None, "このクーポンは無効です"

    # 有効期限確認
    now = datetime.now(timezone.utc)
    if coupon.get("valid_from"):
        valid_from = datetime.fromisoformat(coupon["valid_from"].replace("Z", "+00:00"))
        if now < valid_from:
            return None, "このクーポンはまだ使用できません"

    if coupon.get("valid_until"):
        valid_until = datetime.fromisoformat(
            coupon["valid_until"].replace("Z", "+00:00")
        )
        if now > valid_until:
            return None, "このクーポンは有効期限が切れています"

    # 使用回数制限確認
    if coupon.get("usage_limit") is not None:
        current_usage = coupon.get("usage_count", 0)
        if current_usage >= coupon["usage_limit"]:
            return None, "このクーポンは使用上限に達しています"

    # 最低購入金額確認
    if coupon.get("min_purchase_amount") is not None:
        if subtotal < coupon["min_purchase_amount"]:
            return (
                None,
                f"このクーポンは{coupon['min_purchase_amount']}円以上の購入が必要です",
            )

    # サークル制限確認
    if coupon.get("publisher_id"):
        if publisher_id != coupon["publisher_id"]:
            return None, "このクーポンは指定されたサークル専用です"

    # イベント制限確認
    if coupon.get("event_id"):
        if event_id != coupon["event_id"]:
            return None, "このクーポンは指定されたイベント専用です"

    return coupon, None


def calculate_discount(coupon: dict, subtotal: int) -> int:
    """割引額を計算"""
    discount_type = coupon.get("discount_type", "fixed")
    discount_value = coupon.get("discount_value", 0)

    if discount_type == "percentage":
        # パーセント割引
        discount = int(subtotal * discount_value / 100)
    else:
        # 固定金額割引
        discount = discount_value

    # 最大割引額制限
    if coupon.get("max_discount_amount") is not None:
        discount = min(discount, coupon["max_discount_amount"])

    # 小計を超えないようにする
    discount = min(discount, subtotal)

    return discount


def increment_usage_count(coupon_id: str) -> None:
    """クーポン使用回数をインクリメント"""
    try:
        coupons_table.update_item(
            Key={"coupon_id": coupon_id},
            UpdateExpression="SET usage_count = if_not_exists(usage_count, :zero) + :inc",
            ExpressionAttributeValues={":zero": 0, ":inc": 1},
        )
    except ClientError:
        pass  # エラーは無視


def apply_coupon(
    code: str,
    subtotal: int,
    publisher_id: Optional[str] = None,
    event_id: Optional[str] = None,
) -> Tuple[Optional[dict], Optional[str]]:
    """クーポンを適用して割引額を計算

    Returns:
        (結果, エラーメッセージ) のタプル
    """
    coupon, error = validate_coupon(code, subtotal, publisher_id, event_id)
    if error:
        return None, error

    discount = calculate_discount(coupon, subtotal)

    return {
        "coupon_id": coupon["coupon_id"],
        "code": coupon["code"],
        "name": coupon.get("name", ""),
        "discount_type": coupon.get("discount_type", "fixed"),
        "discount_value": coupon.get("discount_value", 0),
        "discount_amount": discount,
        "final_amount": subtotal - discount,
    }, None
