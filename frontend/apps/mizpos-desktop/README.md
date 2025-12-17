# mizpos-desktop

mizpos の POS デスクトップアプリケーションです。[Tauri](https://tauri.app/) を使用してクロスプラットフォーム対応しています。

## 機能

- レジ操作
- バーコード/QRコード読み取り
- 売上管理
- オフライン対応

## 技術スタック

- **フレームワーク**: Tauri 2.x + React
- **言語**: TypeScript (フロントエンド), Rust (バックエンド)
- **スタイリング**: Panda CSS

## 前提条件

- Node.js 24.x
- pnpm 10.x
- Rust（最新の stable）
- プラットフォーム固有の依存関係（[Tauri Prerequisites](https://tauri.app/start/prerequisites/)）

## 開発

### 起動

```bash
pnpm tauri dev
```

### ビルド

```bash
pnpm tauri build
```

## 推奨 IDE セットアップ

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
