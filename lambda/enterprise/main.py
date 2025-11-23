"""
Android Enterprise MDM Lambda Function
Android端末のエンタープライズ管理API
"""

import json
import logging
import os
import traceback

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from auth import get_current_user
from models import (
    CreateSignupUrlRequest,
    CreateEnterpriseRequest,
    CreatePolicyRequest,
    UpdatePolicyRequest,
    EnrollDeviceRequest,
    DeviceCommandRequest,
)
from android_management_service import (
    create_signup_url,
    create_enterprise,
    get_enterprise,
    list_enterprises,
    delete_enterprise,
    create_policy,
    get_policy,
    list_policies,
    delete_policy,
    create_enrollment_token,
    list_devices,
    get_device,
    issue_device_command,
    delete_device,
)

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# FastAPI アプリ
app = FastAPI(
    title="Android Enterprise MDM API",
    description="Android端末のエンタープライズ管理API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# グローバル例外ハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    すべての予期しない例外をキャッチして適切に処理する
    """
    logger.error(f"Unhandled exception: {exc}")
    logger.error(f"Request path: {request.url.path}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )


# ルーター
router = APIRouter()


# ==========================================
# サインアップURL管理
# ==========================================


@router.post("/signup-urls", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_signup_url_endpoint(
    request: CreateSignupUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズ登録用のサインアップURLを作成

    IT管理者がこのURLにアクセスしてエンタープライズを登録する
    """
    try:
        result = create_signup_url(request.callback_url)
        return {"signup_url": result}
    except Exception as e:
        logger.error(f"Error creating signup URL: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# エンタープライズ管理
# ==========================================


@router.post("/enterprises", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_enterprise_endpoint(
    request: CreateEnterpriseRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズを作成

    サインアップ完了後に取得したトークンを使用してエンタープライズをバインドする
    """
    try:
        result = create_enterprise(
            enterprise_token=request.enterprise_token,
            signup_url_name=request.signup_url_name,
        )
        return {"enterprise": result}
    except Exception as e:
        logger.error(f"Error creating enterprise: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/enterprises", response_model=dict)
async def list_enterprises_endpoint(
    current_user: dict = Depends(get_current_user),
):
    """
    登録されているエンタープライズ一覧を取得
    """
    try:
        enterprises = list_enterprises()
        return {"enterprises": enterprises}
    except Exception as e:
        logger.error(f"Error listing enterprises: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/enterprises/{enterprise_id}", response_model=dict)
async def get_enterprise_endpoint(
    enterprise_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズ詳細を取得
    """
    try:
        enterprise = get_enterprise(enterprise_id)
        if not enterprise:
            raise HTTPException(status_code=404, detail="Enterprise not found")
        return {"enterprise": enterprise}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting enterprise: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/enterprises/{enterprise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_enterprise_endpoint(
    enterprise_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズを削除

    関連するすべてのデバイスとポリシーも削除される
    """
    try:
        if not delete_enterprise(enterprise_id):
            raise HTTPException(status_code=404, detail="Enterprise not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting enterprise: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# ポリシー管理
# ==========================================


@router.post(
    "/enterprises/{enterprise_id}/policies",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_policy_endpoint(
    enterprise_id: str,
    request: CreatePolicyRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    デバイスポリシーを作成

    ポリシーはデバイスの動作制限やセキュリティ設定を定義する
    """
    try:
        result = create_policy(
            enterprise_id=enterprise_id,
            policy_name=request.policy_name,
            policy_display_name=request.policy_display_name,
            applications_enabled=request.applications_enabled,
            play_store_mode=request.play_store_mode,
            password_required=request.password_required,
            password_minimum_length=request.password_minimum_length,
            screen_capture_disabled=request.screen_capture_disabled,
            camera_disabled=request.camera_disabled,
            wifi_config_disabled=request.wifi_config_disabled,
            kiosk_mode_enabled=request.kiosk_mode_enabled,
            kiosk_launcher_package=request.kiosk_launcher_package,
        )
        return {"policy": result}
    except Exception as e:
        logger.error(f"Error creating policy: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/enterprises/{enterprise_id}/policies", response_model=dict)
async def list_policies_endpoint(
    enterprise_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズのポリシー一覧を取得
    """
    try:
        policies = list_policies(enterprise_id)
        return {"policies": policies}
    except Exception as e:
        logger.error(f"Error listing policies: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/enterprises/{enterprise_id}/policies/{policy_name}", response_model=dict)
async def get_policy_endpoint(
    enterprise_id: str,
    policy_name: str,
    current_user: dict = Depends(get_current_user),
):
    """
    ポリシー詳細を取得
    """
    try:
        policy = get_policy(enterprise_id, policy_name)
        if not policy:
            raise HTTPException(status_code=404, detail="Policy not found")
        return {"policy": policy}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting policy: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/enterprises/{enterprise_id}/policies/{policy_name}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_policy_endpoint(
    enterprise_id: str,
    policy_name: str,
    current_user: dict = Depends(get_current_user),
):
    """
    ポリシーを削除
    """
    try:
        if not delete_policy(enterprise_id, policy_name):
            raise HTTPException(status_code=404, detail="Policy not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting policy: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# デバイス管理
# ==========================================


@router.post(
    "/enterprises/{enterprise_id}/enrollment-tokens",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_enrollment_token_endpoint(
    enterprise_id: str,
    request: EnrollDeviceRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    デバイス登録トークン（QRコード）を生成

    このQRコードをデバイスでスキャンしてエンタープライズに登録する
    """
    try:
        result = create_enrollment_token(
            enterprise_id=enterprise_id,
            policy_name=request.policy_name,
            enrollment_type=request.enrollment_type,
        )
        return {"enrollment_token": result}
    except Exception as e:
        logger.error(f"Error creating enrollment token: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/enterprises/{enterprise_id}/devices", response_model=dict)
async def list_devices_endpoint(
    enterprise_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    エンタープライズのデバイス一覧を取得
    """
    try:
        devices = list_devices(enterprise_id)
        return {"devices": devices}
    except Exception as e:
        logger.error(f"Error listing devices: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/enterprises/{enterprise_id}/devices/{device_id}",
    response_model=dict,
)
async def get_device_endpoint(
    enterprise_id: str,
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    デバイス詳細を取得
    """
    try:
        device = get_device(enterprise_id, device_id)
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        return {"device": device}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting device: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/enterprises/{enterprise_id}/devices/{device_id}/command",
    response_model=dict,
)
async def issue_device_command_endpoint(
    enterprise_id: str,
    device_id: str,
    request: DeviceCommandRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    デバイスにコマンドを発行

    利用可能なコマンド:
    - LOCK: デバイスをロック
    - REBOOT: デバイスを再起動
    - RESET_PASSWORD: パスワードをリセット
    - WIPE: デバイスを初期化
    """
    try:
        result = issue_device_command(
            enterprise_id=enterprise_id,
            device_id=device_id,
            command_type=request.command_type,
            new_password=request.new_password,
        )
        return {"result": result}
    except Exception as e:
        logger.error(f"Error issuing device command: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/enterprises/{enterprise_id}/devices/{device_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_device_endpoint(
    enterprise_id: str,
    device_id: str,
    wipe_data: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """
    デバイスを削除

    wipe_data=trueの場合、デバイスのデータも消去する
    """
    try:
        if not delete_device(enterprise_id, device_id, wipe_data):
            raise HTTPException(status_code=404, detail="Device not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting device: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)


# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    """
    Lambda関数のエントリーポイント
    全体をtry-exceptでラップしてLambda関数のクラッシュを防止
    """
    try:
        # リクエスト情報をログ出力
        request_context = event.get("requestContext", {})
        http_info = request_context.get("http", {})
        method = http_info.get("method", event.get("httpMethod", ""))
        path = http_info.get("path", event.get("path", ""))

        logger.info(f"Request received - Method: {method}, Path: {path}")

        # OPTIONS リクエストは認証なしで即座にCORSレスポンスを返す
        if method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "300",
                },
                "body": "",
            }

        # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
        environment = os.environ.get("ENVIRONMENT", "dev")
        api_gateway_base_path = f"/{environment}/mdm"
        mangum_handler = Mangum(
            app, lifespan="off", api_gateway_base_path=api_gateway_base_path
        )
        response = mangum_handler(event, context)
        logger.info(
            f"Request completed - Status: {response.get('statusCode', 'unknown')}"
        )
        return response

    except Exception as e:
        # Lambda関数レベルでの致命的なエラーをキャッチ
        logger.error(f"Fatal error in Lambda handler: {e}")
        logger.error(f"Event: {json.dumps(event, default=str)}")
        logger.error(f"Traceback: {traceback.format_exc()}")

        # エラーレスポンスを返す（Lambda関数自体はクラッシュしない）
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "detail": "Lambda handler error",
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                }
            ),
        }
