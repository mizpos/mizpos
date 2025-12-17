# Frontend

mizpos のフロントエンドモノレポです。[Turborepo](https://turbo.build/repo) でアプリケーションと共通パッケージを管理しています。

## アプリケーション

| アプリ | 説明 | フレームワーク |
|--------|------|----------------|
| [mizpos-admin](./apps/mizpos-admin) | 管理画面（商品・在庫・ユーザー管理） | TanStack Router |
| [mizpos-desktop](./apps/mizpos-desktop) | POS デスクトップアプリ | Tauri + React |
| [mizpos-online-sales](./apps/mizpos-online-sales) | オンラインストア | TanStack Router |
| [mizpos-payment-terminal](./apps/mizpos-payment-terminal) | 決済端末アプリ（Android） | Expo |

## 共通パッケージ

| パッケージ | 説明 |
|------------|------|
| [@mizpos/api](./packages/api) | API クライアント（OpenAPI 型生成） |

## セットアップ

### 前提条件

- Node.js 24.x
- pnpm 10.x

### インストール

```bash
pnpm install
```

### 開発サーバー起動

```bash
pnpm dev
```

## 主要コマンド

| コマンド | 説明 |
|----------|------|
| `pnpm dev` | 全アプリの開発サーバー起動 |
| `pnpm build` | 全アプリのビルド |
| `pnpm check` | Biome による lint & format チェック |
| `pnpm check-types` | TypeScript 型チェック |
| `pnpm fix` | Biome による自動修正 |
| `pnpm test` | テスト実行 |
| `pnpm generate-api-types` | API 型生成（開発環境） |
| `pnpm generate-api-types:prod` | API 型生成（本番環境） |
| `pnpm generate-styled-system` | Panda CSS スタイルシステム生成 |

## 技術スタック

- **言語**: TypeScript 5.9
- **フレームワーク**: React 19
- **ルーティング**: TanStack Router
- **データ取得**: TanStack Query, openapi-fetch
- **スタイリング**: Tailwind CSS, Panda CSS
- **リンター/フォーマッター**: Biome
- **テスト**: Vitest
- **ビルドツール**: Vite, Turborepo

## ディレクトリ構成

```
frontend/
├── apps/
│   ├── mizpos-admin/           # 管理画面
│   ├── mizpos-desktop/         # デスクトップアプリ (Tauri)
│   ├── mizpos-online-sales/    # オンラインストア
│   └── mizpos-payment-terminal/# 決済端末 (Expo)
├── packages/
│   └── api/                    # 共通 API クライアント
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 特定アプリの操作

```bash
# 特定アプリのみ開発サーバー起動
pnpm turbo run dev --filter=mizpos-admin

# 特定アプリのみビルド
pnpm turbo run build --filter=mizpos-desktop
```
