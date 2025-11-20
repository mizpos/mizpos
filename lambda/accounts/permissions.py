"""
Permission checking and role-based access control (RBAC)
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from auth import get_current_user
from services import (
    is_system_admin,
    is_publisher_admin,
    has_role,
    users_table,
)


async def get_user_id_from_auth(current_user: dict = Depends(get_current_user)) -> str:
    """認証されたユーザーのuser_idを取得

    CognitoのsubからDynamoDBのuser_idを取得する
    """
    cognito_sub = current_user.get("sub")
    if not cognito_sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User ID not found in token",
        )

    # EmailからUsersテーブルを検索
    email = current_user.get("email")
    if email:
        response = users_table.query(
            IndexName="EmailIndex",
            KeyConditionExpression="email = :email",
            ExpressionAttributeValues={":email": email},
        )
        items = response.get("Items", [])
        if items:
            return items[0]["user_id"]

    # subでもう一度検索してみる（cognito_user_idで保存されている場合）
    # TODO: ここは実装次第で調整が必要
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found in database",
    )


async def require_system_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """システム管理者権限を要求するDependency

    使用例:
        @app.get("/admin/something")
        async def admin_endpoint(user: dict = Depends(require_system_admin)):
            # システム管理者のみアクセス可能
            pass
    """
    user_id = await get_user_id_from_auth(current_user)

    if not is_system_admin(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System administrator privileges required",
        )

    return {**current_user, "user_id": user_id}


async def require_publisher_access(
    publisher_id: str,
    current_user: dict = Depends(get_current_user),
    require_admin: bool = False,
) -> dict:
    """サークルへのアクセス権限を要求するDependency

    Args:
        publisher_id: サークルID
        require_admin: True の場合、管理者権限を要求

    使用例:
        @app.get("/publishers/{publisher_id}/something")
        async def publisher_endpoint(
            publisher_id: str,
            user: dict = Depends(lambda: require_publisher_access(publisher_id, require_admin=True))
        ):
            # サークル管理者のみアクセス可能
            pass
    """
    user_id = await get_user_id_from_auth(current_user)

    # システム管理者は常にアクセス可能
    if is_system_admin(user_id):
        return {**current_user, "user_id": user_id}

    # サークル管理者チェック
    if require_admin:
        if not is_publisher_admin(user_id, publisher_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Publisher administrator privileges required",
            )
    else:
        # 管理者または販売担当
        has_admin = is_publisher_admin(user_id, publisher_id)
        has_sales = has_role(user_id, "publisher_sales", publisher_id=publisher_id)

        if not (has_admin or has_sales):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Publisher access denied",
            )

    return {**current_user, "user_id": user_id}


async def require_event_access(
    event_id: str,
    current_user: dict = Depends(get_current_user),
    require_admin: bool = False,
) -> dict:
    """イベントへのアクセス権限を要求するDependency

    Args:
        event_id: イベントID
        require_admin: True の場合、管理者権限を要求
    """
    user_id = await get_user_id_from_auth(current_user)

    # システム管理者は常にアクセス可能
    if is_system_admin(user_id):
        return {**current_user, "user_id": user_id}

    # イベント管理者チェック
    if require_admin:
        if not has_role(user_id, "event_admin", event_id=event_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event administrator privileges required",
            )
    else:
        # 管理者または販売担当
        has_admin = has_role(user_id, "event_admin", event_id=event_id)
        has_sales = has_role(user_id, "event_sales", event_id=event_id)

        if not (has_admin or has_sales):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event access denied",
            )

    return {**current_user, "user_id": user_id}


def check_resource_permission(
    user_id: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    permission_level: str = "read",
) -> bool:
    """リソースへのアクセス権限をチェック

    Args:
        user_id: ユーザーID
        resource_type: リソースタイプ（publisher, event, user, stock, sales）
        resource_id: リソースID
        permission_level: 権限レベル（read, write, admin）

    Returns:
        アクセス権限がある場合True
    """
    # システム管理者は常にアクセス可能
    if is_system_admin(user_id):
        return True

    # リソースタイプごとのチェック
    if resource_type == "publisher":
        if not resource_id:
            # 全サークルの読み取りは誰でも可能（リスト表示用）
            return permission_level == "read"

        # サークル固有のリソース
        if permission_level == "admin":
            return is_publisher_admin(user_id, resource_id)
        elif permission_level == "write":
            return is_publisher_admin(user_id, resource_id) or has_role(
                user_id, "publisher_sales", publisher_id=resource_id
            )
        else:  # read
            return True

    elif resource_type == "event":
        if not resource_id:
            # 全イベントの読み取りは誰でも可能
            return permission_level == "read"

        # イベント固有のリソース
        if permission_level == "admin":
            return has_role(user_id, "event_admin", event_id=resource_id)
        elif permission_level == "write":
            return has_role(user_id, "event_admin", event_id=resource_id) or has_role(
                user_id, "event_sales", event_id=resource_id
            )
        else:  # read
            return True

    elif resource_type == "user":
        # ユーザー管理はシステム管理者のみ
        return False

    # デフォルトは拒否
    return False
