"""
Google Cloud Service Account Authentication
Android Management API用のサービスアカウント認証モジュール
"""

import json
import logging
import os
from functools import lru_cache
from typing import Optional

import boto3
from google.oauth2 import service_account
from googleapiclient.discovery import build, Resource

logger = logging.getLogger(__name__)

# 環境変数
GCP_PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
GCP_SERVICE_ACCOUNT_SECRET_NAME = os.environ.get(
    "GCP_SERVICE_ACCOUNT_SECRET_NAME", "mizpos/gcp-service-account"
)
AWS_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")

# Android Management API スコープ
ANDROID_MANAGEMENT_SCOPES = [
    "https://www.googleapis.com/auth/androidmanagement"
]


def get_secrets_manager_client():
    """AWS Secrets Managerクライアントを取得"""
    return boto3.client("secretsmanager", region_name=AWS_REGION)


@lru_cache(maxsize=1)
def get_service_account_credentials() -> service_account.Credentials:
    """
    AWS Secrets Managerからサービスアカウントキーを取得し、
    Google Cloud認証情報を返す
    """
    try:
        client = get_secrets_manager_client()
        response = client.get_secret_value(SecretId=GCP_SERVICE_ACCOUNT_SECRET_NAME)
        secret_string = response.get("SecretString")

        if not secret_string:
            raise ValueError("Service account secret is empty")

        service_account_info = json.loads(secret_string)

        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=ANDROID_MANAGEMENT_SCOPES
        )

        return credentials

    except Exception as e:
        logger.error(f"Failed to get service account credentials: {e}")
        raise


@lru_cache(maxsize=1)
def get_android_management_service() -> Resource:
    """
    Android Management APIサービスインスタンスを取得
    """
    try:
        credentials = get_service_account_credentials()
        service = build(
            "androidmanagement",
            "v1",
            credentials=credentials,
            cache_discovery=False
        )
        return service

    except Exception as e:
        logger.error(f"Failed to build Android Management service: {e}")
        raise


def get_project_id() -> str:
    """GCPプロジェクトIDを取得"""
    if GCP_PROJECT_ID:
        return GCP_PROJECT_ID

    # Secrets Managerからサービスアカウント情報を取得してproject_idを抽出
    try:
        client = get_secrets_manager_client()
        response = client.get_secret_value(SecretId=GCP_SERVICE_ACCOUNT_SECRET_NAME)
        secret_string = response.get("SecretString")

        if secret_string:
            service_account_info = json.loads(secret_string)
            return service_account_info.get("project_id", "")

    except Exception as e:
        logger.error(f"Failed to get project ID from service account: {e}")

    return ""


def clear_cache():
    """認証情報のキャッシュをクリア（テスト用）"""
    get_service_account_credentials.cache_clear()
    get_android_management_service.cache_clear()
