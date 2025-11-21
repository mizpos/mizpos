"""
Accounts Lambda Function
住所管理エンドポイントを含むユーザーアカウント管理API
"""

import json
import logging
import os
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from auth import get_current_user
from email_service import send_welcome_email
from models import (
    AdminResetPasswordRequest,
    AssignRoleRequest,
    ChangePasswordRequest,
    ConfirmEmailRequest,
    CreateAddressRequest,
    CreateUserRequest,
    InviteUserRequest,
    ResendConfirmationRequest,
    UpdateAddressRequest,
    UpdateUserRequest,
)
from permissions import (
    get_user_id_from_auth,
)
from services import (
    DynamoDBClientError,
    UsernameExistsException,
    add_user_address,
    admin_confirm_user,
    admin_reset_user_password,
    assign_role as assign_role_service,
    can_assign_role,
    change_user_password,
    confirm_user_email,
    create_cognito_user,
    delete_cognito_user,
    delete_user_address,
    delete_user_roles,
    dynamo_to_dict,
    get_roles_by_event,
    get_roles_by_publisher,
    get_user_address_by_id,
    get_user_addresses,
    get_user_roles as get_user_roles_service,
    get_user_status,
    invite_cognito_user,
    list_users as list_users_service,
    remove_role as remove_role_service,
    resend_confirmation_code,
    set_default_address,
    update_user_address,
    users_table,
)

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

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


# グローバル例外ハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    すべての予期しない例外をキャッチして適切に処理する
    これにより1つのエンドポイントの500エラーが他のエンドポイントに影響しない
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


