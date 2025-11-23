"""
Pydantic models for Android Enterprise MDM API
"""

from typing import Optional
from pydantic import BaseModel, Field


# ==========================================
# Request Models
# ==========================================


class CreateSignupUrlRequest(BaseModel):
    """サインアップURL作成リクエスト"""

    callback_url: str = Field(
        ..., description="エンタープライズ登録完了後のコールバックURL"
    )


class CreateEnterpriseRequest(BaseModel):
    """エンタープライズ作成リクエスト"""

    enterprise_token: str = Field(
        ..., description="サインアップ完了後に取得したトークン"
    )
    signup_url_name: str = Field(..., description="サインアップURL名（resourceパス）")


class CreatePolicyRequest(BaseModel):
    """ポリシー作成リクエスト"""

    policy_name: str = Field(..., description="ポリシー名")
    policy_display_name: Optional[str] = Field(None, description="ポリシー表示名")
    # アプリ制御
    applications_enabled: bool = Field(
        default=True, description="アプリインストール許可"
    )
    play_store_mode: str = Field(
        default="WHITELIST",
        description="Play Storeモード (WHITELIST/BLACKLIST)",
    )
    # セキュリティ設定
    password_required: bool = Field(default=True, description="パスワード必須")
    password_minimum_length: int = Field(default=6, description="パスワード最小文字数")
    # スクリーン設定
    screen_capture_disabled: bool = Field(
        default=False, description="スクリーンキャプチャ無効"
    )
    camera_disabled: bool = Field(default=False, description="カメラ無効")
    # ネットワーク設定
    wifi_config_disabled: bool = Field(default=False, description="WiFi設定変更無効")
    # KIOSK設定
    kiosk_mode_enabled: bool = Field(default=False, description="KIOSKモード有効")
    kiosk_launcher_package: Optional[str] = Field(
        None, description="KIOSKランチャーパッケージ名"
    )


class UpdatePolicyRequest(BaseModel):
    """ポリシー更新リクエスト"""

    policy_display_name: Optional[str] = None
    applications_enabled: Optional[bool] = None
    play_store_mode: Optional[str] = None
    password_required: Optional[bool] = None
    password_minimum_length: Optional[int] = None
    screen_capture_disabled: Optional[bool] = None
    camera_disabled: Optional[bool] = None
    wifi_config_disabled: Optional[bool] = None
    kiosk_mode_enabled: Optional[bool] = None
    kiosk_launcher_package: Optional[str] = None


class EnrollDeviceRequest(BaseModel):
    """デバイス登録用QRコード/トークン生成リクエスト"""

    policy_name: str = Field(..., description="適用するポリシー名")
    enrollment_type: str = Field(
        default="QR_CODE", description="登録タイプ (QR_CODE/NFC/ZERO_TOUCH)"
    )


class DeviceCommandRequest(BaseModel):
    """デバイスコマンド実行リクエスト"""

    command_type: str = Field(
        ..., description="コマンドタイプ (LOCK/REBOOT/RESET_PASSWORD/WIPE)"
    )
    new_password: Optional[str] = Field(None, description="新パスワード（RESET_PASSWORD時）")


# ==========================================
# Response Models
# ==========================================


class SignupUrlResponse(BaseModel):
    """サインアップURLレスポンス"""

    name: str = Field(..., description="サインアップURLリソース名")
    url: str = Field(..., description="IT管理者がアクセスするURL")


class EnterpriseResponse(BaseModel):
    """エンタープライズレスポンス"""

    enterprise_id: str = Field(..., description="エンタープライズID")
    name: str = Field(..., description="エンタープライズ名")
    primary_color: Optional[int] = None
    logo: Optional[str] = None
    enabled_notification_types: Optional[list[str]] = None


class PolicyResponse(BaseModel):
    """ポリシーレスポンス"""

    policy_id: str
    policy_name: str
    policy_display_name: Optional[str] = None
    enterprise_id: str
    created_at: str
    updated_at: str


class DeviceResponse(BaseModel):
    """デバイスレスポンス"""

    device_id: str
    name: str
    enterprise_id: str
    policy_name: str
    enrollment_state: str
    hardware_info: Optional[dict] = None
    software_info: Optional[dict] = None
    last_status_report_time: Optional[str] = None
    applied_state: Optional[str] = None


class EnrollmentTokenResponse(BaseModel):
    """デバイス登録トークンレスポンス"""

    token: str
    name: str
    qr_code: Optional[str] = Field(None, description="QRコードデータ（base64）")
    policy_name: str
    enrollment_type: str
    expiration_timestamp: str
