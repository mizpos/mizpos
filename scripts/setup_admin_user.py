#!/usr/bin/env python3
"""
初期セットアップスクリプト: 管理者ユーザーを作成
Cognito と DynamoDB の両方にユーザーを登録します
"""

import argparse
import json
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


def get_terraform_outputs(environment: str) -> dict:
    """Terraform outputs から必要な情報を取得"""
    import subprocess

    try:
        result = subprocess.run(
            ["terraform", "output", "-json"],
            cwd=f"terraform/tf-{environment}",
            capture_output=True,
            text=True,
            check=True,
        )
        outputs = json.loads(result.stdout)
        return {
            "user_pool_id": outputs.get("cognito_user_pool_id", {}).get("value"),
            "users_table": outputs.get("dynamodb_users_table_name", {}).get("value"),
            "roles_table": outputs.get("dynamodb_roles_table_name", {}).get("value"),
        }
    except Exception as e:
        print(f"Terraform outputs の取得に失敗: {e}")
        return {}


def create_admin_user(
    user_pool_id: str,
    users_table_name: str,
    roles_table_name: str,
    email: str,
    password: str,
    display_name: str,
    region: str = "ap-northeast-1",
) -> dict:
    """管理者ユーザーを作成してsystem_adminロールを付与"""

    # AWS クライアント初期化
    cognito = boto3.client("cognito-idp", region_name=region)
    dynamodb = boto3.resource("dynamodb", region_name=region)
    users_table = dynamodb.Table(users_table_name)
    roles_table = dynamodb.Table(roles_table_name)

    print(f"Creating admin user: {email}")

    # 1. Cognito にユーザー作成
    print("  1. Creating Cognito user...")
    try:
        cognito_response = cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=email,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            TemporaryPassword=password,
            MessageAction="SUPPRESS",  # メール送信を抑制
        )
        cognito_user_id = email  # Cognito では Username が ID になる
        print(f"     Cognito user created: {cognito_user_id}")
    except cognito.exceptions.UsernameExistsException:
        print(f"     Cognito user already exists: {email}")
        cognito_user_id = email
    except ClientError as e:
        print(f"     Error creating Cognito user: {e}")
        raise

    # 2. パスワードを永続化（仮パスワードを無効化）
    print("  2. Setting permanent password...")
    try:
        cognito.admin_set_user_password(
            UserPoolId=user_pool_id,
            Username=email,
            Password=password,
            Permanent=True,
        )
        print("     Password set as permanent")
    except ClientError as e:
        print(f"     Error setting password: {e}")
        raise

    # 3. DynamoDB にユーザー情報を登録
    print("  3. Creating DynamoDB user record...")

    # メールアドレスの重複チェック
    email_check = users_table.query(
        IndexName="EmailIndex",
        KeyConditionExpression="email = :email",
        ExpressionAttributeValues={":email": email},
    )
    if email_check.get("Items"):
        existing_user = email_check["Items"][0]
        user_id = existing_user["user_id"]
        print(
            f"     User with email {email} already exists in DynamoDB: {user_id}"
        )
        print("     Skipping DynamoDB user creation")
    else:
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        user_item = {
            "user_id": user_id,
            "cognito_user_id": cognito_user_id,
            "email": email,
            "display_name": display_name,
            "created_at": now,
            "updated_at": now,
        }

        try:
            users_table.put_item(Item=user_item)
            print(f"     DynamoDB user created: {user_id}")
        except ClientError as e:
            print(f"     Error creating DynamoDB user: {e}")
            raise

    # nowを設定（ロール作成時に使用）
    now = datetime.now(timezone.utc).isoformat()

    # 4. system_admin ロールを付与
    print("  4. Assigning system_admin role...")
    role_id = str(uuid.uuid4())

    role_item = {
        "user_id": user_id,
        "role_id": role_id,
        "scope": "system",
        "role_type": "system_admin",
        "created_at": now,
        "created_by": user_id,  # 自分自身が作成者
        # publisher_id と event_id は省略（スパースインデックスのため）
    }

    try:
        roles_table.put_item(Item=role_item)
        print(f"     system_admin role assigned: {role_id}")
    except ClientError as e:
        print(f"     Error assigning role: {e}")
        raise

    print(f"Admin user created successfully with system_admin role!")
    return user_item


def main():
    parser = argparse.ArgumentParser(description="初期管理者ユーザーを作成します")
    parser.add_argument(
        "--environment",
        "-e",
        default="dev",
        choices=["dev", "prod", "training"],
        help="環境 (default: dev)",
    )
    parser.add_argument(
        "--email",
        required=True,
        help="管理者メールアドレス",
    )
    parser.add_argument(
        "--password",
        required=True,
        help="パスワード (8文字以上、大文字・小文字・数字・特殊文字を含む)",
    )
    parser.add_argument(
        "--display-name",
        default="管理者",
        help="表示名 (default: 管理者)",
    )
    parser.add_argument(
        "--user-pool-id",
        help="Cognito User Pool ID (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--users-table",
        help="DynamoDB Users Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--roles-table",
        help="DynamoDB Roles Table 名 (省略時は Terraform outputs から取得)",
    )
    parser.add_argument(
        "--region",
        default="ap-northeast-1",
        help="AWS リージョン (default: ap-northeast-1)",
    )

    args = parser.parse_args()

    # Terraform outputs から設定を取得
    if not args.user_pool_id or not args.users_table or not args.roles_table:
        print(f"Fetching configuration from Terraform outputs ({args.environment})...")
        tf_outputs = get_terraform_outputs(args.environment)

        if not args.user_pool_id:
            args.user_pool_id = tf_outputs.get("user_pool_id")
        if not args.users_table:
            args.users_table = tf_outputs.get("users_table")
        if not args.roles_table:
            args.roles_table = tf_outputs.get("roles_table")

    # 必須パラメータの検証
    if not args.user_pool_id:
        print("Error: --user-pool-id is required (or set in Terraform outputs)")
        return 1
    if not args.users_table:
        print("Error: --users-table is required (or set in Terraform outputs)")
        return 1
    if not args.roles_table:
        print("Error: --roles-table is required (or set in Terraform outputs)")
        return 1

    print(f"Configuration:")
    print(f"  Environment: {args.environment}")
    print(f"  User Pool ID: {args.user_pool_id}")
    print(f"  Users Table: {args.users_table}")
    print(f"  Roles Table: {args.roles_table}")
    print(f"  Region: {args.region}")
    print(f"  Email: {args.email}")
    print(f"  Display Name: {args.display_name}")
    print()

    # ユーザー作成
    try:
        user = create_admin_user(
            user_pool_id=args.user_pool_id,
            users_table_name=args.users_table,
            roles_table_name=args.roles_table,
            email=args.email,
            password=args.password,
            display_name=args.display_name,
            region=args.region,
        )
        print()
        print("=" * 50)
        print("User Details:")
        print(json.dumps(user, indent=2, ensure_ascii=False))
        print("=" * 50)
        print()
        print(f"You can now login with:")
        print(f"  Email: {args.email}")
        print(f"  Password: {args.password}")
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