# ユーザー管理エンドポイント
@router.get("/users", response_model=dict)
async def list_users(current_user: dict = Depends(get_current_user)):
    """ユーザー一覧取得（権限フィルタリング付き）

    権限ルール:
    - システム管理者: すべてのユーザーを表示
    - サークル管理者/販売担当: 自分のサークルに所属するユーザーを表示
    - イベント管理者/販売担当: 自分のイベントに所属するユーザーを表示
    - 権限なしユーザー: 自分自身のみ表示
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)
        users = list_users_service(current_user_id)
        return {"users": users}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: CreateUserRequest, current_user: dict = Depends(get_current_user)
):
    """ユーザー作成"""
    try:
        # メールアドレスの重複チェック（DynamoDBレベル）
        email_check = users_table.query(
            IndexName="EmailIndex",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={":email": request.email},
        )
        if email_check.get("Items"):
            raise HTTPException(
                status_code=409, detail="Email address already exists in database"
            )

        # Cognitoユーザー作成
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


@router.post("/users/invite", response_model=dict, status_code=status.HTTP_200_OK)
async def invite_user(
    request: InviteUserRequest, current_user: dict = Depends(get_current_user)
):
    """ユーザー招待またはロール付与用のユーザー取得

    既存ユーザーの場合: ユーザー情報を返す（ロール付与に進む）
    新規ユーザーの場合: Cognitoに招待してユーザー情報を返す
    """
    try:
        # メールアドレスで既存ユーザーをチェック
        email_check = users_table.query(
            IndexName="EmailIndex",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={":email": request.email},
        )

        # 既存ユーザーがいる場合はそのユーザー情報を返す
        if email_check.get("Items"):
            existing_user = email_check["Items"][0]
            return {
                "user": dynamo_to_dict(existing_user),
                "message": "User already exists. You can now assign roles.",
                "is_new_user": False,
            }

        # 新規ユーザーの場合: Cognitoに招待
        try:
            cognito_user_id = invite_cognito_user(request.email, request.display_name)
        except UsernameExistsException:
            # Cognitoには存在するがDynamoDBにはいない場合
            # Cognitoのユーザー名（email）をそのまま使用
            cognito_user_id = request.email

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

        return {
            "user": user_item,
            "message": "Invitation email sent to user. You can now assign roles.",
            "is_new_user": True,
        }

    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error inviting user: {e}")
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

        # ユーザー情報を取得してウェルカムメールを送信
        try:
            response = users_table.query(
                IndexName="EmailIndex",
                KeyConditionExpression="email = :email",
                ExpressionAttributeValues={":email": request.email},
            )
            users = response.get("Items", [])
            if users:
                user = users[0]
                display_name = user.get("display_name", "")
                send_welcome_email(request.email, display_name)
        except Exception as email_error:
            # ウェルカムメール送信失敗してもエラーにはしない
            logger.error(f"Failed to send welcome email: {email_error}")

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

        # ウェルカムメールを送信
        try:
            display_name = user.get("display_name", "")
            send_welcome_email(user["email"], display_name)
        except Exception as email_error:
            # ウェルカムメール送信失敗してもエラーにはしない
            logger.error(f"Failed to send welcome email: {email_error}")

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


# ==========================================
# ロール管理エンドポイント
# ==========================================


@router.get("/users/{user_id}/roles", response_model=dict)
async def get_user_roles(user_id: str, current_user: dict = Depends(get_current_user)):
    """ユーザーのロール一覧取得

    システム管理者、またはユーザー本人のみアクセス可能
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)

        # ユーザー本人またはシステム管理者のみアクセス可能
        from services import is_system_admin

        if current_user_id != user_id and not is_system_admin(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own roles",
            )

        roles = get_user_roles_service(user_id)
        return {"roles": roles}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user roles: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/users/{user_id}/roles", response_model=dict, status_code=status.HTTP_201_CREATED
)
async def assign_role(
    user_id: str,
    request: AssignRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    """ロール割り当て

    権限:
    - システム管理者: すべてのロールを付与可能
    - サークル管理者: 自分のサークルのpublisher_admin/publisher_salesを付与可能
    - イベント管理者: 自分のイベントのevent_admin/event_salesを付与可能
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)

        # 権限チェック
        if not can_assign_role(
            assigner_user_id=current_user_id,
            target_role_type=request.role_type,
            publisher_id=request.publisher_id,
            event_id=request.event_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to assign {request.role_type} role",
            )

        role = assign_role_service(
            user_id=user_id,
            role_type=request.role_type,
            created_by=current_user_id,
            publisher_id=request.publisher_id,
            event_id=request.event_id,
        )

        return {"role": role}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error assigning role: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_role(
    user_id: str, role_id: str, current_user: dict = Depends(get_current_user)
):
    """ロール削除

    システム管理者のみ実行可能
    TODO: サークル管理者が自分のサークルのロールを削除できるようにする
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)

        # システム管理者のみ削除可能
        from services import is_system_admin

        if not is_system_admin(current_user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators can remove roles",
            )

        success = remove_role_service(user_id, role_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Role not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing role: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/publishers/{publisher_id}/roles", response_model=dict)
async def get_publisher_roles(
    publisher_id: str, current_user: dict = Depends(get_current_user)
):
    """サークルのロール一覧取得

    システム管理者、またはサークルのメンバー（管理者・販売担当）のみアクセス可能
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)

        # 権限チェック: システム管理者またはサークルメンバー
        from services import is_system_admin, is_publisher_admin, has_role

        is_admin = is_system_admin(current_user_id)
        is_circle_admin = is_publisher_admin(current_user_id, publisher_id)
        is_circle_sales = has_role(
            current_user_id, "publisher_sales", publisher_id=publisher_id
        )

        if not (is_admin or is_circle_admin or is_circle_sales):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You don't have access to this publisher",
            )

        roles = get_roles_by_publisher(publisher_id)
        return {"roles": roles}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting publisher roles: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/events/{event_id}/roles", response_model=dict)
async def get_event_roles(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    """イベントのロール一覧取得

    システム管理者、またはイベントのメンバー（管理者・販売担当）のみアクセス可能
    """
    try:
        current_user_id = await get_user_id_from_auth(current_user)

        # 権限チェック: システム管理者またはイベントメンバー
        from services import is_system_admin, has_role

        is_admin = is_system_admin(current_user_id)
        is_event_admin = has_role(current_user_id, "event_admin", event_id=event_id)
        is_event_sales = has_role(current_user_id, "event_sales", event_id=event_id)

        if not (is_admin or is_event_admin or is_event_sales):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You don't have access to this event",
            )

        roles = get_roles_by_event(event_id)
        return {"roles": roles}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting event roles: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# 住所管理エンドポイント
# ==========================================


def resolve_user_id(user_id: str, current_user: dict) -> str:
    """
    URLのuser_idをDynamoDBのuser_idに解決する
    user_idがCognito subの場合、認証トークンと一致を確認してDynamoDB user_idを取得
    """
    # セキュリティ: URLのuser_idがCognito subの場合、認証トークンと一致することを確認
    if user_id == current_user.get("sub"):
        # Cognito subからDynamoDBのユーザーを検索
        response = users_table.scan(
            FilterExpression="attribute_exists(cognito_user_id)"
        )

        # current_userのemailまたはusernameでユーザーを検索
        user_email = current_user.get("email") or current_user.get("username")
        user_item = None
        for item in response.get("Items", []):
            if item.get("cognito_user_id") == user_email:
                user_item = item
                break

        if not user_item:
            raise HTTPException(status_code=404, detail="User not found")

        return user_item["user_id"]
    else:
        # URLのuser_idをDynamoDB user_idとして扱う（後方互換性）
        user_response = users_table.get_item(Key={"user_id": user_id})
        if "Item" not in user_response:
            raise HTTPException(status_code=404, detail="User not found")
        return user_id


@router.get("/users/{user_id}/addresses", response_model=dict)
async def get_addresses(user_id: str, current_user: dict = Depends(get_current_user)):
    """ユーザーの登録済み住所一覧を取得"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        addresses = get_user_addresses(actual_user_id)
        return {"addresses": addresses}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/users/{user_id}/addresses",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_address(
    user_id: str,
    request: CreateAddressRequest,
    current_user: dict = Depends(get_current_user),
):
    """ユーザーに新しい住所を追加"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        address_data = request.model_dump()
        new_address = add_user_address(actual_user_id, address_data)
        return {"address": new_address}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/users/{user_id}/addresses/{address_id}", response_model=dict)
async def get_address(
    user_id: str, address_id: str, current_user: dict = Depends(get_current_user)
):
    """特定の住所詳細を取得"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        address = get_user_address_by_id(actual_user_id, address_id)
        if not address:
            raise HTTPException(status_code=404, detail="Address not found")
        return {"address": address}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/users/{user_id}/addresses/{address_id}", response_model=dict)
async def update_address(
    user_id: str,
    address_id: str,
    request: UpdateAddressRequest,
    current_user: dict = Depends(get_current_user),
):
    """住所情報を更新"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        address_data = request.model_dump(exclude_none=True)
        updated_address = update_user_address(actual_user_id, address_id, address_data)
        if not updated_address:
            raise HTTPException(status_code=404, detail="Address not found")
        return {"address": updated_address}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete(
    "/users/{user_id}/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_address(
    user_id: str, address_id: str, current_user: dict = Depends(get_current_user)
):
    """住所を削除"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        deleted = delete_user_address(actual_user_id, address_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Address not found")
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/users/{user_id}/addresses/{address_id}/default", response_model=dict)
async def set_address_as_default(
    user_id: str, address_id: str, current_user: dict = Depends(get_current_user)
):
    """住所をデフォルトに設定"""
    try:
        actual_user_id = resolve_user_id(user_id, current_user)
        updated_address = set_default_address(actual_user_id, address_id)
        if not updated_address:
            raise HTTPException(status_code=404, detail="Address not found")
        return {"address": updated_address}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
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
        api_gateway_base_path = f"/{environment}/accounts"
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
