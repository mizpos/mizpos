"""
Android Management API Service
エンタープライズ、ポリシー、デバイス管理のコアロジック
"""

import json
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import boto3
from googleapiclient.errors import HttpError

from google_auth import get_android_management_service, get_project_id

logger = logging.getLogger(__name__)

# DynamoDB設定
DYNAMODB_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
ENTERPRISES_TABLE_NAME = os.environ.get("ENTERPRISES_TABLE_NAME", "mizpos-enterprises")
POLICIES_TABLE_NAME = os.environ.get("POLICIES_TABLE_NAME", "mizpos-mdm-policies")
DEVICES_TABLE_NAME = os.environ.get("DEVICES_TABLE_NAME", "mizpos-mdm-devices")

dynamodb = boto3.resource("dynamodb", region_name=DYNAMODB_REGION)
enterprises_table = dynamodb.Table(ENTERPRISES_TABLE_NAME)
policies_table = dynamodb.Table(POLICIES_TABLE_NAME)
devices_table = dynamodb.Table(DEVICES_TABLE_NAME)


# ==========================================
# SignupURL管理
# ==========================================


def create_signup_url(callback_url: str) -> dict:
    """
    エンタープライズ登録用のサインアップURLを作成

    Args:
        callback_url: 登録完了後のコールバックURL

    Returns:
        name: サインアップURLリソース名
        url: IT管理者がアクセスするURL
    """
    try:
        service = get_android_management_service()
        project_id = get_project_id()

        # signupUrls.create を呼び出し
        request_body = {
            "callbackUrl": callback_url,
            "projectId": project_id,
        }

        result = service.signupUrls().create(
            projectId=project_id,
            body=request_body
        ).execute()

        logger.info(f"Created signup URL: {result.get('name')}")

        return {
            "name": result.get("name", ""),
            "url": result.get("url", ""),
        }

    except HttpError as e:
        logger.error(f"Google API error creating signup URL: {e}")
        raise
    except Exception as e:
        logger.error(f"Error creating signup URL: {e}")
        raise


# ==========================================
# Enterprise管理
# ==========================================


def create_enterprise(enterprise_token: str, signup_url_name: str) -> dict:
    """
    エンタープライズを作成しバインド

    Args:
        enterprise_token: サインアップ完了後に取得したトークン
        signup_url_name: サインアップURL名

    Returns:
        エンタープライズ情報
    """
    try:
        service = get_android_management_service()
        project_id = get_project_id()

        # enterprises.create を呼び出し
        result = service.enterprises().create(
            projectId=project_id,
            signupUrlName=signup_url_name,
            enterpriseToken=enterprise_token
        ).execute()

        enterprise_name = result.get("name", "")
        # enterprises/XXXX の形式からIDを抽出
        enterprise_id = enterprise_name.split("/")[-1] if "/" in enterprise_name else enterprise_name

        # DynamoDBに保存
        now = datetime.now(timezone.utc).isoformat()
        enterprise_item = {
            "enterprise_id": enterprise_id,
            "name": enterprise_name,
            "display_name": result.get("enterpriseDisplayName", ""),
            "primary_color": result.get("primaryColor"),
            "logo": result.get("logo"),
            "enabled_notification_types": result.get("enabledNotificationTypes", []),
            "signup_url_name": signup_url_name,
            "created_at": now,
            "updated_at": now,
        }

        enterprises_table.put_item(Item=enterprise_item)

        logger.info(f"Created enterprise: {enterprise_id}")

        return {
            "enterprise_id": enterprise_id,
            "name": enterprise_name,
            "display_name": enterprise_item.get("display_name"),
            "primary_color": enterprise_item.get("primary_color"),
            "logo": enterprise_item.get("logo"),
            "enabled_notification_types": enterprise_item.get("enabled_notification_types"),
        }

    except HttpError as e:
        logger.error(f"Google API error creating enterprise: {e}")
        raise
    except Exception as e:
        logger.error(f"Error creating enterprise: {e}")
        raise


