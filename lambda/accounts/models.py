from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)


class CreateUserRequest(UserBase):
    password: str = Field(..., min_length=8)


class UpdateUserRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)


class UserResponse(UserBase):
    user_id: str
    cognito_user_id: str | None = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ConfirmEmailRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(..., min_length=6, max_length=6)


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


class AssignRoleRequest(BaseModel):
    """ロール付与リクエスト

    event_idまたはpublisher_idのどちらかを指定する必要があります。
    role_typeによってスコープが自動的に決まります:
      - system_admin: スコープはsystem (event_id/publisher_idは不要)
      - publisher_admin/publisher_sales: スコープはpublisher (publisher_id必須)
      - event_admin/event_sales: スコープはevent (event_id必須)
    """

    event_id: str | None = None
    publisher_id: str | None = None
    role_type: str = Field(
        ...,
        pattern="^(system_admin|publisher_admin|publisher_sales|event_admin|event_sales)$",
    )


class RoleResponse(BaseModel):
    """ロールレスポンス"""

    user_id: str
    role_id: str
    scope: str  # system | publisher | event
    event_id: str | None = None
    publisher_id: str | None = None
    role_type: str
    created_at: str
    created_by: str | None = None  # ロールを付与したユーザーのID

    class Config:
        from_attributes = True


class ListRolesRequest(BaseModel):
    """ロール一覧取得リクエスト（フィルタ用）"""

    scope: str | None = Field(None, pattern="^(system|publisher|event)$")
    publisher_id: str | None = None
    event_id: str | None = None


# 住所管理用モデル
class SavedAddress(BaseModel):
    address_id: str
    label: str = Field(
        ..., min_length=1, max_length=50, description="住所のラベル（例: 自宅、会社）"
    )
    name: str = Field(..., min_length=1, max_length=200)
    postal_code: str = Field(..., min_length=1, max_length=20)
    prefecture: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=200)
    address_line1: str = Field(..., min_length=1, max_length=300)
    address_line2: str | None = None
    phone_number: str = Field(..., min_length=1, max_length=50)
    is_default: bool = False

    class Config:
        from_attributes = True


class CreateAddressRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    postal_code: str = Field(..., min_length=1, max_length=20)
    prefecture: str = Field(..., min_length=1, max_length=100)
    city: str = Field(..., min_length=1, max_length=200)
    address_line1: str = Field(..., min_length=1, max_length=300)
    address_line2: str | None = None
    phone_number: str = Field(..., min_length=1, max_length=50)
    is_default: bool = False


class UpdateAddressRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    postal_code: str | None = Field(default=None, min_length=1, max_length=20)
    prefecture: str | None = Field(default=None, min_length=1, max_length=100)
    city: str | None = Field(default=None, min_length=1, max_length=200)
    address_line1: str | None = Field(default=None, min_length=1, max_length=300)
    address_line2: str | None = None
    phone_number: str | None = Field(default=None, min_length=1, max_length=50)
    is_default: bool | None = None
