"""Email service for sales notifications using AWS SES with Jinja2 templates"""

import os
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError
from jinja2 import Environment, FileSystemLoader, select_autoescape

# テンプレート環境の初期化
TEMPLATE_DIR = Path(__file__).parent / "templates"
jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)

# SES クライアント
ses_client = boto3.client(
    "ses", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
)

# 環境変数
SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", "noreply@miz.cab")
CONFIGURATION_SET = os.environ.get("SES_CONFIGURATION_SET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://sales.pos-stg.miz.cab")


def format_currency(amount: Any) -> str:
    """金額を通貨形式にフォーマット"""
    if amount is None:
        return "¥0"
    return f"¥{int(Decimal(str(amount))):,}"


def render_template(template_name: str, **context) -> str:
    """
    Jinja2テンプレートをレンダリング

    Args:
        template_name: テンプレートファイル名
        **context: テンプレートに渡すコンテキスト

    Returns:
        レンダリングされた文字列
    """
    # 共通コンテキスト
    context.setdefault("year", datetime.now().year)
    context.setdefault("frontend_url", FRONTEND_URL)

    # カスタムフィルタ/関数を追加
    context["format_currency"] = format_currency

    template = jinja_env.get_template(template_name)
    return template.render(**context)


def send_email(
    recipient: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """
    AWS SESを使用してメールを送信

    Args:
        recipient: 送信先メールアドレス
        subject: 件名
        body_html: HTML形式の本文
        body_text: テキスト形式の本文（オプション）

    Returns:
        送信成功時True、失敗時False
    """
    try:
        message = {
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Html": {"Data": body_html, "Charset": "UTF-8"}},
        }

        if body_text:
            message["Body"]["Text"] = {"Data": body_text, "Charset": "UTF-8"}

        params = {
            "Source": SENDER_EMAIL,
            "Destination": {"ToAddresses": [recipient]},
            "Message": message,
        }

        if CONFIGURATION_SET:
            params["ConfigurationSetName"] = CONFIGURATION_SET

        response = ses_client.send_email(**params)
        print(f"Email sent successfully. MessageId: {response['MessageId']}")
        return True

    except ClientError as e:
        print(f"Failed to send email: {e.response['Error']['Message']}")
        return False


def send_order_confirmation_email(order_data: Dict[str, Any]) -> bool:
    """
    注文確認メールを送信

    Args:
        order_data: 注文データ（DynamoDBのレコード）

    Returns:
        送信成功時True、失敗時False
    """
    email = order_data.get("customer_email", "")
    if not email:
        print("Customer email not found in order data")
        return False

    order_id = order_data.get("sale_id", "")
    subject = f"【みずPOS】ご注文ありがとうございます（注文番号: {order_id[:8]}）"

    context = {
        "customer_name": order_data.get("customer_name", ""),
        "order_id": order_id,
        "items": order_data.get("items", []),
        "subtotal": Decimal(str(order_data.get("subtotal", 0))),
        "discount": Decimal(str(order_data.get("discount", 0))),
        "shipping_fee": Decimal(str(order_data.get("shipping_fee", 0))),
        "total": Decimal(str(order_data.get("total", 0))),
        "shipping_address": order_data.get("shipping_address", {}),
    }

    body_html = render_template("order_confirmation.html", **context)
    body_text = render_template("order_confirmation.txt", **context)

    return send_email(email, subject, body_html, body_text)


def send_shipping_notification_email(
    order_data: Dict[str, Any], tracking_number: Optional[str] = None
) -> bool:
    """
    発送通知メールを送信

    Args:
        order_data: 注文データ（DynamoDBのレコード）
        tracking_number: 追跡番号（オプション）

    Returns:
        送信成功時True、失敗時False
    """
    email = order_data.get("customer_email", "")
    if not email:
        print("Customer email not found in order data")
        return False

    order_id = order_data.get("sale_id", "")
    subject = f"【みずPOS】商品を発送しました（注文番号: {order_id[:8]}）"

    context = {
        "customer_name": order_data.get("customer_name", ""),
        "order_id": order_id,
        "items": order_data.get("items", []),
        "shipping_address": order_data.get("shipping_address", {}),
        "tracking_number": tracking_number,
    }

    body_html = render_template("shipping_notification.html", **context)
    body_text = render_template("shipping_notification.txt", **context)

    return send_email(email, subject, body_html, body_text)
