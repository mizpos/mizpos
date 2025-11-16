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
    price: float = Field(..., ge=0)
    image_url: str = Field(default="", max_length=500)
    author: str = Field(default="", max_length=100)
    publisher: str = Field(default="", max_length=100)
    variant_type: VariantType = Field(default=VariantType.PHYSICAL)


class CreateProductRequest(ProductBase):
    stock_quantity: int = Field(default=0, ge=0)
    operator_id: str | None = None


class UpdateProductRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    price: float | None = Field(default=None, ge=0)
    image_url: str | None = Field(default=None, max_length=500)
    author: str | None = Field(default=None, max_length=100)
    publisher: str | None = Field(default=None, max_length=100)
    variant_type: VariantType | None = None
    is_active: bool | None = None


class AdjustStockRequest(BaseModel):
    quantity_change: int = Field(..., description="正で入庫、負で出庫")
    reason: str = Field(..., min_length=1, max_length=500)
    operator_id: str = Field(default="", max_length=100)


class ProductResponse(ProductBase):
    product_id: str
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
