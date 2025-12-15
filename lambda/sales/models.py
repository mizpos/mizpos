from enum import Enum

from pydantic import BaseModel, Field


class PaymentMethod(str, Enum):
    STRIPE_ONLINE = "stripe_online"
    STRIPE_TERMINAL = "stripe_terminal"
    CASH = "cash"


class SaleStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class CartItem(BaseModel):
    product_id: str
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)


class CouponFilter(BaseModel):
    product_ids: list[str] | None = None
    categories: list[str] | None = None


class CreateCouponRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    discount_type: str = Field(..., pattern="^(percentage|fixed)$")
    discount_value: float = Field(..., gt=0)
    max_uses: int | None = Field(default=None, ge=1)
    valid_until: str | None = None
    filter: CouponFilter | None = None


class ApplyCouponRequest(BaseModel):
    code: str = Field(..., min_length=1)
    cart_items: list[CartItem]


class CreateSaleRequest(BaseModel):
    event_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    cart_items: list[CartItem]
    payment_method: PaymentMethod
    coupon_code: str | None = None
    customer_email: str | None = None


class CreatePaymentIntentRequest(BaseModel):
    amount: int = Field(..., gt=0, description="金額（円）")
    currency: str = Field(default="jpy")
    customer_email: str | None = None
    metadata: dict | None = None


class CreateEventRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    start_date: int = Field(..., description="Unix timestamp (milliseconds)")
    end_date: int = Field(..., description="Unix timestamp (milliseconds)")


# 設定管理用モデル
class StripeTerminalConfigRequest(BaseModel):
    location_id: str = Field(
        ..., min_length=1, description="Stripe Terminal Location ID"
    )
    reader_id: str | None = Field(
        default=None, description="Stripe Terminal Reader ID (optional)"
    )
    description: str | None = Field(default=None, description="設定の説明")


class StripeTerminalConfigResponse(BaseModel):
    config_key: str
    location_id: str
    reader_id: str | None = None
    description: str | None = None
    updated_at: str
    created_at: str

    class Config:
        from_attributes = True


class ConfigResponse(BaseModel):
    config_key: str
    value: dict
    updated_at: str
    created_at: str

    class Config:
        from_attributes = True


class UpdateConfigRequest(BaseModel):
    value: dict = Field(..., description="設定値（任意のJSONオブジェクト）")


class SaleResponse(BaseModel):
    sale_id: str
    timestamp: int
    event_id: str
    user_id: str
    items: list[dict]
    subtotal: float
    discount: float
    shipping_fee: float | None = None
    total: float
    payment_method: str
    status: str
    stripe_payment_intent_id: str | None = None
    customer_email: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class CouponResponse(BaseModel):
    coupon_id: str
    code: str
    discount_type: str
    discount_value: float
    max_uses: int | None
    current_uses: int
    valid_until: str | None
    filter: dict | None
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


# オンライン販売用モデル
class ShippingAddress(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    postal_code: str = Field(..., min_length=1, max_length=20)
    prefecture: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=200)
    address_line1: str = Field(..., min_length=1, max_length=300)
    address_line2: str | None = None
    phone_number: str = Field(..., min_length=1, max_length=50)


class CreateOnlineOrderRequest(BaseModel):
    cart_items: list[CartItem]
    customer_email: str = Field(..., min_length=1)
    customer_name: str = Field(..., min_length=1, max_length=200)
    shipping_address: ShippingAddress | None = None
    saved_address_id: str | None = Field(
        default=None,
        description="登録済み住所ID（指定された場合はshipping_addressより優先）",
    )
    user_id: str | None = Field(
        default=None, description="ユーザーID（saved_address_id使用時に必要）"
    )
    coupon_code: str | None = None
    notes: str | None = None


class CreateCheckoutSessionRequest(BaseModel):
    cart_items: list[CartItem]
    customer_email: str | None = None
    success_url: str = Field(..., min_length=1)
    cancel_url: str = Field(..., min_length=1)
    coupon_code: str | None = None


