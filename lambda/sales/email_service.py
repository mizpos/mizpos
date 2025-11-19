"""Email service for sales notifications using AWS SES"""

import os
from typing import Optional, Dict, Any
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

# SES クライアント
ses_client = boto3.client(
    "ses", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
)

# 環境変数
SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", "noreply@miz.cab")
CONFIGURATION_SET = os.environ.get("SES_CONFIGURATION_SET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://sales.stg-pos.miz.cab")


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


def format_currency(amount: Decimal) -> str:
    """金額を通貨形式にフォーマット"""
    return f"¥{int(amount):,}"


def send_order_confirmation_email(order_data: Dict[str, Any]) -> bool:
    """
    注文確認メールを送信

    Args:
        order_data: 注文データ（DynamoDBのレコード）

    Returns:
        送信成功時True、失敗時False
    """
    email = order_data.get("customer_email", "")
    customer_name = order_data.get("customer_name", "")
    order_id = order_data.get("sale_id", "")

    if not email:
        print("Customer email not found in order data")
        return False

    subject = f"【みずPOS】ご注文ありがとうございます（注文番号: {order_id[:8]}）"

    # 商品一覧のHTML
    items_html = ""
    items_text = ""
    for item in order_data.get("items", []):
        item_name = item.get("product_name", "")
        item_price = format_currency(Decimal(str(item.get("unit_price", 0))))
        quantity = item.get("quantity", 0)
        subtotal = format_currency(Decimal(str(item.get("subtotal", 0))))

        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">{item_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right;">{item_price}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">{quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: right;">{subtotal}</td>
        </tr>
        """

        items_text += f"{item_name} / {item_price} × {quantity} = {subtotal}\n"

    # 配送先住所
    shipping = order_data.get("shipping_address", {})
    shipping_address = f"""
    {shipping.get("postal_code", "")} {shipping.get("prefecture", "")}{shipping.get("city", "")}
    {shipping.get("address_line1", "")} {shipping.get("address_line2", "")}
    """

    subtotal = format_currency(Decimal(str(order_data.get("subtotal", 0))))
    discount = format_currency(Decimal(str(order_data.get("discount", 0))))
    shipping_fee = format_currency(Decimal(str(order_data.get("shipping_fee", 0))))
    total = format_currency(Decimal(str(order_data.get("total", 0))))

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">ご注文ありがとうございます</h2>

            <p>{customer_name} 様</p>

            <p>ご注文を受け付けました。以下の内容をご確認ください。</p>

            <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 5px 0;"><strong>注文番号:</strong> {order_id}</p>
            </div>

            <h3 style="color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px;">ご注文内容</h3>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">商品名</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">単価</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">数量</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #dee2e6;">小計</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <div style="text-align: right; margin: 20px 0;">
                <p style="margin: 5px 0;">小計: {subtotal}</p>
                <p style="margin: 5px 0;">割引: {discount}</p>
                <p style="margin: 5px 0;">送料: {shipping_fee}</p>
                <p style="margin: 15px 0 5px 0; font-size: 20px; font-weight: bold; color: #007bff;">
                    合計: {total}
                </p>
            </div>

            <h3 style="color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px;">お届け先</h3>
            <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 5px 0;">{shipping.get("name", "")}</p>
                <p style="margin: 5px 0;">{shipping_address}</p>
                <p style="margin: 5px 0;">電話番号: {shipping.get("phone_number", "")}</p>
            </div>

            <p>商品発送時に改めてメールでお知らせいたします。</p>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

            <p style="color: #6c757d; font-size: 12px;">
                このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
            </p>
        </div>
    </body>
    </html>
    """

    body_text = f"""
【みずPOS】ご注文ありがとうございます

{customer_name} 様

ご注文を受け付けました。以下の内容をご確認ください。

注文番号: {order_id}

■ ご注文内容
{items_text}
小計: {subtotal}
割引: {discount}
送料: {shipping_fee}
合計: {total}

■ お届け先
{shipping.get("name", "")}
{shipping_address}
電話番号: {shipping.get("phone_number", "")}

商品発送時に改めてメールでお知らせいたします。

---
このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
    """

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
    customer_name = order_data.get("customer_name", "")
    order_id = order_data.get("sale_id", "")

    if not email:
        print("Customer email not found in order data")
        return False

    subject = f"【みずPOS】商品を発送しました（注文番号: {order_id[:8]}）"

    # 商品一覧のHTML（簡易版）
    items_html = ""
    items_text = ""
    for item in order_data.get("items", []):
        item_name = item.get("product_name", "")
        quantity = item.get("quantity", 0)

        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">{item_name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #dee2e6; text-align: center;">{quantity}</td>
        </tr>
        """

        items_text += f"{item_name} × {quantity}\n"

    # 配送先住所
    shipping = order_data.get("shipping_address", {})
    shipping_address = f"""
    {shipping.get("postal_code", "")} {shipping.get("prefecture", "")}{shipping.get("city", "")}
    {shipping.get("address_line1", "")} {shipping.get("address_line2", "")}
    """

    tracking_info_html = ""
    tracking_info_text = ""
    if tracking_number:
        tracking_info_html = f"""
        <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #ffc107;">
            <p style="margin: 5px 0;"><strong>追跡番号:</strong> {tracking_number}</p>
            <p style="margin: 5px 0; font-size: 14px; color: #856404;">
                配送業者のサイトで配送状況を確認できます。
            </p>
        </div>
        """
        tracking_info_text = f"\n追跡番号: {tracking_number}\n配送業者のサイトで配送状況を確認できます。\n"

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">商品を発送しました</h2>

            <p>{customer_name} 様</p>

            <p>ご注文いただいた商品を発送いたしました。</p>

            <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 5px 0;"><strong>注文番号:</strong> {order_id}</p>
            </div>

            {tracking_info_html}

            <h3 style="color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px;">発送商品</h3>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background-color: #f8f9fa;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">商品名</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">数量</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>

            <h3 style="color: #2c3e50; border-bottom: 2px solid #007bff; padding-bottom: 10px;">お届け先</h3>
            <div style="background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px;">
                <p style="margin: 5px 0;">{shipping.get("name", "")}</p>
                <p style="margin: 5px 0;">{shipping_address}</p>
                <p style="margin: 5px 0;">電話番号: {shipping.get("phone_number", "")}</p>
            </div>

            <p>商品到着まで今しばらくお待ちください。</p>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

            <p style="color: #6c757d; font-size: 12px;">
                このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
            </p>
        </div>
    </body>
    </html>
    """

    body_text = f"""
【みずPOS】商品を発送しました

{customer_name} 様

ご注文いただいた商品を発送いたしました。

注文番号: {order_id}
{tracking_info_text}
■ 発送商品
{items_text}
■ お届け先
{shipping.get("name", "")}
{shipping_address}
電話番号: {shipping.get("phone_number", "")}

商品到着まで今しばらくお待ちください。

---
このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
    """

    return send_email(email, subject, body_html, body_text)
