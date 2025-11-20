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


def create_cognito_user(
    email: str, password: str, skip_verification: bool = False
) -> str:
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


def change_user_password(
    access_token: str, old_password: str, new_password: str
) -> None:
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


# ========================================
# ロール管理関数
# ========================================


def assign_role(
    user_id: str,
    role_type: str,
    created_by: str,
    publisher_id: str | None = None,
    event_id: str | None = None,
) -> dict:
    """ユーザーにロールを付与

    Args:
        user_id: ユーザーID
        role_type: ロールタイプ (system_admin, publisher_admin, publisher_sales, event_admin, event_sales)
        created_by: ロールを付与したユーザーのID
        publisher_id: サークルID (publisher_admin/publisher_salesの場合必須)
        event_id: イベントID (event_admin/event_salesの場合必須)

    Returns:
        作成されたロールデータ

    Raises:
        ValueError: ロールタイプとパラメータの組み合わせが不正な場合
    """
    import uuid
    from datetime import datetime, timezone

    # ロールタイプに応じたバリデーション
    if role_type == "system_admin":
        scope = "system"
        if publisher_id or event_id:
            raise ValueError("system_adminにはpublisher_id/event_idは不要です")
    elif role_type in ["publisher_admin", "publisher_sales"]:
        scope = "publisher"
        if not publisher_id:
            raise ValueError(f"{role_type}にはpublisher_idが必須です")
        if event_id:
            raise ValueError(f"{role_type}にはevent_idは不要です")
    elif role_type in ["event_admin", "event_sales"]:
        scope = "event"
        if not event_id:
            raise ValueError(f"{role_type}にはevent_idが必須です")
        if publisher_id:
            raise ValueError(f"{role_type}にはpublisher_idは不要です")
    else:
        raise ValueError(f"不正なロールタイプ: {role_type}")

    # ロールIDを生成
    role_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # DynamoDBに保存するアイテム
    item = {
        "user_id": user_id,
        "role_id": role_id,
        "scope": scope,
        "role_type": role_type,
        "created_at": now,
        "created_by": created_by,
    }

    # scopeに応じてpublisher_idまたはevent_idを設定
    if scope == "publisher" and publisher_id:
        item["publisher_id"] = publisher_id
    elif scope == "event" and event_id:
        item["event_id"] = event_id

    # スパースインデックスのため、nullableなフィールドは存在しない場合は含めない
    # ただし、GSIでクエリする必要があるため、nullの代わりに空文字列を使用
    if "publisher_id" not in item:
        item["publisher_id"] = ""
    if "event_id" not in item:
        item["event_id"] = ""

    roles_table.put_item(Item=item)

    return dynamo_to_dict(item)


def get_user_roles(user_id: str) -> list[dict]:
    """ユーザーの全ロールを取得

    Args:
        user_id: ユーザーID

    Returns:
        ロールのリスト
    """
    response = roles_table.query(
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
    )

    return [dynamo_to_dict(role) for role in response.get("Items", [])]


def get_roles_by_publisher(publisher_id: str) -> list[dict]:
    """サークルに紐づく全ロールを取得

    Args:
        publisher_id: サークルID

    Returns:
        ロールのリスト
    """
    response = roles_table.query(
        IndexName="PublisherIndex",
        KeyConditionExpression="publisher_id = :pid",
        ExpressionAttributeValues={":pid": publisher_id},
    )

    return [dynamo_to_dict(role) for role in response.get("Items", [])]


def get_roles_by_event(event_id: str) -> list[dict]:
    """イベントに紐づく全ロールを取得

    Args:
        event_id: イベントID

    Returns:
        ロールのリスト
    """
    response = roles_table.query(
        IndexName="EventIndex",
        KeyConditionExpression="event_id = :eid",
        ExpressionAttributeValues={":eid": event_id},
    )

    return [dynamo_to_dict(role) for role in response.get("Items", [])]


def remove_role(user_id: str, role_id: str) -> bool:
    """ロールを削除

    Args:
        user_id: ユーザーID
        role_id: ロールID

    Returns:
        削除に成功した場合True
    """
    try:
        roles_table.delete_item(
            Key={"user_id": user_id, "role_id": role_id},
            ConditionExpression="attribute_exists(user_id) AND attribute_exists(role_id)",
        )
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise


