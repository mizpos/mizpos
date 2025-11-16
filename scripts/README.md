# MizPOS 初期セットアップスクリプト

## 管理者ユーザーの作成

初期セットアップ時に、管理者ユーザーを Cognito と DynamoDB の両方に登録します。

### 前提条件

- Python 3.12+
- boto3 がインストールされていること
- AWS CLI が設定済みで、適切な権限があること
- Terraform がデプロイ済みであること

### インストール

```bash
pip install boto3
```

### 使用方法

#### 基本的な使用方法（Terraform outputs から自動取得）

```bash
python scripts/setup_admin_user.py \
  --email admin@example.com \
  --password "YourSecureP@ssw0rd!" \
  --display-name "システム管理者"
```

#### 環境を指定

```bash
# dev 環境（デフォルト）
python scripts/setup_admin_user.py \
  --environment dev \
  --email admin@example.com \
  --password "YourSecureP@ssw0rd!"

# prod 環境
python scripts/setup_admin_user.py \
  --environment prod \
  --email admin@example.com \
  --password "YourSecureP@ssw0rd!"
```

#### 手動で設定を指定

```bash
python scripts/setup_admin_user.py \
  --user-pool-id ap-northeast-1_XXXXXXXXX \
  --users-table dev-mizpos-users \
  --email admin@example.com \
  --password "YourSecureP@ssw0rd!" \
  --display-name "管理者"
```

### パスワード要件

Cognito のパスワードポリシーに準拠する必要があります：

- 最小 8 文字
- 大文字を含む
- 小文字を含む
- 数字を含む
- 特殊文字を含む（!@#$%^&*() など）

### 実行例

```bash
$ python scripts/setup_admin_user.py \
    --email admin@mizpos.example.com \
    --password "Admin123!@#" \
    --display-name "MizPOS管理者"

Fetching configuration from Terraform outputs (dev)...
Configuration:
  Environment: dev
  User Pool ID: ap-northeast-1_ZNabVAuLX
  Users Table: dev-mizpos-users
  Region: ap-northeast-1
  Email: admin@mizpos.example.com
  Display Name: MizPOS管理者

Creating admin user: admin@mizpos.example.com
  1. Creating Cognito user...
     Cognito user created: admin@mizpos.example.com
  2. Setting permanent password...
     Password set as permanent
  3. Creating DynamoDB user record...
     DynamoDB user created: 550e8400-e29b-41d4-a716-446655440000
Admin user created successfully!

==================================================
User Details:
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "cognito_user_id": "admin@mizpos.example.com",
  "email": "admin@mizpos.example.com",
  "display_name": "MizPOS管理者",
  "created_at": "2025-11-16T14:30:00+00:00",
  "updated_at": "2025-11-16T14:30:00+00:00"
}
==================================================

You can now login with:
  Email: admin@mizpos.example.com
  Password: Admin123!@#
```

### 注意事項

- このスクリプトは初期セットアップ用です
- 既存のユーザーがいる場合、Cognito 側はスキップされますが、DynamoDB には新しいレコードが作成されます
- 本番環境では適切なパスワードを使用してください
- パスワードはログに出力されるため、実行後は安全に管理してください
