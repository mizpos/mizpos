# Cloudflare Turnstile セットアップガイド

このドキュメントでは、管理画面ログインに追加されたCloudflare Turnstile機能のセットアップ方法を説明します。

## 概要

Cloudflare Turnstileは、管理画面のログイン時にボット攻撃を防ぐために実装されています。

## セットアップ手順

### 1. Cloudflare Turnstileサイトキーの取得

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にログイン
2. Turnstileセクションに移動
3. 新しいサイトを作成
   - **サイトドメイン**:
     - Dev: `admin.stg-pos.miz.cab`
     - Prod: `admin.pos.miz.cab`
   - **ウィジェットモード**: Managed (推奨)
4. Site KeyとSecret Keyをメモ

### 2. Terraform環境変数の設定

#### GitHub Secretsに追加

以下の環境変数をGitHub Secretsに追加してください：

- `CLOUDFLARE_ACCOUNT_ID`: CloudflareアカウントID
- `CLOUDFLARE_API_TOKEN`: Cloudflare APIトークン（Turnstile権限が必要）

#### terraform.tfvarsの更新

各環境の`terraform.tfvars`に以下を追加：

```hcl
# Dev環境 (terraform/tf-dev/terraform.tfvars)
cloudflare_account_id = "your-cloudflare-account-id"
admin_domain          = "admin.stg-pos.miz.cab"

# Prod環境 (terraform/tf-prod/terraform.tfvars)
cloudflare_account_id = "your-cloudflare-account-id"
admin_domain          = "admin.pos.miz.cab"
```

### 3. Terraformのデプロイ

```bash
# Dev環境
cd terraform/tf-dev
export CLOUDFLARE_API_TOKEN="your-cloudflare-api-token"
terraform init
terraform plan
terraform apply

# Site Keyを取得
terraform output turnstile_site_key
```

### 4. フロントエンド環境変数の設定

管理画面アプリケーションの環境変数ファイルに以下を追加：

```bash
# frontend/apps/mizpos-admin/.env.development
VITE_TURNSTILE_SITE_KEY=<dev-site-key>

# frontend/apps/mizpos-admin/.env.production
VITE_TURNSTILE_SITE_KEY=<prod-site-key>
```

### 5. Lambda関数のデプロイ

Lambda関数には追加のPython依存関係（`httpx`）が必要です。

Lambda関数のデプロイ時に、以下のパッケージが含まれることを確認してください：

- `httpx`: Turnstile APIへのHTTPリクエスト用
- `boto3`: AWS Secrets Managerアクセス用（既存）

CI/CDパイプラインで自動的にデプロイされます。

## 動作確認

### 1. フロントエンド

1. 管理画面ログインページにアクセス
2. メールアドレスとパスワードフィールドの下にTurnstileウィジェットが表示されることを確認
3. ウィジェットをクリックして検証を完了
4. ログインボタンが有効になることを確認

### 2. バックエンド

Turnstile検証エンドポイントをテスト：

```bash
# トークンを検証（認証不要）
curl -X POST https://api.dev.pos.miz.cab/dev/accounts/auth/verify-turnstile \
  -H "Content-Type: application/json" \
  -d '{"token": "turnstile-token-from-widget"}'

# 期待されるレスポンス
{
  "success": true,
  "message": "Turnstile verification successful"
}
```

## トラブルシューティング

### ウィジェットが表示されない

- `VITE_TURNSTILE_SITE_KEY`環境変数が正しく設定されているか確認
- ブラウザのコンソールでエラーメッセージを確認

### 検証が失敗する

- Cloudflare Dashboardで以下を確認：
  - ドメインが正しく設定されているか
  - Secret Keyが正しくSecrets Managerに保存されているか
- Lambda関数のCloudWatch Logsを確認

### Secrets Managerエラー

```
Failed to retrieve secret
```

- Terraform applyが正常に完了しているか確認
- Lambda IAMロールにSecrets Manager権限があるか確認

## アーキテクチャ

```
Frontend (React)
  ↓ Turnstile Widget
  ↓ Token生成
  ↓
Backend API (/auth/verify-turnstile)
  ↓ Token検証
  ↓
Cloudflare Turnstile API
  ↓ 検証結果
  ↓
AWS Secrets Manager (Secret Key取得)
```

## セキュリティ考慮事項

1. **Secret Keyの保護**: Secret KeyはAWS Secrets Managerに保存され、Lambda関数からのみアクセス可能
2. **IPアドレス検証**: Turnstile検証時にクライアントIPアドレスも送信
3. **トークンの一回性**: Turnstileトークンは一度しか使用できません

## 参考資料

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [React Turnstile Library](https://github.com/marsidev/react-turnstile)