def has_role(
    user_id: str,
    role_type: str,
    publisher_id: str | None = None,
    event_id: str | None = None,
) -> bool:
    """ユーザーが特定のロールを持っているかチェック

    Args:
        user_id: ユーザーID
        role_type: ロールタイプ
        publisher_id: サークルID (省略可)
        event_id: イベントID (省略可)

    Returns:
        ロールを持っている場合True
    """
    roles = get_user_roles(user_id)

    for role in roles:
        if role["role_type"] == role_type:
            # scopeに応じた追加チェック
            if role["scope"] == "system":
                return True
            elif role["scope"] == "publisher" and publisher_id:
                if role.get("publisher_id") == publisher_id:
                    return True
            elif role["scope"] == "event" and event_id:
                if role.get("event_id") == event_id:
                    return True

    return False


def is_system_admin(user_id: str) -> bool:
    """ユーザーがシステム管理者かチェック

    Args:
        user_id: ユーザーID

    Returns:
        システム管理者の場合True
    """
    return has_role(user_id, "system_admin")


def is_publisher_admin(user_id: str, publisher_id: str) -> bool:
    """ユーザーが指定されたサークルの管理者かチェック

    Args:
        user_id: ユーザーID
        publisher_id: サークルID

    Returns:
        サークル管理者の場合True
    """
    return has_role(user_id, "publisher_admin", publisher_id=publisher_id)


def can_assign_role(
    assigner_user_id: str,
    target_role_type: str,
    publisher_id: str | None = None,
    event_id: str | None = None,
) -> bool:
    """ユーザーが特定のロールを付与する権限があるかチェック

    権限ルール:
    - システム管理者: すべてのロールを付与可能
    - サークル管理者: 自分のサークルのpublisher_admin/publisher_salesを付与可能
    - イベント管理者: 自分のイベントのevent_admin/event_salesを付与可能

    Args:
        assigner_user_id: ロールを付与しようとしているユーザーのID
        target_role_type: 付与しようとしているロールタイプ
        publisher_id: サークルID
        event_id: イベントID

    Returns:
        ロールを付与する権限がある場合True
    """
    # システム管理者はすべてのロールを付与可能
    if is_system_admin(assigner_user_id):
        return True

    # サークル管理者は自分のサークルのpublisher_admin/publisher_salesを付与可能
    if target_role_type in ["publisher_admin", "publisher_sales"]:
        if publisher_id and is_publisher_admin(assigner_user_id, publisher_id):
            return True

    # イベント管理者は自分のイベントのevent_admin/event_salesを付与可能
    if target_role_type in ["event_admin", "event_sales"]:
        if event_id and has_role(assigner_user_id, "event_admin", event_id=event_id):
            return True

    return False


# 住所管理関数
def get_user_addresses(user_id: str) -> list[dict]:
    """ユーザーの住所一覧を取得"""
    try:
        response = users_table.get_item(Key={"user_id": user_id})
        if "Item" not in response:
            return []
        user = response["Item"]
        addresses = user.get("saved_addresses", [])
        return [dynamo_to_dict(addr) for addr in addresses]
    except ClientError:
        return []


def get_user_address_by_id(user_id: str, address_id: str) -> dict | None:
    """特定の住所を取得"""
    addresses = get_user_addresses(user_id)
    for addr in addresses:
        if addr.get("address_id") == address_id:
            return addr
    return None


def add_user_address(user_id: str, address_data: dict) -> dict:
    """ユーザーに住所を追加"""
    import uuid
    from datetime import datetime, timezone

    # address_id を生成
    address_id = str(uuid.uuid4())
    new_address = {
        "address_id": address_id,
        "label": address_data["label"],
        "name": address_data["name"],
        "postal_code": address_data["postal_code"],
        "prefecture": address_data["prefecture"],
        "city": address_data["city"],
        "address_line1": address_data["address_line1"],
        "address_line2": address_data.get("address_line2", ""),
        "phone_number": address_data["phone_number"],
        "is_default": address_data.get("is_default", False),
    }

    # 既存の住所を取得
    addresses = get_user_addresses(user_id)

    # is_defaultがTrueの場合、他の住所のis_defaultをFalseに
    if new_address["is_default"]:
        for addr in addresses:
            addr["is_default"] = False

    # 新しい住所を追加
    addresses.append(new_address)

    # DynamoDBを更新
    users_table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET saved_addresses = :addrs, updated_at = :updated",
        ExpressionAttributeValues={
            ":addrs": addresses,
            ":updated": datetime.now(timezone.utc).isoformat(),
        },
    )

    return dynamo_to_dict(new_address)


