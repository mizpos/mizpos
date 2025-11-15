# Terraform Infrastructure

mizpos のインフラ構成を管理する Terraform プロジェクトです。

## ディレクトリ構成

```
terraform/
├── modules/          # 共通モジュール（リソース定義）
├── tf-dev/          # 開発環境用の設定
└── tf-prod/         # 本番環境用の設定
```

## 構成されるリソース

### 認証・認可
- **Amazon Cognito**: ユーザー認証とトークン管理
  - User Pool: ユーザー管理
  - Identity Pool: AWS リソースへのアクセス制御
  - OAuth 2.0 対応

### データストア
- **DynamoDB**: NoSQL データベース
  - `users`: ユーザー情報
  - `roles`: ユーザーロール（イベントごとの権限管理）
  - `stock`: 在庫情報
  - `stock_history`: 在庫変動履歴
  - `sales`: 販売履歴
  - `events`: イベント情報

### コンピュート
- **Lambda**: サーバーレス関数
  - `accounts`: アカウント・ロール管理
  - `stock`: 在庫管理
  - `sales`: 決済・販売処理

### API
- **API Gateway (HTTP API)**: REST API エンドポイント
  - Cognito JWT 認証
  - CORS 設定済み
  - CloudWatch Logs 統合
  - カスタムドメイン対応

### セキュリティ
- **Secrets Manager**: 機密情報の管理
  - Stripe API キー
  - Stripe Terminal 設定
- **IAM**: ロールとポリシー
  - Lambda 実行ロール
  - Cognito Identity Pool ロール

### SSL/TLS
- **ACM**: SSL/TLS 証明書
  - ワイルドカード証明書（DNS 検証）

## セットアップ

### 前提条件

- Terraform >= 1.0
- AWS CLI の認証設定済み
- S3 バケット（terraform state 保存用）
  - dev: `mizphses-opensource-mizpos-dev`
  - prod: `mizphses-opensource-mizpos-prod`

### 環境変数の設定

1. サンプルファイルをコピー:
```bash
# 開発環境
cd tf-dev
cp terraform.tfvars.example terraform.tfvars

# 本番環境
cd tf-prod
cp terraform.tfvars.example terraform.tfvars
```

2. `terraform.tfvars` を編集して実際の値を設定:
```hcl
domain_name  = "stg-pos.miz.cab"  # 開発環境
# domain_name  = "pos.miz.cab"    # 本番環境

frontend_url = "https://stg-pos.miz.cab"  # 開発環境
# frontend_url = "https://pos.miz.cab"    # 本番環境
```

### デプロイ

#### 開発環境

```bash
cd tf-dev

# 初期化
terraform init

# プランの確認
terraform plan

# 適用
terraform apply
```

#### 本番環境

```bash
cd tf-prod

# 初期化
terraform init

# プランの確認
terraform plan

# 適用
terraform apply
```

## デプロイ後の設定

### 1. ACM 証明書の DNS 検証

Terraform apply 後、ACM 証明書の DNS 検証レコードを Route53 または利用中の DNS プロバイダーに追加してください。

```bash
# 検証レコードの確認
terraform output acm_certificate_domain_validation_options
```

### 2. カスタムドメインの DNS 設定

API Gateway のカスタムドメインを DNS に設定:

```bash
# Target domain name の確認
terraform output api_gateway_domain_name_target

# CNAME レコードを作成
# api.stg-pos.miz.cab -> [target_domain_name]
# api.pos.miz.cab -> [target_domain_name]
```

### 3. Secrets Manager の設定

プレースホルダーの値を実際の値に置き換え:

```bash
# Stripe API キーの設定
aws secretsmanager put-secret-value \
  --secret-id dev-mizpos-stripe-api-key \
  --secret-string '{"api_key":"sk_test_...","publishable_key":"pk_test_..."}'

# Stripe Terminal 設定
aws secretsmanager put-secret-value \
  --secret-id dev-mizpos-stripe-terminal-config \
  --secret-string '{"location_id":"tml_..."}'
```

### 4. Lambda 関数のデプロイ

Lambda 関数のコードは別途デプロイが必要です（CI/CD で自動化推奨）:

```bash
# 例: AWS CLI での更新
cd ../lambda/accounts
zip -r function.zip .
aws lambda update-function-code \
  --function-name dev-mizpos-accounts \
  --zip-file fileb://function.zip
```

## 出力値

デプロイ完了後、以下の出力値が利用可能です:

```bash
terraform output
```

主な出力値:
- `cognito_user_pool_id`: Cognito User Pool ID
- `cognito_user_pool_client_id`: Cognito Client ID
- `api_gateway_endpoint`: API Gateway のエンドポイント URL
- `api_gateway_custom_domain`: カスタムドメイン名

## CI/CD

GitHub Actions でのデプロイを推奨します。以下の secrets を設定してください:

### GitHub Secrets

#### 共通
- `AWS_ACCESS_KEY_ID`: AWS アクセスキー
- `AWS_SECRET_ACCESS_KEY`: AWS シークレットキー
- `AWS_REGION`: ap-northeast-1

#### 開発環境
- `DEV_DOMAIN_NAME`: stg-pos.miz.cab
- `DEV_FRONTEND_URL`: https://stg-pos.miz.cab

#### 本番環境
- `PROD_DOMAIN_NAME`: pos.miz.cab
- `PROD_FRONTEND_URL`: https://pos.miz.cab

## トラブルシューティング

### State ロックエラー

```bash
# State のロックを解除（慎重に実行）
terraform force-unlock [LOCK_ID]
```

### Lambda プレースホルダーエラー

初回デプロイ時、Lambda プレースホルダーが存在しない場合:

```bash
cd modules
echo 'def handler(event, context): return {"statusCode": 200}' > lambda_placeholder.py
zip lambda_placeholder.zip lambda_placeholder.py
rm lambda_placeholder.py
```

## メンテナンス

### State の確認

```bash
terraform state list
terraform state show [resource_name]
```

### リソースの削除

```bash
# 注意: 本番環境では慎重に実行
terraform destroy
```

## 参考資料

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/)
- [API Gateway](https://docs.aws.amazon.com/apigateway/)
