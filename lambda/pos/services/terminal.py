"""
Terminal management services
POS端末の認証機能を提供
"""

import base64
import os
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

import boto3
from botocore.exceptions import ClientError

# Ed25519署名検証用
try:
    from nacl.signing import VerifyKey
    from nacl.exceptions import BadSignatureError

    NACL_AVAILABLE = True
except ImportError:
    NACL_AVAILABLE = False

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
TERMINALS_TABLE = os.environ.get("TERMINALS_TABLE", f"{ENVIRONMENT}-mizpos-terminals")

# リプレイ攻撃防止のための許容時間差（秒）
TIMESTAMP_TOLERANCE = 300  # 5分

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
terminals_table = dynamodb.Table(TERMINALS_TABLE)


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""
    result = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        else:
            result[key] = value
    return result


def get_terminal(terminal_id: str) -> Optional[dict]:
    """端末情報を取得

    Args:
        terminal_id: 端末ID

    Returns:
        端末情報。存在しない場合はNone
    """
    try:
        response = terminals_table.get_item(Key={"terminal_id": terminal_id})
        item = response.get("Item")
        if item:
            return dynamo_to_dict(item)
        return None
    except ClientError:
        return None


def update_terminal_last_seen(terminal_id: str) -> None:
    """端末の最終アクセス時刻を更新

    Args:
        terminal_id: 端末ID
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        terminals_table.update_item(
            Key={"terminal_id": terminal_id},
            UpdateExpression="SET last_seen_at = :last_seen",
            ExpressionAttributeValues={":last_seen": now},
        )
    except ClientError:
        pass  # 更新失敗は無視


def verify_terminal_signature(
    terminal_id: str,
    timestamp: int,
    signature: str,
) -> tuple[bool, Optional[dict], Optional[str]]:
    """端末の署名を検証

    Args:
        terminal_id: 端末ID
        timestamp: Unix タイムスタンプ
        signature: Base64エンコードされたEd25519署名

    Returns:
        (検証成功, 端末情報, エラーメッセージ) のタプル
    """
    if not NACL_AVAILABLE:
        return (
            False,
            None,
            "Signature verification not available (PyNaCl not installed)",
        )

    # タイムスタンプの検証（リプレイ攻撃対策）
    current_time = int(time.time())
    if abs(current_time - timestamp) > TIMESTAMP_TOLERANCE:
        return False, None, "Timestamp out of range"

    # 端末情報を取得
    terminal = get_terminal(terminal_id)
    if not terminal:
        return False, None, "Terminal not found"

    if terminal.get("status") != "active":
        return False, None, "Terminal is revoked"

    # 公開鍵を取得
    try:
        public_key_bytes = base64.b64decode(terminal["public_key"])
        verify_key = VerifyKey(public_key_bytes)
    except Exception as e:
        return False, None, f"Invalid public key: {e}"

    # 署名対象のメッセージを構築
    message = f"{terminal_id}:{timestamp}".encode("utf-8")

    # 署名を検証
    try:
        signature_bytes = base64.b64decode(signature)
        verify_key.verify(message, signature_bytes)
    except BadSignatureError:
        return False, None, "Invalid signature"
    except Exception as e:
        return False, None, f"Signature verification failed: {e}"

    # 最終アクセス時刻を更新
    update_terminal_last_seen(terminal_id)

    return True, terminal, None


def authenticate_terminal(
    terminal_id: str,
    timestamp: int,
    signature: str,
) -> Optional[dict]:
    """端末を認証

    Args:
        terminal_id: 端末ID
        timestamp: Unix タイムスタンプ
        signature: Base64エンコードされたEd25519署名

    Returns:
        認証成功時は端末情報、失敗時はNone

    Raises:
        ValueError: 認証失敗時
    """
    success, terminal, error = verify_terminal_signature(
        terminal_id, timestamp, signature
    )
    if not success:
        raise ValueError(error or "Authentication failed")
    return terminal


def check_terminal_registered(terminal_id: str) -> tuple[bool, Optional[str]]:
    """端末が登録済みかどうかを確認

    Args:
        terminal_id: 端末ID

    Returns:
        (登録済み, ステータス) のタプル
    """
    terminal = get_terminal(terminal_id)
    if terminal:
        return True, terminal.get("status")
    return False, None
