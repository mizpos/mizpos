# mizpos-payment-terminal

mizpos の決済端末アプリケーションです。[Expo](https://expo.dev/) を使用した React Native アプリで、Stripe Terminal と連携して対面決済を処理します。

## 機能

- Stripe Terminal（BBPOS WisePad3）との連携
- 決済処理
- レシート表示

## 技術スタック

- **フレームワーク**: Expo (React Native)
- **決済**: Stripe Terminal SDK
- **対象プラットフォーム**: Android

## 前提条件

- Node.js 24.x
- pnpm 10.x
- Android Studio（Android ビルド用）
- Expo CLI

## 開発

### セットアップ

```bash
pnpm install
```

### 起動

```bash
npx expo start
```

### Android ビルド

```bash
# 開発ビルド
npx expo run:android

# プロダクションビルド
eas build --platform android
```

## 対応デバイス

- **決済端末**: BBPOS WisePad3
- **動作確認済み Android**: 8.0 以上
