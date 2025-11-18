import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from auth import get_current_user
from models import (
    AdminResetPasswordRequest,
    AssignRoleRequest,
    ChangePasswordRequest,
    ConfirmEmailRequest,
    CreateUserRequest,
    ResendConfirmationRequest,
    UpdateUserRequest,
)
from services import (
    DynamoDBClientError,
    UsernameExistsException,
    admin_confirm_user,
    admin_reset_user_password,
    change_user_password,
    confirm_user_email,
    create_cognito_user,
    delete_cognito_user,
    delete_user_roles,
    dynamo_to_dict,
    get_user_status,
    resend_confirmation_code,
    roles_table,
    users_table,
)

# FastAPI アプリ
app = FastAPI(
    title="Accounts API",
    description="ユーザーアカウントとロール管理API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター
router = APIRouter()


# ユーザー管理エンドポイント
@router.get("/users", response_model=dict)
async def list_users(current_user: dict = Depends(get_current_user)):
    """ユーザー一覧取得"""
    try:
        response = users_table.scan()
        users = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"users": users}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest, current_user: dict = Depends(get_current_user)
):
    """ユーザー作成"""
    try:
        cognito_user_id = create_cognito_user(request.email, request.password)

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        user_item = {
            "user_id": user_id,
            "cognito_user_id": cognito_user_id,
            "email": request.email,
            "display_name": request.display_name,
            "created_at": now,
            "updated_at": now,
        }

        users_table.put_item(Item=user_item)

        return {"user": user_item}

    except UsernameExistsException as e:
        raise HTTPException(status_code=409, detail="User already exists") from e
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/users/{user_id}", response_model=dict)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """ユーザー詳細取得"""
    try:
        response = users_table.get_item(Key={"user_id": user_id})
        user = response.get("Item")
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": dynamo_to_dict(user)}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/users/{user_id}", response_model=dict)
async def update_user(
    user_id: str,
    request: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
):
    """ユーザー更新"""
    try:
        now = datetime.now(timezone.utc).isoformat()

        response = users_table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET display_name = :dn, updated_at = :ua",
            ExpressionAttributeValues={":dn": request.display_name, ":ua": now},
            ReturnValues="ALL_NEW",
        )

        return {"user": dynamo_to_dict(response["Attributes"])}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """ユーザー削除"""
    try:
        # ユーザー情報を取得してCognitoユーザーも削除
        user_response = users_table.get_item(Key={"user_id": user_id})
        user = user_response.get("Item")

        if user and "email" in user:
            delete_cognito_user(user["email"])

        users_table.delete_item(Key={"user_id": user_id})

        # ユーザーのロールも削除
        delete_user_roles(user_id)

    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# メール確認エンドポイント
@router.post("/auth/confirm-email", response_model=dict)
async def confirm_email(request: ConfirmEmailRequest):
    """メールアドレスの確認コードを検証（認証不要）"""
    try:
        confirm_user_email(request.email, request.confirmation_code)
        return {"message": "Email confirmed successfully"}
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if error_code == "CodeMismatchException":
            raise HTTPException(
                status_code=400, detail="Invalid confirmation code"
            ) from e
        if error_code == "ExpiredCodeException":
            raise HTTPException(
                status_code=400, detail="Confirmation code expired"
            ) from e
        if error_code == "UserNotFoundException":
            raise HTTPException(status_code=404, detail="User not found") from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/auth/resend-confirmation", response_model=dict)
async def resend_confirmation(request: ResendConfirmationRequest):
    """確認コードを再送信（認証不要）"""
    try:
        resend_confirmation_code(request.email)
        return {"message": "Confirmation code resent successfully"}
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if error_code == "UserNotFoundException":
            raise HTTPException(status_code=404, detail="User not found") from e
        if error_code == "LimitExceededException":
            raise HTTPException(status_code=429, detail="Too many requests") from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/users/{user_id}/status", response_model=dict)
async def get_user_verification_status(
    user_id: str, current_user: dict = Depends(get_current_user)
):
    """ユーザーの確認ステータスを取得"""
    try:
        user_response = users_table.get_item(Key={"user_id": user_id})
        user = user_response.get("Item")

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cognito_status = get_user_status(user["email"])
        return {"user_id": user_id, "cognito_status": cognito_status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users/{user_id}/confirm", response_model=dict)
async def admin_confirm_user_endpoint(
    user_id: str, current_user: dict = Depends(get_current_user)
):
    """管理者によるユーザー確認（確認コードなし）"""
    try:
        user_response = users_table.get_item(Key={"user_id": user_id})
        user = user_response.get("Item")

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        admin_confirm_user(user["email"])
        return {"message": "User confirmed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# パスワード変更エンドポイント
@router.post("/auth/change-password", response_model=dict)
async def change_password(
    request: ChangePasswordRequest, current_user: dict = Depends(get_current_user)
):
    """現在のユーザーのパスワードを変更"""
    try:
        access_token = current_user.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Access token not found")

        change_user_password(access_token, request.old_password, request.new_password)
        return {"message": "Password changed successfully"}
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if error_code == "NotAuthorizedException":
            raise HTTPException(status_code=400, detail="Incorrect old password") from e
        if error_code == "InvalidPasswordException":
            raise HTTPException(
                status_code=400, detail="New password does not meet requirements"
            ) from e
        if error_code == "LimitExceededException":
            raise HTTPException(status_code=429, detail="Too many requests") from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users/{user_id}/reset-password", response_model=dict)
async def admin_reset_password(
    user_id: str,
    request: AdminResetPasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """管理者によるユーザーのパスワードリセット"""
    try:
        user_response = users_table.get_item(Key={"user_id": user_id})
        user = user_response.get("Item")

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        admin_reset_user_password(user["email"], request.new_password)
        return {"message": "Password reset successfully"}
    except HTTPException:
        raise
    except Exception as e:
        error_code = getattr(e, "response", {}).get("Error", {}).get("Code", "")
        if error_code == "InvalidPasswordException":
            raise HTTPException(
                status_code=400, detail="New password does not meet requirements"
            ) from e
        raise HTTPException(status_code=500, detail=str(e)) from e


# ロール管理エンドポイント
@router.get("/users/{user_id}/roles", response_model=dict)
async def get_user_roles(user_id: str, current_user: dict = Depends(get_current_user)):
    """ユーザーのロール一覧取得"""
    try:
        response = roles_table.query(
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
        )
        roles = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"roles": roles}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/users/{user_id}/roles", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def assign_role(
    user_id: str,
    request: AssignRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """ロール割り当て"""
    try:
        role_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        role_item = {
            "user_id": user_id,
            "role_id": role_id,
            "event_id": request.event_id,
            "role_type": request.role_type,
            "created_at": now,
        }

        roles_table.put_item(Item=role_item)

        return {"role": role_item}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_role(
    user_id: str, role_id: str, current_user: dict = Depends(get_current_user)
):
    """ロール削除"""
    try:
        roles_table.delete_item(Key={"user_id": user_id, "role_id": role_id})
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/events/{event_id}/roles", response_model=dict)
async def get_event_roles(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    """イベントのロール一覧取得"""
    try:
        response = roles_table.query(
            IndexName="EventIndex",
            KeyConditionExpression="event_id = :eid",
            ExpressionAttributeValues={":eid": event_id},
        )
        roles = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"roles": roles}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)


# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    # OPTIONS リクエストは認証なしで即座にCORSレスポンスを返す
    request_context = event.get("requestContext", {})
    http_info = request_context.get("http", {})
    method = http_info.get("method", event.get("httpMethod", ""))

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
    api_gateway_base_path = f"/{environment}/accounts"
    mangum_handler = Mangum(
        app, lifespan="off", api_gateway_base_path=api_gateway_base_path
    )
    return mangum_handler(event, context)
