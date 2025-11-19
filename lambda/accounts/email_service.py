"""Email service using AWS SES"""
import os
from typing import Optional
import boto3
from botocore.exceptions import ClientError

# SES クライアント
ses_client = boto3.client("ses", region_name=os.environ.get("AWS_REGION", "ap-northeast-1"))

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
            "Body": {
                "Html": {"Data": body_html, "Charset": "UTF-8"}
            }
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


def send_verification_email(email: str, verification_code: str) -> bool:
    """
    メール認証コードを送信

    Args:
        email: 送信先メールアドレス
        verification_code: 認証コード

    Returns:
        送信成功時True、失敗時False
    """
    subject = "【みずPOS】メールアドレス認証"

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">メールアドレスの認証</h2>

            <p>みずPOSにご登録いただき、ありがとうございます。</p>

            <p>以下の認証コードを入力して、メールアドレスの認証を完了してください。</p>

            <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px;">
                <p style="margin: 0; font-size: 14px; color: #6c757d;">認証コード</p>
                <p style="margin: 10px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff;">
                    {verification_code}
                </p>
            </div>

            <p style="color: #6c757d; font-size: 14px;">
                このコードは10分間有効です。<br>
                お心当たりがない場合は、このメールを無視してください。
            </p>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

            <p style="color: #6c757d; font-size: 12px;">
                このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
            </p>
        </div>
    </body>
    </html>
    """

    body_text = f"""
【みずPOS】メールアドレス認証

みずPOSにご登録いただき、ありがとうございます。

以下の認証コードを入力して、メールアドレスの認証を完了してください。

認証コード: {verification_code}

このコードは10分間有効です。
お心当たりがない場合は、このメールを無視してください。

---
このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
    """

    return send_email(email, subject, body_html, body_text)


def send_welcome_email(email: str, display_name: str) -> bool:
    """
    登録完了メールを送信

    Args:
        email: 送信先メールアドレス
        display_name: 表示名

    Returns:
        送信成功時True、失敗時False
    """
    subject = "【みずPOS】登録完了のお知らせ"

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">登録完了</h2>

            <p>{display_name} 様</p>

            <p>みずPOSへのご登録が完了しました。</p>

            <p>これからみずPOSのオンラインショップをご利用いただけます。</p>

            <div style="margin: 30px 0;">
                <a href="{FRONTEND_URL}"
                   style="display: inline-block; padding: 12px 30px; background-color: #007bff;
                          color: #fff; text-decoration: none; border-radius: 5px;">
                    ショップを見る
                </a>
            </div>

            <p>今後ともよろしくお願いいたします。</p>

            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

            <p style="color: #6c757d; font-size: 12px;">
                このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
            </p>
        </div>
    </body>
    </html>
    """

    body_text = f"""
【みずPOS】登録完了のお知らせ

{display_name} 様

みずPOSへのご登録が完了しました。

これからみずPOSのオンラインショップをご利用いただけます。

ショップURL: {FRONTEND_URL}

今後ともよろしくお願いいたします。

---
このメールは送信専用です。返信いただいても対応できませんのでご了承ください。
    """

    return send_email(email, subject, body_html, body_text)
