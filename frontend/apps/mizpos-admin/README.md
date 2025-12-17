# mizpos-admin

mizpos の管理画面アプリケーションです。商品・在庫・ユーザー・イベントの管理を行います。

## 機能

- 商品の登録・編集・削除
- 在庫管理
- ユーザー・ロール管理
- イベント管理
- 販売履歴の閲覧

## 技術スタック

- **フレームワーク**: React 19
- **ルーティング**: TanStack Router（ファイルベースルーティング）
- **データ取得**: TanStack Query
- **スタイリング**: Tailwind CSS
- **リンター/フォーマッター**: Biome
- **テスト**: Vitest

## 開発

### 起動

```bash
# frontendディレクトリから
pnpm turbo run dev --filter=mizpos-admin

# または直接
cd frontend/apps/mizpos-admin
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
