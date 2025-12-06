"""
POS認証ヘルパー
X-POS-Session ヘッダーからセッションを検証
"""

import logging
from typing import Optional

from fastapi import HTTPException, Request

from services.employee import verify_pos_session
from services.terminal import verify_terminal_signature

logger = logging.getLogger(__name__)


async def get_pos_session(request: Request) -> dict:
    """X-POS-Session ヘッダーからセッションを取得・検証

    Args:
        request: FastAPI Request

    Returns:
        セッション情報

    Raises:
        HTTPException: セッションが無効な場合
    """
    session_id = request.headers.get("X-POS-Session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing POS session header")

    session = verify_pos_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return session


async def require_terminal_auth(
    terminal_id: str,
    timestamp: int,
    signature: str,
) -> dict:
    """端末認証を検証

    Args:
        terminal_id: 端末ID
        timestamp: タイムスタンプ
        signature: Ed25519署名

    Returns:
        端末情報

    Raises:
        HTTPException: 認証失敗時
    """
    success, terminal, error = verify_terminal_signature(
        terminal_id, timestamp, signature
    )

    if not success:
        raise HTTPException(
            status_code=401,
            detail=error or "Terminal authentication failed",
        )

    return terminal


def get_session_id_from_request(request: Request) -> Optional[str]:
    """リクエストからセッションIDを取得（例外を投げない版）

    Args:
        request: FastAPI Request

    Returns:
        セッションID、存在しない場合はNone
    """
    return request.headers.get("X-POS-Session")
