"""
Terminal management services
POS端末の登録・認証・管理機能を提供
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


def register_terminal(
    terminal_id: str,
    public_key: str,
    device_name: str,
    os_type: str,
    registered_by: str,
) -> dict:
    """端末を登録

    Args:
        terminal_id: 端末ID (UUID)
        public_key: Base64エンコードされたEd25519公開鍵
        device_name: 端末名
        os_type: OS種別 (macos, windows, android)
        registered_by: 登録したユーザーのuser_id

    Returns:
        登録された端末情報

    Raises:
        ValueError: 端末IDが既に存在する場合
    """
    # 公開鍵のバリデーション
    try:
        key_bytes = base64.b64decode(public_key)
        if len(key_bytes) != 32:
            raise ValueError("Invalid public key length: must be 32 bytes")

        # PyNaClが利用可能な場合、公開鍵の形式を検証
        if NACL_AVAILABLE:
            try:
                VerifyKey(key_bytes)
            except Exception as e:
                raise ValueError(f"Invalid Ed25519 public key: {e}") from e
    except Exception as e:
        raise ValueError(f"Invalid public key format: {e}") from e

    now = datetime.now(timezone.utc).isoformat()

    item = {
        "terminal_id": terminal_id,
        "public_key": public_key,
        "device_name": device_name,
        "os": os_type,
        "status": "active",
        "registered_by": registered_by,
        "registered_at": now,
    }

    try:
        terminals_table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(terminal_id)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise ValueError("Terminal ID already exists") from e
        raise

    return dynamo_to_dict(item)


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


def list_terminals(status: Optional[str] = None) -> list[dict]:
    """端末一覧を取得

    Args:
        status: ステータスでフィルタ (active, revoked)

    Returns:
        端末のリスト
    """
    try:
        if status:
            # GSI を使用してステータスでフィルタ
            response = terminals_table.query(
                IndexName="StatusIndex",
                KeyConditionExpression="status = :status",
                ExpressionAttributeValues={":status": status},
            )
        else:
            response = terminals_table.scan()

        return [dynamo_to_dict(item) for item in response.get("Items", [])]
    except ClientError:
        return []


def revoke_terminal(terminal_id: str) -> bool:
    """端末を無効化（revoke）

    Args:
        terminal_id: 端末ID

    Returns:
        成功した場合True
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        terminals_table.update_item(
            Key={"terminal_id": terminal_id},
            UpdateExpression="SET #status = :status, revoked_at = :revoked_at",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":status": "revoked",
                ":revoked_at": now,
            },
            ConditionExpression="attribute_exists(terminal_id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def delete_terminal(terminal_id: str) -> bool:
    """端末を完全に削除

    Args:
        terminal_id: 端末ID

    Returns:
        成功した場合True
    """
    try:
        terminals_table.delete_item(
            Key={"terminal_id": terminal_id},
            ConditionExpression="attribute_exists(terminal_id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


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
        return False, None, "Signature verification not available (PyNaCl not installed)"

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
    success, terminal, error = verify_terminal_signature(terminal_id, timestamp, signature)
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
