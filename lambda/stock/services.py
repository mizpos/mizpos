import os
import time
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

from models import VariantType

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
STOCK_TABLE = os.environ.get("STOCK_TABLE", f"{ENVIRONMENT}-mizpos-stock")
STOCK_HISTORY_TABLE = os.environ.get("STOCK_HISTORY_TABLE", f"{ENVIRONMENT}-mizpos-stock-history")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
stock_table = dynamodb.Table(STOCK_TABLE)
stock_history_table = dynamodb.Table(STOCK_HISTORY_TABLE)


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


def build_update_expression(request_dict: dict) -> tuple[list[str], dict]:
    """更新式と値を構築"""
    update_expressions = []
    expression_values = {}

    for field, value in request_dict.items():
        if value is not None:
            if field == "price":
                value = Decimal(str(value))
            elif field == "variant_type":
                value = value.value if isinstance(value, VariantType) else value
            update_expressions.append(f"{field} = :{field}")
            expression_values[f":{field}"] = value

    return update_expressions, expression_values


# エクスポート
DynamoDBClientError = ClientError