def get_enterprise(enterprise_id: str) -> Optional[dict]:
    """
    エンタープライズ情報を取得

    Args:
        enterprise_id: エンタープライズID

    Returns:
        エンタープライズ情報（存在しない場合はNone）
    """
    try:
        response = enterprises_table.get_item(Key={"enterprise_id": enterprise_id})
        return response.get("Item")
    except Exception as e:
        logger.error(f"Error getting enterprise: {e}")
        return None


def list_enterprises() -> list[dict]:
    """
    登録されているエンタープライズ一覧を取得

    Returns:
        エンタープライズのリスト
    """
    try:
        response = enterprises_table.scan()
        return response.get("Items", [])
    except Exception as e:
        logger.error(f"Error listing enterprises: {e}")
        return []


def delete_enterprise(enterprise_id: str) -> bool:
    """
    エンタープライズを削除

    Args:
        enterprise_id: エンタープライズID

    Returns:
        削除成功かどうか
    """
    try:
        service = get_android_management_service()

        # Google APIからも削除
        enterprise_name = f"enterprises/{enterprise_id}"
        service.enterprises().delete(name=enterprise_name).execute()

        # DynamoDBから削除
        enterprises_table.delete_item(Key={"enterprise_id": enterprise_id})

        logger.info(f"Deleted enterprise: {enterprise_id}")
        return True

    except HttpError as e:
        logger.error(f"Google API error deleting enterprise: {e}")
        return False
    except Exception as e:
        logger.error(f"Error deleting enterprise: {e}")
        return False


# ==========================================
# Policy管理
# ==========================================


def create_policy(
    enterprise_id: str,
    policy_name: str,
    policy_display_name: Optional[str] = None,
    applications_enabled: bool = True,
    play_store_mode: str = "WHITELIST",
    password_required: bool = True,
    password_minimum_length: int = 6,
    screen_capture_disabled: bool = False,
    camera_disabled: bool = False,
    wifi_config_disabled: bool = False,
    kiosk_mode_enabled: bool = False,
    kiosk_launcher_package: Optional[str] = None,
) -> dict:
    """
    デバイスポリシーを作成

    Args:
        enterprise_id: エンタープライズID
        policy_name: ポリシー名
        その他: 各種ポリシー設定

    Returns:
        作成されたポリシー情報
    """
    try:
        service = get_android_management_service()
        enterprise_name = f"enterprises/{enterprise_id}"

        # ポリシー設定を構築
        policy_body = {
            "applications": [] if applications_enabled else None,
            "playStoreMode": play_store_mode,
            "passwordPolicies": [
                {
                    "passwordMinimumLength": password_minimum_length,
                    "passwordQuality": "NUMERIC" if password_required else "UNSPECIFIED",
                }
            ] if password_required else [],
            "screenCaptureDisabled": screen_capture_disabled,
            "cameraDisabled": camera_disabled,
            "wifiConfigDisabled": wifi_config_disabled,
        }

        # KIOSKモード設定
        if kiosk_mode_enabled and kiosk_launcher_package:
            policy_body["kioskCustomLauncherEnabled"] = True
            policy_body["applications"] = [
                {
                    "packageName": kiosk_launcher_package,
                    "installType": "KIOSK",
                }
            ]

        # Google APIでポリシー作成
        full_policy_name = f"{enterprise_name}/policies/{policy_name}"
        result = service.enterprises().policies().patch(
            name=full_policy_name,
            body=policy_body
        ).execute()

        # DynamoDBに保存
        now = datetime.now(timezone.utc).isoformat()
        policy_id = str(uuid.uuid4())
        policy_item = {
            "policy_id": policy_id,
            "policy_name": policy_name,
            "policy_display_name": policy_display_name or policy_name,
            "enterprise_id": enterprise_id,
            "full_name": full_policy_name,
            "settings": policy_body,
            "created_at": now,
            "updated_at": now,
        }

        policies_table.put_item(Item=policy_item)

        logger.info(f"Created policy: {policy_name} for enterprise {enterprise_id}")

        return {
            "policy_id": policy_id,
            "policy_name": policy_name,
            "policy_display_name": policy_item.get("policy_display_name"),
            "enterprise_id": enterprise_id,
            "created_at": now,
            "updated_at": now,
        }

    except HttpError as e:
        logger.error(f"Google API error creating policy: {e}")
        raise
    except Exception as e:
        logger.error(f"Error creating policy: {e}")
        raise


