import os
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

# 環境変数
ENVIRONMENT = os.environ.get("ENVIRONMENT", "dev")
USERS_TABLE = os.environ.get("USERS_TABLE", f"{ENVIRONMENT}-mizpos-users")
ROLES_TABLE = os.environ.get("ROLES_TABLE", f"{ENVIRONMENT}-mizpos-roles")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")

# AWS クライアント
dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")
users_table = dynamodb.Table(USERS_TABLE)
roles_table = dynamodb.Table(ROLES_TABLE)


def dynamo_to_dict(item: dict) -> dict:
    """DynamoDB のレスポンスを通常のdictに変換"""
    result = {}
    for key, value in item.items():
        if isinstance(value, Decimal):
            result[key] = float(value)
        else:
            result[key] = value
    return result


def create_cognito_user(email: str, password: str, skip_verification: bool = False) -> str:
    """Cognitoにユーザーを作成"""
    if skip_verification:
        # メール確認をスキップ（管理者による作成）
        cognito_response = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            TemporaryPassword=password,
            MessageAction="SUPPRESS",
        )

        cognito_user_id = cognito_response["User"]["Username"]

        # パスワードを確定
        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=email,
            Password=password,
            Permanent=True,
        )
    else:
        # メール確認コードを送信
        cognito_response = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
            ],
            TemporaryPassword=password,
            DesiredDeliveryMediums=["EMAIL"],
        )

        cognito_user_id = cognito_response["User"]["Username"]

    return cognito_user_id


def confirm_user_email(email: str, confirmation_code: str) -> None:
    """メールアドレスの確認コードを検証"""
    cognito.confirm_sign_up(
        ClientId=CLIENT_ID,
        Username=email,
        ConfirmationCode=confirmation_code,
    )


def resend_confirmation_code(email: str) -> None:
    """確認コードを再送信"""
    cognito.resend_confirmation_code(
        ClientId=CLIENT_ID,
        Username=email,
    )


def admin_confirm_user(email: str) -> None:
    """管理者によるユーザー確認（確認コードなし）"""
    cognito.admin_confirm_sign_up(
        UserPoolId=USER_POOL_ID,
        Username=email,
    )


def get_user_status(email: str) -> dict:
    """ユーザーのステータスを取得"""
    response = cognito.admin_get_user(
        UserPoolId=USER_POOL_ID,
        Username=email,
    )
    return {
        "username": response["Username"],
        "status": response["UserStatus"],
        "email_verified": any(
            attr["Name"] == "email_verified" and attr["Value"] == "true"
            for attr in response.get("UserAttributes", [])
        ),
        "enabled": response["Enabled"],
    }


def change_user_password(access_token: str, old_password: str, new_password: str) -> None:
    """ユーザー自身がパスワードを変更"""
    cognito.change_password(
        PreviousPassword=old_password,
        ProposedPassword=new_password,
        AccessToken=access_token,
    )


def admin_reset_user_password(email: str, new_password: str) -> None:
    """管理者がユーザーのパスワードをリセット"""
    cognito.admin_set_user_password(
        UserPoolId=USER_POOL_ID,
        Username=email,
        Password=new_password,
        Permanent=True,
    )


def delete_cognito_user(email: str) -> None:
    """Cognitoからユーザーを削除"""
    try:
        cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=email)
    except cognito.exceptions.UserNotFoundException:
        pass


def delete_user_roles(user_id: str) -> None:
    """ユーザーの全ロールを削除"""
    roles_response = roles_table.query(
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )
    for role in roles_response.get("Items", []):
        roles_table.delete_item(Key={"user_id": user_id, "role_id": role["role_id"]})


# 例外をエクスポート
UsernameExistsException = cognito.exceptions.UsernameExistsException
UserNotFoundException = cognito.exceptions.UserNotFoundException
DynamoDBClientError = ClientError
