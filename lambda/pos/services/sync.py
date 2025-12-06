"""
同期関連サービス
イベント取得などの補助機能
"""

import os
from decimal import Decimal

import boto3

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
EVENTS_TABLE = os.environ.get("EVENTS_TABLE", f"{ENVIRONMENT}-mizpos-events")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
events_table = dynamodb.Table(EVENTS_TABLE)


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


def get_events_for_pos() -> list[dict]:
    """POS端末用にアクティブなイベント一覧を取得"""
    response = events_table.scan()
    items = response.get("Items", [])

    # アクティブなイベントのみフィルタリング
    active_events = [
        dynamo_to_dict(item) for item in items if item.get("is_active", False)
    ]

    return active_events