class OnlineOrderResponse(BaseModel):
    order_id: str
    customer_email: str
    customer_name: str
    items: list[dict]
    subtotal: float
    discount: float
    shipping_fee: float
    total: float
    status: str
    shipping_address: dict
    stripe_payment_intent_id: str | None = None
    stripe_checkout_session_id: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class UpdateShippingRequest(BaseModel):
    tracking_number: str | None = Field(default=None, max_length=200)
    carrier: str | None = Field(default=None, max_length=100)
    shipping_method: str | None = Field(
        default=None, max_length=200, description="配送方法（レターパック、宅配便など）"
    )
    shipping_method_other: str | None = Field(
        default=None, max_length=200, description="配送方法（その他・手打ち）"
    )
    notes: str | None = Field(default=None, max_length=500)


# 送料設定管理用モデル
class ShippingOptionBase(BaseModel):
    label: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="送料の表示名（例: レターパック）",
    )
    price: int = Field(..., ge=0, description="送料金額（円）")
    sort_order: int = Field(default=0, description="表示順序")
    description: str = Field(default="", max_length=500, description="説明")


class CreateShippingOptionRequest(ShippingOptionBase):
    pass


class UpdateShippingOptionRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    price: int | None = Field(default=None, ge=0)
    sort_order: int | None = Field(default=None)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class ShippingOptionResponse(BaseModel):
    shipping_option_id: str
    label: str
    price: int
    sort_order: int
    description: str
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


# ==============================
# Stripe Terminal用モデル
# ==============================


class TerminalConnectionTokenRequest(BaseModel):
    """Connection Token発行リクエスト"""

    location_id: str | None = Field(
        default=None, description="オプションのロケーションID"
    )


class TerminalRegisterReaderRequest(BaseModel):
    """リーダー登録リクエスト"""

    registration_code: str = Field(
        ..., min_length=1, description="リーダーの登録コード"
    )
    label: str = Field(
        ..., min_length=1, max_length=100, description="リーダーの識別名"
    )
    location_id: str = Field(..., min_length=1, description="StripeロケーションID")


class TerminalPaymentIntentRequest(BaseModel):
    """Terminal用PaymentIntent作成リクエスト"""

    amount: int = Field(..., gt=0, description="金額（円）")
    currency: str = Field(default="jpy", description="通貨コード")
    description: str | None = Field(default=None, max_length=500, description="説明")
    metadata: dict | None = Field(default=None, description="メタデータ")
    # POS連携用メタデータ
    sale_id: str | None = Field(
        default=None, description="販売ID（mizpos-desktop連携用）"
    )
    pnr: str | None = Field(default=None, description="連携番号（ペアリング用）")


class TerminalCaptureRequest(BaseModel):
    """PaymentIntentキャプチャリクエスト"""

    payment_intent_id: str = Field(..., min_length=1, description="PaymentIntentID")


class TerminalRefundRequest(BaseModel):
    """Terminal返金リクエスト"""

    payment_intent_id: str = Field(
        ..., min_length=1, description="返金対象PaymentIntentID"
    )
    amount: int | None = Field(default=None, gt=0, description="返金額（Noneで全額）")
    reason: str | None = Field(default=None, max_length=500, description="返金理由")


class TerminalLocationRequest(BaseModel):
    """ロケーション作成リクエスト"""

    display_name: str = Field(..., min_length=1, max_length=100, description="表示名")
    address_line1: str = Field(
        ..., min_length=1, max_length=200, description="住所1行目"
    )
    city: str = Field(..., min_length=1, max_length=100, description="市区町村")
    state: str = Field(..., min_length=1, max_length=100, description="都道府県")
    country: str = Field(
        default="JP", min_length=2, max_length=2, description="国コード"
    )
    postal_code: str = Field(..., min_length=1, max_length=20, description="郵便番号")
