# Lambda

mizpos のバックエンド API を構成する AWS Lambda 関数群です。

## 関数一覧

| 関数 | 説明 |
|------|------|
| [accounts](./accounts) | アカウント・ロール管理、認証、クーポン、メール送信 |
| [stock](./stock) | 在庫の登録・更新・履歴管理 |
| [sales](./sales) | 販売処理、Stripe Terminal 連携 |
| [pos](./pos) | POS 関連エンドポイント |

## 技術スタック

- **言語**: Python 3.12
- **パッケージ管理**: uv
- **リンター/フォーマッター**: ruff
- **API 仕様**: OpenAPI（各関数で `/openapi.json` を提供）

## セットアップ

### 前提条件

- Python 3.12
- uv

### 依存関係のインストール

各関数ディレクトリ内で:

```bash
cd accounts
uv sync
```

## 開発

### コード品質チェック

```bash
# フォーマットチェック
uvx ruff format --check lambda/

# Lintチェック
uvx ruff check lambda/

# 自動修正
uvx ruff format lambda/
uvx ruff check --fix lambda/
```

### ローカル実行

各関数は AWS Lambda 向けですが、ローカルでの動作確認も可能です。

```bash
cd accounts
uv run python main.py
```

## API 仕様

各関数はデプロイ後に OpenAPI 仕様を公開します:

- `https://{api-domain}/accounts/openapi.json`
- `https://{api-domain}/stock/openapi.json`
- `https://{api-domain}/sales/openapi.json`

フロントエンドの型生成に使用されます。

## ディレクトリ構成

```
lambda/
├── accounts/           # アカウント・認証
│   ├── main.py         # エントリポイント
│   ├── models.py       # データモデル
│   ├── services.py     # ビジネスロジック
│   ├── auth.py         # 認証処理
│   └── pyproject.toml  # 依存関係
├── stock/              # 在庫管理
├── sales/              # 販売・決済
└── pos/                # POS 関連
```

## デプロイ

Terraform で AWS Lambda にデプロイされます。詳細は [terraform/README.md](../terraform/README.md) を参照してください。