def get_policy(enterprise_id: str, policy_name: str) -> Optional[dict]:
    """
    ポリシー情報を取得

    Args:
        enterprise_id: エンタープライズID
        policy_name: ポリシー名

    Returns:
        ポリシー情報
    """
    try:
        response = policies_table.query(
            IndexName="EnterpriseIndex",
            KeyConditionExpression="enterprise_id = :eid",
            FilterExpression="policy_name = :pname",
            ExpressionAttributeValues={
                ":eid": enterprise_id,
                ":pname": policy_name,
            }
        )
        items = response.get("Items", [])
        return items[0] if items else None
    except Exception as e:
        logger.error(f"Error getting policy: {e}")
        return None


def list_policies(enterprise_id: str) -> list[dict]:
    """
    エンタープライズのポリシー一覧を取得

    Args:
        enterprise_id: エンタープライズID

    Returns:
        ポリシーのリスト
    """
    try:
        response = policies_table.query(
            IndexName="EnterpriseIndex",
            KeyConditionExpression="enterprise_id = :eid",
            ExpressionAttributeValues={":eid": enterprise_id}
        )
        return response.get("Items", [])
    except Exception as e:
        logger.error(f"Error listing policies: {e}")
        return []


def delete_policy(enterprise_id: str, policy_name: str) -> bool:
    """
    ポリシーを削除

    Args:
        enterprise_id: エンタープライズID
        policy_name: ポリシー名

    Returns:
        削除成功かどうか
    """
    try:
        service = get_android_management_service()

        # Google APIから削除
        full_policy_name = f"enterprises/{enterprise_id}/policies/{policy_name}"
        service.enterprises().policies().delete(name=full_policy_name).execute()

        # DynamoDBから削除
        policy = get_policy(enterprise_id, policy_name)
        if policy:
            policies_table.delete_item(Key={"policy_id": policy["policy_id"]})

        logger.info(f"Deleted policy: {policy_name}")
        return True

    except HttpError as e:
        logger.error(f"Google API error deleting policy: {e}")
        return False
    except Exception as e:
        logger.error(f"Error deleting policy: {e}")
        return False


# ==========================================
# Device管理
# ==========================================


def create_enrollment_token(
    enterprise_id: str,
    policy_name: str,
    enrollment_type: str = "QR_CODE"
) -> dict:
    """
    デバイス登録トークン（QRコード）を生成

    Args:
        enterprise_id: エンタープライズID
        policy_name: 適用するポリシー名
        enrollment_type: 登録タイプ

    Returns:
        登録トークン情報
    """
    try:
        service = get_android_management_service()
        enterprise_name = f"enterprises/{enterprise_id}"

        # 有効期限は1時間
        expiration = datetime.now(timezone.utc) + timedelta(hours=1)

        # 登録トークン作成
        enrollment_token_body = {
            "policyName": f"{enterprise_name}/policies/{policy_name}",
            "duration": "3600s",  # 1時間
            "allowPersonalUsage": "PERSONAL_USAGE_DISALLOWED",
        }

        result = service.enterprises().enrollmentTokens().create(
            parent=enterprise_name,
            body=enrollment_token_body
        ).execute()

        token_name = result.get("name", "")
        token_value = result.get("value", "")

        # QRコードデータを生成
        qr_code_data = None
        if enrollment_type == "QR_CODE":
            qr_code_data = result.get("qrCode")

        logger.info(f"Created enrollment token for enterprise {enterprise_id}")

        return {
            "token": token_value,
            "name": token_name,
            "qr_code": qr_code_data,
            "policy_name": policy_name,
            "enrollment_type": enrollment_type,
            "expiration_timestamp": expiration.isoformat(),
        }

    except HttpError as e:
        logger.error(f"Google API error creating enrollment token: {e}")
        raise
    except Exception as e:
        logger.error(f"Error creating enrollment token: {e}")
        raise


