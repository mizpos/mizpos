"""Email service using AWS SES with Jinja2 templates"""

import os
from pathlib import Path
from typing import Optional
from datetime import datetime

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

    body_html = render_template(
        "verification.html", verification_code=verification_code
    )
    body_text = render_template("verification.txt", verification_code=verification_code)

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
    subject = "【みずPOS】ご登録ありがとうございます"

    body_html = render_template("welcome.html", display_name=display_name)
    body_text = render_template("welcome.txt", display_name=display_name)

    return send_email(email, subject, body_html, body_text)
