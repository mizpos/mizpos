#!/usr/bin/env python3
"""
トレーニング環境用シードデータ作成スクリプト

イベント、出版社、商品、送料設定などのサンプルデータを作成します。
"""

import argparse
import json
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError


def decimal_default(obj):
    """Decimal型をJSON化する際のデフォルト処理"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def get_terraform_outputs(environment: str) -> dict:
    """Terraform outputs から必要な情報を取得"""
    import subprocess

    try:
        result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=f"terraform/tf-{environment}",
            capture_output=True,
            text=True,
            check=True,
        )
        outputs = json.loads(result.stdout)
        return {
            "events_table": outputs.get("dynamodb_events_table_name", {}).get("value"),
            "publishers_table": outputs.get("dynamodb_publishers_table_name", {}).get(
                "value"
            ),
            "stock_table": outputs.get("dynamodb_stock_table_name", {}).get("value"),
            "config_table": outputs.get("dynamodb_config_table_name", {}).get("value"),
        }
    except Exception as e:
        print(f"Terraform outputs の取得に失敗: {e}")
        return {}


def create_events(
    events_table_name: str, region: str = "ap-northeast-1"
) -> list[dict]:
    """サンプルイベントを作成"""
    dynamodb = boto3.resource("dynamodb", region_name=region)
    events_table = dynamodb.Table(events_table_name)

    now = datetime.now(timezone.utc)
    events = [
        {
            "event_id": str(uuid.uuid4()),
            "name": "コミックマーケット104（トレーニング）",
            "start_date": int((now - timedelta(days=7)).timestamp() * 1000),
            "end_date": int((now - timedelta(days=5)).timestamp() * 1000),
            "created_at": (now - timedelta(days=10)).isoformat(),
            "is_active": True,
        },
        {
            "event_id": str(uuid.uuid4()),
            "name": "技術書典17（トレーニング）",
            "start_date": int(now.timestamp() * 1000),
            "end_date": int((now + timedelta(days=2)).timestamp() * 1000),
            "created_at": (now - timedelta(days=5)).isoformat(),
            "is_active": True,
        },
        {
            "event_id": str(uuid.uuid4()),
            "name": "文学フリマ東京40（トレーニング）",
            "start_date": int((now + timedelta(days=30)).timestamp() * 1000),
            "end_date": int((now + timedelta(days=30)).timestamp() * 1000),
            "created_at": now.isoformat(),
            "is_active": True,
        },
    ]

    print(f"Creating {len(events)} sample events...")
    for event in events:
        try:
            events_table.put_item(Item=event)
            print(f"  ✓ Created event: {event['name']}")
        except ClientError as e:
            print(f"  ✗ Error creating event {event['name']}: {e}")

    return events


def create_publishers(
    publishers_table_name: str, region: str = "ap-northeast-1"
) -> list[dict]:
    """サンプル出版社/サークルを作成"""
    dynamodb = boto3.resource("dynamodb", region_name=region)
    publishers_table = dynamodb.Table(publishers_table_name)

    now = datetime.now(timezone.utc).isoformat()
    publishers = [
        {
            "publisher_id": str(uuid.uuid4()),
            "name": "技術書サークル TECHBOOKS",
            "description": "技術書を中心に活動しているサークルです。Web開発、インフラ、機械学習などの幅広いテーマを扱っています。",
            "contact_email": "contact@techbooks.example.com",
            "commission_rate": Decimal("10.0"),
            "stripe_online_fee_rate": Decimal("3.6"),
            "stripe_terminal_fee_rate": Decimal("3.6"),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "publisher_id": str(uuid.uuid4()),
            "name": "創作サークル MoonLight",
            "description": "オリジナル小説・イラスト集を制作しています。ファンタジーとSFがメインジャンルです。",
            "contact_email": "info@moonlight.example.com",
            "commission_rate": Decimal("15.0"),
            "stripe_online_fee_rate": Decimal("3.6"),
            "stripe_terminal_fee_rate": Decimal("3.6"),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "publisher_id": str(uuid.uuid4()),
            "name": "デザインスタジオ ColorPalette",
            "description": "グラフィックデザイン・イラスト集・フォント集を制作しています。",
            "contact_email": "hello@colorpalette.example.com",
            "commission_rate": Decimal("12.0"),
            "stripe_online_fee_rate": Decimal("3.6"),
            "stripe_terminal_fee_rate": Decimal("3.6"),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "publisher_id": str(uuid.uuid4()),
            "name": "音楽サークル SoundWave",
            "description": "オリジナル楽曲・アレンジCD・DTM解説本を制作しています。",
            "contact_email": "contact@soundwave.example.com",
            "commission_rate": Decimal("8.0"),
            "stripe_online_fee_rate": Decimal("3.6"),
            "stripe_terminal_fee_rate": Decimal("3.6"),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]

    print(f"Creating {len(publishers)} sample publishers...")
    for publisher in publishers:
        try:
            publishers_table.put_item(Item=publisher)
            print(f"  ✓ Created publisher: {publisher['name']}")
        except ClientError as e:
            print(f"  ✗ Error creating publisher {publisher['name']}: {e}")

    return publishers


def create_products(
    stock_table_name: str,
    publishers: list[dict],
    region: str = "ap-northeast-1",
) -> list[dict]:
    """サンプル商品を作成"""
    dynamodb = boto3.resource("dynamodb", region_name=region)
    stock_table = dynamodb.Table(stock_table_name)

    now = datetime.now(timezone.utc).isoformat()

    # 出版社IDを取得
    publisher_ids = {p["name"]: p["publisher_id"] for p in publishers}

    products = [
        # TECHBOOKS の商品
        {
            "product_id": str(uuid.uuid4()),
            "name": "Webアプリケーション開発入門 2025年版",
            "description": "モダンなWebアプリケーション開発の基礎から実践まで学べる技術書です。React、Next.js、TypeScriptを使った実践的な内容を収録しています。",
            "category": "技術書",
            "price": Decimal("2000"),
            "image_url": "",
            "author": "山田太郎",
            "publisher": "技術書サークル TECHBOOKS",
            "publisher_id": publisher_ids["技術書サークル TECHBOOKS"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 50,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "product_id": str(uuid.uuid4()),
            "name": "クラウドインフラ設計パターン集",
            "description": "AWS、GCP、Azureを使ったクラウドインフラ設計のベストプラクティスをまとめた一冊。実際のプロジェクトで使える設計パターンを多数収録。",
            "category": "技術書",
            "price": Decimal("2500"),
            "image_url": "",
            "author": "佐藤花子",
            "publisher": "技術書サークル TECHBOOKS",
            "publisher_id": publisher_ids["技術書サークル TECHBOOKS"],
            "variant_type": "both",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": "https://example.com/download/cloud-patterns",
            "stock_quantity": 30,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "product_id": str(uuid.uuid4()),
            "name": "機械学習実践ハンドブック",
            "description": "Python、scikit-learn、TensorFlowを使った機械学習の実践的な解説書。実際のデータを使ったハンズオン形式で学べます。",
            "category": "技術書",
            "price": Decimal("3000"),
            "image_url": "",
            "author": "鈴木一郎",
            "publisher": "技術書サークル TECHBOOKS",
            "publisher_id": publisher_ids["技術書サークル TECHBOOKS"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 25,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        # MoonLight の商品
        {
            "product_id": str(uuid.uuid4()),
            "name": "月光の下で 第1巻",
            "description": "ファンタジー世界を舞台にした冒険小説。月の魔法を操る主人公が、失われた王国の謎を解き明かす物語。",
            "category": "小説",
            "price": Decimal("800"),
            "image_url": "",
            "author": "月野美咲",
            "publisher": "創作サークル MoonLight",
            "publisher_id": publisher_ids["創作サークル MoonLight"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 100,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "product_id": str(uuid.uuid4()),
            "name": "星空のイラスト集",
            "description": "美しい星空と幻想的な風景を描いたイラスト集。全32ページフルカラー。",
            "category": "イラスト集",
            "price": Decimal("1500"),
            "image_url": "",
            "author": "星野蒼",
            "publisher": "創作サークル MoonLight",
            "publisher_id": publisher_ids["創作サークル MoonLight"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 40,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        # ColorPalette の商品
        {
            "product_id": str(uuid.uuid4()),
            "name": "デザインパターン素材集 Vol.1",
            "description": "商用利用可能なデザインパターン素材を500点以上収録。Illustrator、Photoshop対応。",
            "category": "デザイン",
            "price": Decimal("2000"),
            "image_url": "",
            "author": "カラーパレット編集部",
            "publisher": "デザインスタジオ ColorPalette",
            "publisher_id": publisher_ids["デザインスタジオ ColorPalette"],
            "variant_type": "digital",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": "https://example.com/download/design-patterns-vol1",
            "stock_quantity": 0,  # デジタル商品は在庫管理不要
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "product_id": str(uuid.uuid4()),
            "name": "手書き風フォント集",
            "description": "あたたかみのある手書き風フォント10書体を収録。個人・商用利用可能。",
            "category": "フォント",
            "price": Decimal("1200"),
            "image_url": "",
            "author": "カラーパレット編集部",
            "publisher": "デザインスタジオ ColorPalette",
            "publisher_id": publisher_ids["デザインスタジオ ColorPalette"],
            "variant_type": "digital",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": "https://example.com/download/handwriting-fonts",
            "stock_quantity": 0,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        # SoundWave の商品
        {
            "product_id": str(uuid.uuid4()),
            "name": "オリジナルサウンドトラック「波音」",
            "description": "癒やしの音楽をテーマにしたオリジナル楽曲集CD。全10曲収録。",
            "category": "音楽",
            "price": Decimal("1000"),
            "image_url": "",
            "author": "波多野響",
            "publisher": "音楽サークル SoundWave",
            "publisher_id": publisher_ids["音楽サークル SoundWave"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 60,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "product_id": str(uuid.uuid4()),
            "name": "DTM入門ガイド 2025",
            "description": "これからDTMを始める人のための入門書。DAWの選び方から楽曲制作まで丁寧に解説。",
            "category": "技術書",
            "price": Decimal("1800"),
            "image_url": "",
            "author": "音野太郎",
            "publisher": "音楽サークル SoundWave",
            "publisher_id": publisher_ids["音楽サークル SoundWave"],
            "variant_type": "physical",
            "shipping_option_id": None,
            "isdn": None,
            "download_url": None,
            "stock_quantity": 35,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]

    print(f"Creating {len(products)} sample products...")
    for product in products:
        try:
            stock_table.put_item(Item=product)
            print(f"  ✓ Created product: {product['name']}")
        except ClientError as e:
            print(f"  ✗ Error creating product {product['name']}: {e}")

    return products


def create_shipping_options(
    config_table_name: str, region: str = "ap-northeast-1"
) -> list[dict]:
    """サンプル送料設定を作成

    Note: 送料設定は config テーブルに "shipping_options" キーで保存されます
    """
    dynamodb = boto3.resource("dynamodb", region_name=region)
    config_table = dynamodb.Table(config_table_name)

    now = datetime.now(timezone.utc).isoformat()

    shipping_options = [
        {
            "shipping_option_id": str(uuid.uuid4()),
            "label": "レターパックライト",
            "price": 370,
            "sort_order": 1,
            "description": "全国一律370円、ポスト投函",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "shipping_option_id": str(uuid.uuid4()),
            "label": "レターパックプラス",
            "price": 520,
            "sort_order": 2,
            "description": "全国一律520円、対面受取",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "shipping_option_id": str(uuid.uuid4()),
            "label": "クリックポスト",
            "price": 185,
            "sort_order": 3,
            "description": "全国一律185円、追跡可能",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
        {
            "shipping_option_id": str(uuid.uuid4()),
            "label": "宅配便（60サイズ）",
            "price": 800,
            "sort_order": 4,
            "description": "宅配便、関東発送の場合の目安料金",
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        },
    ]

    # Convert Decimal for JSON serialization
    shipping_options_json = json.loads(
        json.dumps(shipping_options, default=decimal_default)
    )

    config_item = {
        "config_key": "shipping_options",
        "value": shipping_options_json,
        "created_at": now,
        "updated_at": now,
    }

    print("Creating shipping options configuration...")
    try:
        config_table.put_item(Item=config_item)
        print(f"  ✓ Created {len(shipping_options)} shipping options")
    except ClientError as e:
        print(f"  ✗ Error creating shipping options: {e}")

    return shipping_options


def main():
    parser = argparse.ArgumentParser(
        description="トレーニング環境用のシードデータを作成します"
    )
    parser.add_argument(
        "--environment",
        "-e",
        default="training",
        choices=["dev", "prod", "training"],
        help="環境 (default: training)",
    )
    parser.add_argument(
        "--events-table",
        help="DynamoDB Events Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--publishers-table",
        help="DynamoDB Publishers Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--stock-table",
        help="DynamoDB Stock Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--config-table",
        help="DynamoDB Config Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--region",
        default="ap-northeast-1",
        help="AWS リージョン (default: ap-northeast-1)",
    )

    args = parser.parse_args()

    # Terraform outputs から設定を取得
    if (
        not args.events_table
        or not args.publishers_table
        or not args.stock_table
        or not args.config_table
    ):
        print(f"Fetching configuration from Terraform outputs ({args.environment})...")
        tf_outputs = get_terraform_outputs(args.environment)

        if not args.events_table:
            args.events_table = tf_outputs.get("events_table")
        if not args.publishers_table:
            args.publishers_table = tf_outputs.get("publishers_table")
        if not args.stock_table:
            args.stock_table = tf_outputs.get("stock_table")
        if not args.config_table:
            args.config_table = tf_outputs.get("config_table")

    # 必須パラメータの検証
    missing_params = []
    if not args.events_table:
        missing_params.append("--events-table")
    if not args.publishers_table:
        missing_params.append("--publishers-table")
    if not args.stock_table:
        missing_params.append("--stock-table")
    if not args.config_table:
        missing_params.append("--config-table")

    if missing_params:
        print(f"Error: The following parameters are required: {', '.join(missing_params)}")
        return 1

    print("=" * 60)
    print("Training Environment Seed Data Setup")
    print("=" * 60)
    print(f"Environment: {args.environment}")
    print(f"Events Table: {args.events_table}")
    print(f"Publishers Table: {args.publishers_table}")
    print(f"Stock Table: {args.stock_table}")
    print(f"Config Table: {args.config_table}")
    print(f"Region: {args.region}")
    print("=" * 60)
    print()

    try:
        # イベント作成
        print("[1/4] Creating Events...")
        events = create_events(args.events_table, args.region)
        print(f"✓ Created {len(events)} events\n")

        # 出版社作成
        print("[2/4] Creating Publishers...")
        publishers = create_publishers(args.publishers_table, args.region)
        print(f"✓ Created {len(publishers)} publishers\n")

        # 商品作成
        print("[3/4] Creating Products...")
        products = create_products(args.stock_table, publishers, args.region)
        print(f"✓ Created {len(products)} products\n")

        # 送料設定作成
        print("[4/4] Creating Shipping Options...")
        shipping_options = create_shipping_options(args.config_table, args.region)
        print(f"✓ Created {len(shipping_options)} shipping options\n")

        print("=" * 60)
        print("Seed data creation completed successfully!")
        print("=" * 60)
        print()
        print("Summary:")
        print(f"  Events: {len(events)}")
        print(f"  Publishers: {len(publishers)}")
        print(f"  Products: {len(products)}")
        print(f"  Shipping Options: {len(shipping_options)}")
        print()

        return 0
    except Exception as e:
        print(f"Error: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