def list_devices(enterprise_id: str) -> list[dict]:
    """
    エンタープライズのデバイス一覧を取得

    Args:
        enterprise_id: エンタープライズID

    Returns:
        デバイスのリスト
    """
    try:
        service = get_android_management_service()
        enterprise_name = f"enterprises/{enterprise_id}"

        result = service.enterprises().devices().list(
            parent=enterprise_name
        ).execute()

        devices = result.get("devices", [])

        # DynamoDBと同期
        for device in devices:
            device_name = device.get("name", "")
            device_id = device_name.split("/")[-1] if "/" in device_name else device_name

            now = datetime.now(timezone.utc).isoformat()
            device_item = {
                "device_id": device_id,
                "name": device_name,
                "enterprise_id": enterprise_id,
                "policy_name": device.get("policyName", "").split("/")[-1],
                "enrollment_state": device.get("state", "UNKNOWN"),
                "hardware_info": device.get("hardwareInfo"),
                "software_info": device.get("softwareInfo"),
                "last_status_report_time": device.get("lastStatusReportTime"),
                "applied_state": device.get("appliedState"),
                "synced_at": now,
            }

            devices_table.put_item(Item=device_item)

        return devices

    except HttpError as e:
        logger.error(f"Google API error listing devices: {e}")
        raise
    except Exception as e:
        logger.error(f"Error listing devices: {e}")
        raise


def get_device(enterprise_id: str, device_id: str) -> Optional[dict]:
    """
    デバイス詳細を取得

    Args:
        enterprise_id: エンタープライズID
        device_id: デバイスID

    Returns:
        デバイス情報
    """
    try:
        service = get_android_management_service()
        device_name = f"enterprises/{enterprise_id}/devices/{device_id}"

        result = service.enterprises().devices().get(
            name=device_name
        ).execute()

        return result

    except HttpError as e:
        logger.error(f"Google API error getting device: {e}")
        return None
    except Exception as e:
        logger.error(f"Error getting device: {e}")
        return None


def issue_device_command(
    enterprise_id: str,
    device_id: str,
    command_type: str,
    new_password: Optional[str] = None
) -> dict:
    """
    デバイスにコマンドを発行

    Args:
        enterprise_id: エンタープライズID
        device_id: デバイスID
        command_type: コマンドタイプ (LOCK/REBOOT/RESET_PASSWORD/WIPE)
        new_password: 新パスワード（RESET_PASSWORD時）

    Returns:
        コマンド実行結果
    """
    try:
        service = get_android_management_service()
        device_name = f"enterprises/{enterprise_id}/devices/{device_id}"

        command_body = {
            "type": command_type,
        }

        if command_type == "RESET_PASSWORD" and new_password:
            command_body["newPassword"] = new_password

        result = service.enterprises().devices().issueCommand(
            name=device_name,
            body=command_body
        ).execute()

        logger.info(f"Issued command {command_type} to device {device_id}")

        return {
            "command_type": command_type,
            "device_id": device_id,
            "result": result,
        }

    except HttpError as e:
        logger.error(f"Google API error issuing command: {e}")
        raise
    except Exception as e:
        logger.error(f"Error issuing command: {e}")
        raise


def delete_device(enterprise_id: str, device_id: str, wipe_data: bool = False) -> bool:
    """
    デバイスを削除

    Args:
        enterprise_id: エンタープライズID
        device_id: デバイスID
        wipe_data: データをワイプするか

    Returns:
        削除成功かどうか
    """
    try:
        service = get_android_management_service()
        device_name = f"enterprises/{enterprise_id}/devices/{device_id}"

        # ワイプが必要な場合は先にコマンドを発行
        if wipe_data:
            issue_device_command(enterprise_id, device_id, "WIPE")

        # デバイスを削除
        service.enterprises().devices().delete(
            name=device_name
        ).execute()

        # DynamoDBからも削除
        devices_table.delete_item(Key={"device_id": device_id})

        logger.info(f"Deleted device: {device_id}")
        return True

    except HttpError as e:
        logger.error(f"Google API error deleting device: {e}")
        return False
    except Exception as e:
        logger.error(f"Error deleting device: {e}")
        return False
