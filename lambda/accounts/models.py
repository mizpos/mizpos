from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)


class CreateUserRequest(UserBase):
    password: str = Field(..., min_length=8)


class InviteUserRequest(BaseModel):
    """ユーザー招待リクエスト（メールアドレスと表示名のみ）

    パスワードはユーザー自身がCognitoで設定します。
    """

    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)


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


# Cloudflare Turnstile検証用モデル
class VerifyTurnstileRequest(BaseModel):
    token: str = Field(..., min_length=1, description="Turnstile token from frontend")


# ==========================================
# POS従業員管理用モデル（mizpos-desktop専用）
# ==========================================


class CreatePosEmployeeRequest(BaseModel):
    """POS従業員作成リクエスト

    従業員番号は7桁: イベントコード(4桁) + スタッフ番号(3桁)
    例: 1234567 = イベント1234のスタッフ567
    通期スタッフは0000xxx（例: 0000001）
    """

    employee_number: str = Field(
        ...,
        min_length=7,
        max_length=7,
        pattern="^[0-9]{7}$",
        description="7桁の従業員番号（イベントコード4桁+スタッフ番号3桁）",
    )
    pin: str = Field(
        ...,
        min_length=3,
        max_length=8,
        pattern="^[0-9]+$",
        description="3〜8桁の数字PIN",
    )
    display_name: str = Field(..., min_length=1, max_length=100)
    event_id: str | None = Field(default=None, description="紐付くイベントID")
    publisher_id: str | None = Field(default=None, description="紐付くサークルID")
    user_id: str | None = Field(
        default=None, description="紐付くmizposアカウントのユーザーID"
    )


class UpdatePosEmployeeRequest(BaseModel):
    """POS従業員更新リクエスト"""

    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    pin: str | None = Field(
        default=None,
        min_length=3,
        max_length=8,
        pattern="^[0-9]+$",
        description="3〜8桁の数字PIN",
    )
    event_id: str | None = None
    publisher_id: str | None = None
    active: bool | None = None
    user_id: str | None = None


class PosEmployeeResponse(BaseModel):
    """POS従業員レスポンス"""

    employee_number: str
    display_name: str
    event_id: str | None = None
    publisher_id: str | None = None
    user_id: str | None = None
    active: bool = True
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class PosLoginRequest(BaseModel):
    """POS端末ログインリクエスト"""

    employee_number: str = Field(
        ...,
        min_length=7,
        max_length=7,
        pattern="^[0-9]{7}$",
        description="7桁の従業員番号（イベントコード4桁+スタッフ番号3桁）",
    )
    pin: str = Field(
        ...,
        min_length=3,
        max_length=8,
        pattern="^[0-9]+$",
        description="3〜8桁の数字PIN",
    )
    terminal_id: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="端末ID（Tauriアプリのデバイス識別子）",
    )


class PosLoginResponse(BaseModel):
    """POS端末ログインレスポンス"""

    session_id: str
    employee_number: str
    display_name: str
    event_id: str | None = None
    publisher_id: str | None = None
    expires_at: int  # Unix timestamp
    # オフラインモード用の検証データ
    offline_verification_hash: str


class PosSessionRefreshRequest(BaseModel):
    """POSセッション更新リクエスト"""

    session_id: str


class OfflineSalesSyncRequest(BaseModel):
    """オフライン販売同期リクエスト"""

    terminal_id: str
    sales: list[dict]  # 販売データの配列


class OfflineSalesSyncResponse(BaseModel):
    """オフライン販売同期レスポンス"""

    synced_count: int
    failed_items: list[dict]
    sync_timestamp: int


class PosSaleItemRequest(BaseModel):
    """POS販売アイテム"""

    product_id: str
    quantity: int = Field(..., ge=1)
    unit_price: int = Field(..., ge=0)


class PosSaleRequest(BaseModel):
    """POS販売リクエスト"""

    items: list[PosSaleItemRequest]
    total_amount: int = Field(..., ge=0)
    payment_method: str = Field(..., pattern="^(cash|card|other)$")
    event_id: str | None = None
    terminal_id: str | None = None


# ==========================================
# クーポン管理用モデル
# ==========================================


class CreateCouponRequest(BaseModel):
    """クーポン作成リクエスト

    discount_type:
      - fixed: 固定金額割引（例: ¥500引き）- 売上計算上マイナス円の商品として扱う
      - percentage: 割引率（例: 10%引き）

    スコープ:
      - publisher_id指定あり: そのサークルの商品にのみ適用
      - publisher_id指定なし: 全商品に適用可能
    """

    code: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="クーポンコード（ユニーク）",
    )
    name: str = Field(..., min_length=1, max_length=100, description="クーポン名")
    description: str | None = Field(default=None, max_length=500, description="説明")
    discount_type: str = Field(
        ...,
        pattern="^(fixed|percentage)$",
        description="割引タイプ: fixed=固定金額, percentage=割引率",
    )
    discount_value: int = Field(
        ...,
        gt=0,
        description="割引値（fixed: 円, percentage: パーセント）",
    )
    publisher_id: str | None = Field(
        default=None,
        description="紐付くサークルID（指定時はそのサークルの商品にのみ適用）",
    )
    event_id: str | None = Field(
        default=None, description="紐付くイベントID（指定時はそのイベントでのみ有効）"
    )
    min_purchase_amount: int = Field(
        default=0, ge=0, description="最低購入金額（この金額以上で適用可能）"
    )
    max_discount_amount: int | None = Field(
        default=None, ge=0, description="最大割引額（percentageの場合の上限）"
    )
    valid_from: str | None = Field(default=None, description="有効期間開始（ISO8601）")
    valid_until: str | None = Field(default=None, description="有効期間終了（ISO8601）")
    usage_limit: int | None = Field(default=None, ge=1, description="総利用回数上限")
    active: bool = Field(default=True, description="有効フラグ")


class UpdateCouponRequest(BaseModel):
    """クーポン更新リクエスト"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    discount_type: str | None = Field(default=None, pattern="^(fixed|percentage)$")
    discount_value: int | None = Field(default=None, gt=0)
    publisher_id: str | None = None
    event_id: str | None = None
    min_purchase_amount: int | None = Field(default=None, ge=0)
    max_discount_amount: int | None = Field(default=None, ge=0)
    valid_from: str | None = None
    valid_until: str | None = None
    usage_limit: int | None = Field(default=None, ge=1)
    active: bool | None = None


class CouponResponse(BaseModel):
    """クーポンレスポンス"""

    coupon_id: str
    code: str
    name: str
    description: str | None = None
    discount_type: str
    discount_value: int
    publisher_id: str | None = None
    event_id: str | None = None
    min_purchase_amount: int = 0
    max_discount_amount: int | None = None
    valid_from: str | None = None
    valid_until: str | None = None
    usage_limit: int | None = None
    usage_count: int = 0
    active: bool = True
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ApplyCouponRequest(BaseModel):
    """クーポン適用リクエスト（POS用）"""

    code: str = Field(..., min_length=1, max_length=50, description="クーポンコード")
    subtotal: int = Field(..., ge=0, description="クーポン適用前の小計")
    publisher_id: str | None = Field(
        default=None, description="対象商品のサークルID（サークル限定クーポン検証用）"
    )


class ApplyCouponResponse(BaseModel):
    """クーポン適用レスポンス"""

    coupon_id: str
    code: str
    name: str
    discount_type: str
    discount_value: int
    discount_amount: int  # 実際の割引額（計算済み）
    new_total: int  # 割引後の金額
