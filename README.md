# mizpos

[![CI](https://github.com/mizpos/mizpos/actions/workflows/ci.yml/badge.svg)](https://github.com/mizpos/mizpos/actions/workflows/ci.yml)
[![Terraform](https://github.com/mizpos/mizpos/actions/workflows/terraform-format-check.yml/badge.svg)](https://github.com/mizpos/mizpos/actions/workflows/terraform-format-check.yml)

同人誌即売会向けのサーバーレス POS システムです。完全クラウド運用で、決済端末・在庫管理・オンライン販売を統合的に管理できます。

## 特徴

- **サーバーレスアーキテクチャ**: AWS Lambda + DynamoDB で運用コストを最小限に
- **Stripe Terminal 対応**: 対面決済をスムーズに処理
- **マルチプラットフォーム**: Web、デスクトップ、モバイル端末に対応
- **イベントごとの権限管理**: 複数のイベントやスタッフを柔軟に管理

## アプリケーション構成

| アプリ | 説明 | 技術スタック |
|--------|------|--------------|
| [mizpos-admin](./frontend/apps/mizpos-admin) | 管理画面（商品・在庫・ユーザー管理） | React, TanStack Router |
| [mizpos-desktop](./frontend/apps/mizpos-desktop) | POS デスクトップアプリ | Tauri, React, Rust |
| [mizpos-payment-terminal](./frontend/apps/mizpos-payment-terminal) | 決済端末アプリ（Android） | React Native, Expo |
| [mizpos-online-sales](./frontend/apps/mizpos-online-sales) | オンラインストア | React, TanStack Router |

## ディレクトリ構成

```
.
├── frontend/          # フロントエンドモノレポ (Turborepo)
│   ├── apps/          # 各アプリケーション
│   └── packages/      # 共通パッケージ（API クライアント等）
├── lambda/            # バックエンド Lambda 関数 (Python)
│   ├── accounts/      # アカウント・ロール管理
│   ├── stock/         # 在庫管理
│   ├── sales/         # 販売・決済処理
│   └── pos/           # POS 関連
├── terraform/         # インフラ構成 (AWS)
│   ├── modules/       # 共通モジュール
│   ├── tf-dev/        # 開発環境
│   └── tf-prod/       # 本番環境
└── scripts/           # ユーティリティスクリプト
```

## 技術スタック

### Frontend
- **パッケージ管理**: pnpm + Turborepo
- **言語**: TypeScript
- **フレームワーク**: React 19, TanStack Router/Query
- **スタイリング**: Tailwind CSS, Panda CSS
- **リンター/フォーマッター**: Biome
- **デスクトップ**: Tauri (Rust)
- **モバイル**: Expo (React Native)

### Backend
- **言語**: Python 3.12
- **ツール**: uv, ruff
- **API 仕様**: OpenAPI

### Infrastructure
- **IaC**: Terraform
- **クラウド**: AWS (Lambda, DynamoDB, API Gateway, Cognito, Secrets Manager)
- **決済**: Stripe / Stripe Terminal

## セットアップ

### 前提条件

- Node.js 24.x
- pnpm 10.x
- Python 3.12
- Terraform 1.x
- AWS CLI（認証設定済み）

### フロントエンド

```bash
cd frontend
pnpm install
pnpm dev
```

### バックエンド

Lambda 関数は各ディレクトリごとに依存関係を管理しています。

```bash
cd lambda/accounts
uv sync
```

### インフラ

詳細は [terraform/README.md](./terraform/README.md) を参照してください。

```bash
cd terraform/tf-dev
terraform init
terraform plan
terraform apply
```

## 開発

### コード品質チェック

```bash
# フロントエンド
cd frontend
pnpm check        # lint & format チェック
pnpm check-types  # TypeScript 型チェック

# バックエンド
uvx ruff format --check lambda/
uvx ruff check lambda/
```

### ビルド

```bash
cd frontend
pnpm build
```

### API 型生成

```bash
cd frontend
pnpm generate-api-types      # 開発環境
pnpm generate-api-types:prod # 本番環境
```

## ライセンス

[LICENSE](./LICENSE) を参照してください。

## コントリビューション

Issue や Pull Request は歓迎です。