def update_user_address(
    user_id: str, address_id: str, address_data: dict
) -> dict | None:
    """ユーザーの住所を更新"""
    from datetime import datetime, timezone

    addresses = get_user_addresses(user_id)
    updated_address = None

    for addr in addresses:
        if addr["address_id"] == address_id:
            # 更新対象の住所を見つけた
            if "label" in address_data and address_data["label"] is not None:
                addr["label"] = address_data["label"]
            if "name" in address_data and address_data["name"] is not None:
                addr["name"] = address_data["name"]
            if (
                "postal_code" in address_data
                and address_data["postal_code"] is not None
            ):
                addr["postal_code"] = address_data["postal_code"]
            if "prefecture" in address_data and address_data["prefecture"] is not None:
                addr["prefecture"] = address_data["prefecture"]
            if "city" in address_data and address_data["city"] is not None:
                addr["city"] = address_data["city"]
            if (
                "address_line1" in address_data
                and address_data["address_line1"] is not None
            ):
                addr["address_line1"] = address_data["address_line1"]
            if "address_line2" in address_data:
                addr["address_line2"] = address_data["address_line2"] or ""
            if (
                "phone_number" in address_data
                and address_data["phone_number"] is not None
            ):
                addr["phone_number"] = address_data["phone_number"]
            if "is_default" in address_data and address_data["is_default"] is not None:
                addr["is_default"] = address_data["is_default"]

            updated_address = addr
            break

    if not updated_address:
        return None

    # is_defaultがTrueの場合、他の住所のis_defaultをFalseに
    if updated_address.get("is_default"):
        for addr in addresses:
            if addr["address_id"] != address_id:
                addr["is_default"] = False

    # DynamoDBを更新
    users_table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET saved_addresses = :addrs, updated_at = :updated",
        ExpressionAttributeValues={
            ":addrs": addresses,
            ":updated": datetime.now(timezone.utc).isoformat(),
        },
    )

    return dynamo_to_dict(updated_address)


def delete_user_address(user_id: str, address_id: str) -> bool:
    """ユーザーの住所を削除"""
    from datetime import datetime, timezone

    addresses = get_user_addresses(user_id)
    initial_count = len(addresses)

    # 指定されたaddress_idを除外
    addresses = [addr for addr in addresses if addr["address_id"] != address_id]

    if len(addresses) == initial_count:
        # 削除されなかった
        return False

    # DynamoDBを更新
    users_table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET saved_addresses = :addrs, updated_at = :updated",
        ExpressionAttributeValues={
            ":addrs": addresses,
            ":updated": datetime.now(timezone.utc).isoformat(),
        },
    )

    return True


def set_default_address(user_id: str, address_id: str) -> dict | None:
    """デフォルト住所を設定"""
    from datetime import datetime, timezone

    addresses = get_user_addresses(user_id)
    target_address = None

    for addr in addresses:
        if addr["address_id"] == address_id:
            addr["is_default"] = True
            target_address = addr
        else:
            addr["is_default"] = False

    if not target_address:
        return None

    # DynamoDBを更新
    users_table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET saved_addresses = :addrs, updated_at = :updated",
        ExpressionAttributeValues={
            ":addrs": addresses,
            ":updated": datetime.now(timezone.utc).isoformat(),
        },
    )

    return dynamo_to_dict(target_address)


# 例外をエクスポート
UsernameExistsException = cognito.exceptions.UsernameExistsException
UserNotFoundException = cognito.exceptions.UserNotFoundException
DynamoDBClientError = ClientError
