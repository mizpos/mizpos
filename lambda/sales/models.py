from enum import Enum

from pydantic import BaseModel, Field


class PaymentMethod(str, Enum):
    STRIPE_ONLINE = "stripe_online"
    STRIPE_TERMINAL = "stripe_terminal"
    CASH = "cash"


class SaleStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
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
    location_id: str = Field(..., min_length=1, description="Stripe Terminal Location ID")
    reader_id: str | None = Field(default=None, description="Stripe Terminal Reader ID (optional)")
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
