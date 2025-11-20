"""
Cloudflare Turnstile verification module
"""

import logging
import os

import boto3
import httpx
from botocore.exceptions import ClientError

logger = logging.getLogger()


def get_turnstile_secret_key() -> str:
    """
    AWS Secrets ManagerからTurnstileのsecret keyを取得

    Returns:
        str: Turnstile secret key

    Raises:
        Exception: Secrets Managerからの取得に失敗した場合
    """
    environment = os.environ.get("ENVIRONMENT", "dev")
    secret_name = f"mizpos-{environment}-turnstile-secret-key"

    # Secrets Managerクライアントを作成
    session = boto3.session.Session()
    client = session.client(service_name="secretsmanager", region_name="ap-northeast-1")

    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
        return get_secret_value_response["SecretString"]
    except ClientError as e:
        logger.error(f"Failed to retrieve secret: {e}")
        raise


async def verify_turnstile_token(token: str, remote_ip: str | None = None) -> bool:
    """
    Cloudflare TurnstileのトークンをAPIで検証

    Args:
        token: フロントエンドから受け取ったTurnstileトークン
        remote_ip: クライアントのIPアドレス（オプション）

    Returns:
        bool: 検証に成功した場合True、失敗した場合False

    Raises:
        Exception: API呼び出しに失敗した場合
    """
    secret_key = get_turnstile_secret_key()

    # Cloudflare Turnstile検証エンドポイント
    verify_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    # リクエストペイロード
    payload = {"secret": secret_key, "response": token}

    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(verify_url, json=payload, timeout=10.0)
            response.raise_for_status()

            result = response.json()
            logger.info(f"Turnstile verification result: {result}")

            return result.get("success", False)

    except httpx.HTTPError as e:
        logger.error(f"Turnstile verification HTTP error: {e}")
        raise
    except Exception as e:
        logger.error(f"Turnstile verification error: {e}")
        raise
