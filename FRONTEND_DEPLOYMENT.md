# フロントエンドデプロイガイド

## 概要

このドキュメントでは、mizpos フロントエンドアプリケーションを AWS S3 + CloudFront にデプロイするための手順を説明します。

## アーキテクチャ

```
GitHub Actions → S3 (静的ファイル) → CloudFront (CDN) → ユーザー
```

- **S3**: 静的ファイルのホスティング
- **CloudFront**: グローバルCDN、HTTPS終端、キャッシュ
- **ACM**: SSL/TLS証明書（us-east-1）
- **Route53**: DNS管理

## 前提条件

1. Terraformインフラストラクチャがデプロイ済み
2. Route53にホストゾーンが設定済み
3. GitHub ActionsのOIDC認証が設定済み

## デプロイ手順

### 1. Terraformでインフラを構築

```bash
cd terraform/tf-dev
terraform init
terraform plan
terraform apply
```

これにより以下が作成されます：
- S3バケット（`mizpos-dev-frontend`）
- CloudFrontディストリビューション
- ACM証明書（us-east-1）
- Route53 DNSレコード
- IAMデプロイポリシー

### 2. GitHub Secretsの設定

GitHub リポジトリの Settings → Secrets and variables → Actions に以下を設定：

#### 必須シークレット（開発環境）

| シークレット名 | 説明 | 取得方法 |
|---------------|------|---------|
| `AWS_ROLE_ARN_DEV` | GitHub Actions用IAMロールARN | 既に設定済み |
| `FRONTEND_S3_BUCKET_DEV` | フロントエンド用S3バケット名 | Terraform output: `frontend_s3_bucket_name` |
| `CLOUDFRONT_DISTRIBUTION_ID_DEV` | CloudFrontディストリビューションID | Terraform output: `frontend_cloudfront_distribution_id` |
| `API_GATEWAY_BASE_DEV` | API Gateway のベースURL | Terraform output: `api_gateway_endpoint` または `https://api.stg-pos.miz.cab` |
| `COGNITO_USER_POOL_ID_DEV` | Cognito User Pool ID | Terraform output: `cognito_user_pool_id` |
| `COGNITO_CLIENT_ID_DEV` | Cognito Client ID | Terraform output: `cognito_user_pool_client_id` |
| `AWS_REGION_DEV` | AWSリージョン | `ap-northeast-1` |

#### Terraform Outputsの取得

```bash
cd terraform/tf-dev
terraform output
```

出力例：
```
frontend_s3_bucket_name = "mizpos-dev-frontend"
frontend_cloudfront_distribution_id = "E1234567890ABC"
frontend_url = "https://app.stg-pos.miz.cab"
cognito_user_pool_id = "ap-northeast-1_XXXXXXXXX"
cognito_user_pool_client_id = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
api_gateway_endpoint = "https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev"
```

### 3. IAMロールにポリシーをアタッチ

GitHub Actions用のIAMロールに、フロントエンドデプロイ用ポリシーをアタッチします：

```bash
# Terraform outputからポリシーARNを取得
POLICY_ARN=$(terraform output -raw frontend_deploy_policy_arn)

# IAMロールにポリシーをアタッチ
aws iam attach-role-policy \
  --role-name <your-github-actions-role> \
  --policy-arn $POLICY_ARN
```

### 4. カスタムドメインの有効化（オプション）

`enable_custom_domain = true` に設定すると：
- ACM証明書が自動作成・検証
- Route53にDNSレコードが自動作成
- CloudFrontがカスタムドメインを使用

```hcl
# terraform.tfvars
enable_custom_domain = true
domain_name          = "stg-pos.miz.cab"
```

結果：`https://app.stg-pos.miz.cab` でアクセス可能

## 自動デプロイ

### トリガー条件

1. **mainブランチへのプッシュ**: `frontend/` ディレクトリの変更時に自動デプロイ
2. **手動実行**: GitHub Actions UIから `workflow_dispatch` で実行可能
   - デプロイするアプリケーションを選択可能（mizpos-admin / mizpos-online-sales）

### ワークフローの流れ

1. **Build Job**
   - pnpm依存関係インストール
   - TypeScript型チェック
   - Viteビルド（環境変数を注入）
   - ビルドアーティファクトをアップロード

2. **Deploy Job** (mainブランチのみ)
   - S3にファイル同期（`--delete`で古いファイル削除）
   - キャッシュ制御ヘッダー設定
   - CloudFrontキャッシュ無効化

3. **Preview Job** (PRのみ)
   - ビルド結果をPRコメントに投稿

## ローカル開発

### 環境変数の設定

```bash
cp frontend/apps/mizpos-admin/.env.example frontend/apps/mizpos-admin/.env.development
```

`.env.development` を編集：
```
VITE_API_GATEWAY_BASE=https://api.stg-pos.miz.cab
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=ap-northeast-1
```

### 開発サーバー起動

```bash
cd frontend
pnpm install
pnpm --filter mizpos-admin dev
```

## トラブルシューティング

### CloudFrontキャッシュが更新されない

```bash
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

### SPAルーティングが動作しない

CloudFrontで404/403エラーを`index.html`にリダイレクトする設定が必要です。
Terraformで自動設定されています。

### 証明書検証が完了しない

Route53のホストゾーンがドメインに紐づいていることを確認してください。
DNS検証レコードが自動的に作成されます。

## 本番環境デプロイ

本番環境（`tf-prod`）も同様の手順でデプロイ可能です。
GitHub Secretsに `_PROD` サフィックスの変数を追加してください：

- `FRONTEND_S3_BUCKET_PROD`
- `CLOUDFRONT_DISTRIBUTION_ID_PROD`
- `API_GATEWAY_BASE_PROD`
- `COGNITO_USER_POOL_ID_PROD`
- `COGNITO_CLIENT_ID_PROD`
- `AWS_REGION_PROD`

本番用のワークフローファイルを別途作成するか、環境変数で切り替える実装が必要です。

## 公開URL

- **開発環境**:
  - カスタムドメイン有効時: `https://app.stg-pos.miz.cab`
  - デフォルト: `https://d1234567890.cloudfront.net`

- **本番環境**:
  - カスタムドメイン有効時: `https://app.pos.miz.cab`
  - デフォルト: `https://d1234567890.cloudfront.net`

## セキュリティ考慮事項

1. **S3バケット**: パブリックアクセス完全ブロック
2. **CloudFront OAC**: S3への直接アクセス禁止
3. **HTTPS強制**: HTTP→HTTPSリダイレクト
4. **TLS 1.2以上**: 最新プロトコルのみ許可
5. **環境変数**: 機密情報はGitHub Secretsで管理
