# mizpos-online-sales

mizpos のオンラインストアフロントエンドです。商品の閲覧・購入ができる EC サイトを提供します。

## 機能

- 商品一覧・詳細表示
- カート機能
- オンライン決済（Stripe Checkout）
- 注文履歴

## 技術スタック

- **フレームワーク**: React 19
- **ルーティング**: TanStack Router（ファイルベースルーティング）
- **データ取得**: TanStack Query
- **スタイリング**: Panda CSS
- **リンター/フォーマッター**: Biome
- **テスト**: Vitest

## 開発

### 起動

```bash
# frontendディレクトリから
pnpm turbo run dev --filter=mizpos-online-sales

# または直接
cd frontend/apps/mizpos-online-sales
pnpm dev
```

### ビルド

```bash
pnpm build
```

### テスト

```bash
pnpm test
```

### コード品質チェック

```bash
pnpm check    # lint & format
pnpm fix      # 自動修正
```
