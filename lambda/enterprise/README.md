# mizpos-enterprise-android-manager

Android Enterprise MDM管理用Lambda Function

## 機能

- エンタープライズ登録（signupUrls, enterprises）
- ポリシー管理（デバイス制限、セキュリティ設定）
- デバイス管理（QRコード登録、コマンド発行）

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `GCP_PROJECT_ID` | Google CloudプロジェクトID |
| `GCP_SERVICE_ACCOUNT_SECRET_NAME` | AWS Secrets Managerのシークレット名 |
| `USER_POOL_ID` | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Cognito Client ID |
| `ENTERPRISES_TABLE_NAME` | DynamoDBテーブル名（エンタープライズ） |
| `POLICIES_TABLE_NAME` | DynamoDBテーブル名（ポリシー） |
| `DEVICES_TABLE_NAME` | DynamoDBテーブル名（デバイス） |

## API Endpoints

### SignupURL
- `POST /signup-urls` - サインアップURL作成

### Enterprise
- `POST /enterprises` - エンタープライズ作成
- `GET /enterprises` - 一覧取得
- `GET /enterprises/{id}` - 詳細取得
- `DELETE /enterprises/{id}` - 削除

### Policy
- `POST /enterprises/{id}/policies` - ポリシー作成
- `GET /enterprises/{id}/policies` - 一覧取得
- `GET /enterprises/{id}/policies/{name}` - 詳細取得
- `DELETE /enterprises/{id}/policies/{name}` - 削除

### Device
- `POST /enterprises/{id}/enrollment-tokens` - 登録トークン作成
- `GET /enterprises/{id}/devices` - 一覧取得
- `GET /enterprises/{id}/devices/{id}` - 詳細取得
- `POST /enterprises/{id}/devices/{id}/command` - コマンド発行
- `DELETE /enterprises/{id}/devices/{id}` - 削除

## セットアップ

1. Google CloudでAndroid Management APIを有効化
2. サービスアカウントを作成し、`Android Management User`ロールを付与
3. サービスアカウントキー(JSON)をAWS Secrets Managerに保存
