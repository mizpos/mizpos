"""
POS API用Pydanticモデル
リクエスト/レスポンスのバリデーション
"""

from typing import Optional

from pydantic import BaseModel, Field


# ==========================================
# 端末認証
# ==========================================


class TerminalAuthRequest(BaseModel):
    """端末認証リクエスト"""

    terminal_id: str = Field(..., description="端末ID (UUID)")
    timestamp: int = Field(..., description="Unix タイムスタンプ")
    signature: str = Field(..., description="Base64エンコードされたEd25519署名")


class TerminalRevokeRequest(BaseModel):
    """端末無効化リクエスト"""

    terminal_id: str = Field(..., description="端末ID (UUID)")
    timestamp: int = Field(..., description="Unix タイムスタンプ")
    signature: str = Field(..., description="Base64エンコードされたEd25519署名")


# ==========================================
# 従業員認証
# ==========================================


class PosLoginRequest(BaseModel):
    """POSログインリクエスト"""

    employee_number: str = Field(
        ..., min_length=7, max_length=7, description="従業員番号（7桁）"
    )
    pin: str = Field(..., min_length=3, max_length=8, description="PIN（3〜8桁）")
    terminal_id: str = Field(..., description="端末ID")


class PosSessionRefreshRequest(BaseModel):
    """POSセッション延長/ログアウトリクエスト"""

    session_id: str = Field(..., description="セッションID")


class PosSetEventRequest(BaseModel):
    """POSセッションにイベント設定リクエスト"""

    event_id: str = Field(..., description="イベントID")


# ==========================================
# 販売
# ==========================================


class PosSaleItem(BaseModel):
    """販売アイテム"""

    product_id: str = Field(..., description="商品ID")
    quantity: int = Field(..., ge=1, description="数量")
    unit_price: int = Field(..., ge=0, description="単価")
    product_name: Optional[str] = Field(None, description="商品名（履歴用）")
    circle_name: Optional[str] = Field(None, description="サークル名（履歴用）")
    jan: Optional[str] = Field(None, description="JANコード")
    jan2: Optional[str] = Field(None, description="JANコード2")
    isbn: Optional[str] = Field(None, description="ISBN")
    isdn: Optional[str] = Field(None, description="ISDN")


class PosSaleRequest(BaseModel):
    """POS販売リクエスト"""

    items: list[PosSaleItem] = Field(..., min_length=1, description="販売アイテム")
    total_amount: int = Field(..., ge=0, description="合計金額（クーポン割引後）")
    payment_method: str = Field(..., description="支払い方法 (cash/card/other)")
    event_id: Optional[str] = Field(None, description="イベントID")
    terminal_id: Optional[str] = Field(None, description="端末ID")
    coupon_code: Optional[str] = Field(None, description="クーポンコード")
    subtotal: Optional[int] = Field(None, description="クーポン割引前の小計")


# ==========================================
# クーポン
# ==========================================


class ApplyCouponRequest(BaseModel):
    """クーポン適用リクエスト"""

    code: str = Field(..., description="クーポンコード")
    subtotal: int = Field(..., ge=0, description="小計金額")
    publisher_id: Optional[str] = Field(None, description="サークルID")


# ==========================================
# オフライン同期
# ==========================================


class OfflineSalesSyncRequest(BaseModel):
    """オフライン販売同期リクエスト"""

    sales: list[dict] = Field(..., description="オフライン販売データのリスト")
