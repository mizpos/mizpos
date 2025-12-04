#!/usr/bin/env python3
"""
既存商品にバーコードを生成・保存するマイグレーションスクリプト
"""

import hashlib
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3

ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
STOCK_TABLE = f"{ENVIRONMENT}-mizpos-stock"

dynamodb = boto3.resource("dynamodb", region_name="ap-northeast-1")
stock_table = dynamodb.Table(STOCK_TABLE)


def calculate_check_digit(digits: str) -> int:
    """モジュラス10 ウェイト3・1でチェックデジットを計算"""
    total = 0
    for i, digit in enumerate(digits):
        weight = 1 if i % 2 == 0 else 3
        total += int(digit) * weight
    remainder = total % 10
    return 0 if remainder == 0 else 10 - remainder


def generate_jan_barcode(isdn: str) -> str:
    """ISDNから1段目JANバーコードを生成"""
    return isdn.replace("-", "")


def generate_secondary_barcode(c_code: str, price: int) -> str:
    """2段目バーコードを生成"""
    flag = "292"
    c_code_padded = c_code.zfill(4)
    price_padded = str(price).zfill(5)[-5:]
    base_digits = f"{flag}{c_code_padded}{price_padded}"
    check_digit = calculate_check_digit(base_digits)
    return f"{base_digits}{check_digit}"


def generate_instore_barcode(product_id: str, price: int) -> str:
    """インストアバーコードを生成"""
    flag = "201"
    hash_val = hashlib.md5(product_id.encode()).hexdigest()
    product_num = str(int(hash_val[:8], 16) % 100000000).zfill(8)
    base_digits = f"{flag}{product_num}0"
    check_digit = calculate_check_digit(base_digits)
    return f"{base_digits}{check_digit}"


def format_isdn_with_price(isdn: str, c_code: str, price: int) -> str:
    """ISDNに価格を付与"""
    return f"ISDN{isdn} C{c_code} ¥{price}E"


def generate_full_barcode_info(isdn: str | None, product_id: str, price: int, c_code: str = "3055") -> dict:
    """完全なバーコード情報を生成"""
    if isdn:
        jan_barcode = generate_jan_barcode(isdn)
        secondary_barcode = generate_secondary_barcode(c_code, price)
        isdn_formatted = format_isdn_with_price(isdn, c_code, price)
        return {
            "isdn": isdn,
            "isdn_formatted": isdn_formatted,
            "jan_barcode_1": jan_barcode,
            "jan_barcode_2": secondary_barcode,
        }
    else:
        instore_barcode = generate_instore_barcode(product_id, price)
        secondary_barcode = generate_secondary_barcode(c_code, price)
        return {
            "isdn": None,
            "isdn_formatted": None,
            "jan_barcode_1": instore_barcode,
            "jan_barcode_2": secondary_barcode,
        }


def migrate():
    """既存商品にバーコードを追加"""
    print(f"テーブル: {STOCK_TABLE}")

    response = stock_table.scan()
    products = response.get("Items", [])

    updated_count = 0
    skipped_count = 0

    for product in products:
        product_id = product.get("product_id")
        name = product.get("name", "")

        # 既にバーコードがある場合はスキップ
        if product.get("jan_barcode_1"):
            print(f"スキップ: {name} (既にバーコードあり)")
            skipped_count += 1
            continue

        isdn = product.get("isdn")
        price = int(product.get("price", 0))

        barcode_info = generate_full_barcode_info(isdn, product_id, price)

        update_expr = "SET jan_barcode_1 = :jb1, jan_barcode_2 = :jb2, updated_at = :ua"
        expr_values = {
            ":jb1": barcode_info["jan_barcode_1"],
            ":jb2": barcode_info["jan_barcode_2"],
            ":ua": datetime.now(timezone.utc).isoformat(),
        }

        if barcode_info.get("isdn_formatted"):
            update_expr += ", isdn_formatted = :isdn_fmt"
            expr_values[":isdn_fmt"] = barcode_info["isdn_formatted"]

        stock_table.update_item(
            Key={"product_id": product_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )

        print(f"更新: {name} -> {barcode_info['jan_barcode_1']}")
        updated_count += 1

    print(f"\n完了: 更新={updated_count}, スキップ={skipped_count}")


if __name__ == "__main__":
    migrate()
