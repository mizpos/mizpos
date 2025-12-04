from enum import Enum

from pydantic import BaseModel, Field


class VariantType(str, Enum):
    PHYSICAL = "physical"
    DIGITAL = "digital"
    BOTH = "both"


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = Field(..., min_length=1, max_length=100)
    price: float = Field(..., ge=50, description="商品価格（50円以上）")
    image_url: str = Field(default="", max_length=500)
    author: str = Field(default="", max_length=100)
    publisher: str = Field(default="", max_length=100)  # 後方互換性のため残す
    publisher_id: str | None = Field(default=None, description="出版社/サークルID")
    variant_type: VariantType = Field(default=VariantType.PHYSICAL)
    shipping_option_id: str | None = Field(
        default=None, description="送料設定ID（紐付けなし = 送料無料）"
    )
    isdn: str | None = Field(
        default=None, max_length=50, description="国際標準同人誌番号"
    )
    jan_code: str | None = Field(
        default=None, max_length=13, description="JANコード（流通用バーコード）"
    )
    download_url: str | None = Field(
        default=None, max_length=1000, description="ダウンロードリンク"
    )


class CreateProductRequest(ProductBase):
    stock_quantity: int = Field(default=0, ge=0)
    operator_id: str | None = None


class UpdateProductRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    price: float | None = Field(default=None, ge=50, description="商品価格（50円以上）")
    image_url: str | None = Field(default=None, max_length=500)
    author: str | None = Field(default=None, max_length=100)
    publisher: str | None = Field(default=None, max_length=100)
    publisher_id: str | None = Field(default=None, description="出版社/サークルID")
    variant_type: VariantType | None = None
    shipping_option_id: str | None = Field(
        default=None, description="送料設定ID（紐付けなし = 送料無料）"
    )
    isdn: str | None = Field(
        default=None, max_length=50, description="国際標準同人誌番号"
    )
    jan_code: str | None = Field(
        default=None, max_length=13, description="JANコード（流通用バーコード）"
    )
    download_url: str | None = Field(
        default=None, max_length=1000, description="ダウンロードリンク"
    )
    is_active: bool | None = None


# Publisher (サークル/出版社) モデル
class PublisherBase(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=200, description="サークル/出版社名"
    )
    description: str = Field(default="", max_length=2000, description="説明")
    contact_email: str | None = Field(
        default=None, max_length=200, description="連絡先メール"
    )
    commission_rate: float = Field(
        default=0.0, ge=0, le=100, description="委託手数料率（%）"
    )
    stripe_online_fee_rate: float = Field(
        default=3.6, ge=0, le=100, description="Stripeオンライン決済手数料率（%）"
    )
    stripe_terminal_fee_rate: float = Field(
        default=3.6, ge=0, le=100, description="Stripe端末決済手数料率（%）"
    )


class CreatePublisherRequest(PublisherBase):
    pass


class UpdatePublisherRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    contact_email: str | None = Field(default=None, max_length=200)
    commission_rate: float | None = Field(default=None, ge=0, le=100)
    stripe_online_fee_rate: float | None = Field(default=None, ge=0, le=100)
    stripe_terminal_fee_rate: float | None = Field(default=None, ge=0, le=100)
    is_active: bool | None = None


class PublisherResponse(PublisherBase):
    publisher_id: str
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class AdjustStockRequest(BaseModel):
    quantity_change: int = Field(..., description="正で入庫、負で出庫")
    reason: str = Field(..., min_length=1, max_length=500)
    operator_id: str = Field(default="", max_length=100)


class ProductResponse(BaseModel):
    product_id: str
    name: str
    description: str
    category: str
    price: float
    image_url: str
    author: str
    publisher: str
    publisher_id: str | None = None
    variant_type: str
    shipping_option_id: str | None = None
    isdn: str | None = None
    jan_code: str | None = None
    download_url: str | None = None
    stock_quantity: int
    is_active: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class StockHistoryResponse(BaseModel):
    product_id: str
    timestamp: int
    quantity_before: int
    quantity_after: int
    quantity_change: int
    reason: str
    operator_id: str
    created_at: str

    class Config:
        from_attributes = True


# ISDN/JAN バーコード生成用モデル
class GenerateISDNRequest(BaseModel):
    group: str = Field(default="4", description="グループ記号（日本は4）")


class GenerateBarcodeRequest(BaseModel):
    isdn: str | None = Field(default=None, description="既存のISDN（ハイフン区切り）")
    product_id: str = Field(default="", description="商品ID（ISDN未付与時に使用）")
    price: int = Field(default=0, ge=0, description="価格")
    c_code: str = Field(default="3055", description="Cコード（4桁）")


class BarcodeResponse(BaseModel):
    isdn: str | None
    isdn_formatted: str | None
    jan_barcode_1: str
    jan_barcode_2: str
    full_display: str


# Upload用モデル
class UploadType(str, Enum):
    BOOK_COVER = "book_cover"
    PUBLISHER_LOGO = "publisher_logo"
    OTHER = "other"


class UploadRequest(BaseModel):
    filename: str = Field(
        ..., min_length=1, max_length=255, description="アップロードするファイル名"
    )
    content_type: str = Field(..., description="MIMEタイプ（例: image/jpeg）")
    upload_type: UploadType = Field(
        default=UploadType.BOOK_COVER, description="アップロードの種類"
    )


class UploadResponse(BaseModel):
    upload_url: str = Field(..., description="アップロード用のPresigned URL")
    cdn_url: str = Field(..., description="アップロード完了後のCDN URL")
    object_key: str = Field(..., description="S3オブジェクトキー")
    expires_in: int = Field(..., description="URLの有効期限（秒）")


# Event (イベント) モデル
class EventBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="イベント名")
    description: str = Field(default="", max_length=2000, description="説明")
    start_date: str | None = Field(default=None, description="開始日（YYYY-MM-DD）")
    end_date: str | None = Field(default=None, description="終了日（YYYY-MM-DD）")
    location: str = Field(default="", max_length=200, description="開催場所")
    publisher_id: str | None = Field(
        default=None, description="サークルID（nullの場合はglobalイベント）"
    )


class CreateEventRequest(EventBase):
    pass


class UpdateEventRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    start_date: str | None = Field(default=None)
    end_date: str | None = Field(default=None)
    location: str | None = Field(default=None, max_length=200)
    publisher_id: str | None = Field(default=None)
    is_active: bool | None = None


class EventResponse(EventBase):
    event_id: str
    event_code: str = Field(
        ..., description="4桁のイベントコード（従業員番号の先頭4桁）"
    )
    is_active: bool
    product_ids: list[str] = Field(default_factory=list, description="紐づく商品IDリスト")
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SetEventProductsRequest(BaseModel):
    """イベントに紐づく商品リストを設定"""

    product_ids: list[str] = Field(..., description="商品IDのリスト")


class EventProductRequest(BaseModel):
    """イベントに商品を追加/削除"""

    product_id: str = Field(..., description="商品ID")
