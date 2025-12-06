# POS端末公開鍵認証システム設計

## 概要

POS端末の開局時に、端末内で秘密鍵を生成してOS Keychainに保管し、公開鍵を含むQRコードを表示。mizpos-adminでスキャンして端末を登録するシステム。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────────────┐
│  初回開局フロー                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  mizpos-desktop                       mizpos-admin                   │
│  ┌────────────────┐                  ┌────────────────┐             │
│  │ 1. 秘密鍵生成   │                  │                │             │
│  │   (Ed25519)    │                  │ 4. QRスキャン   │             │
│  └───────┬────────┘                  └───────┬────────┘             │
│          │                                    │                      │
│          ▼                                    │                      │
│  ┌────────────────┐                          │                      │
│  │ 2. Keychainに  │                          │                      │
│  │   秘密鍵保存   │                          │                      │
│  └───────┬────────┘                          │                      │
│          │                                    │                      │
│          ▼                                    ▼                      │
│  ┌────────────────┐                  ┌────────────────┐             │
│  │ 3. QRコード表示 │ ───────────────▶│ 5. 端末登録API │             │
│  │  - 公開鍵      │   (カメラスキャン) │   呼び出し    │             │
│  │  - メタデータ  │                  └───────┬────────┘             │
│  └────────────────┘                          │                      │
│                                              ▼                      │
│                                      ┌────────────────┐             │
│                                      │ 6. DynamoDB    │             │
│                                      │   端末テーブル  │             │
│                                      └────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
```

## 技術スタック

### mizpos-desktop (Tauri/Rust)

| 用途 | ライブラリ | 備考 |
|------|-----------|------|
| 鍵生成 | `ed25519-dalek` | Ed25519キーペア生成・署名 |
| 鍵保管 | `keyring` (v4) | OS Keychain/Credential Manager |
| QRコード表示 | `qrcode.react` (フロント) | 既存の依存関係 |

### mizpos-admin (React)

| 用途 | ライブラリ | 備考 |
|------|-----------|------|
| QRスキャン | `@yudiel/react-qr-scanner` or `html5-qrcode` | カメラアクセス |
| API通信 | 既存の `@mizpos/api` | OpenAPI生成クライアント |

### Backend (Python/Lambda)

| 用途 | ライブラリ | 備考 |
|------|-----------|------|
| 署名検証 | `PyNaCl` or `ed25519` | Ed25519検証 |
| DB | DynamoDB | 端末テーブル追加 |

---

## データ構造

### 1. QRコードペイロード

```json
{
  "v": 1,
  "terminal_id": "550e8400-e29b-41d4-a716-446655440000",
  "public_key": "base64-encoded-32-bytes-ed25519-public-key",
  "device_name": "レジ1号機",
  "os": "macos",
  "registered_at": "2025-12-06T10:00:00Z"
}
```

URL形式: `mizpos://register?data=<base64url-encoded-json>`

### 2. DynamoDB: terminals テーブル

```
テーブル名: {env}-mizpos-terminals

Primary Key:
  - terminal_id (String, Partition Key)

Attributes:
  - public_key (String): Base64エンコードされた公開鍵
  - device_name (String): 端末名
  - os (String): macos | windows | android
  - status (String): active | revoked
  - registered_by (String): 登録したユーザーのuser_id
  - registered_at (String): ISO8601
  - revoked_at (String, optional): revoke日時
  - last_seen_at (String, optional): 最終アクセス日時

GSI:
  - StatusIndex: status (PK) - 有効な端末の一覧取得用
```

### 3. Keychain保存データ

```
Service: "com.miz.mizpos"
Account: "terminal-private-key"
Value: Base64エンコードされた秘密鍵 (32 bytes)

Service: "com.miz.mizpos"
Account: "terminal-id"
Value: UUID文字列
```

---

## API設計

### 端末登録 (POST /accounts/terminals)

**認証**: Cognito JWT (mizpos-admin)

**Request Body**:
```json
{
  "terminal_id": "550e8400-e29b-41d4-a716-446655440000",
  "public_key": "base64-encoded-public-key",
  "device_name": "レジ1号機",
  "os": "macos"
}
```

**Response** (201 Created):
```json
{
  "terminal": {
    "terminal_id": "550e8400-...",
    "device_name": "レジ1号機",
    "status": "active",
    "registered_at": "2025-12-06T10:00:00Z"
  }
}
```

### 端末一覧 (GET /accounts/terminals)

**認証**: Cognito JWT

**Response**:
```json
{
  "terminals": [
    {
      "terminal_id": "...",
      "device_name": "レジ1号機",
      "os": "macos",
      "status": "active",
      "registered_at": "...",
      "last_seen_at": "..."
    }
  ]
}
```

### 端末revoke (DELETE /accounts/terminals/{terminal_id})

**認証**: Cognito JWT

**Response**: 204 No Content

### 端末認証 (POST /accounts/terminals/auth)

**認証なし** (端末からの呼び出し)

**Request Body**:
```json
{
  "terminal_id": "550e8400-...",
  "timestamp": 1733482800,
  "signature": "base64-encoded-ed25519-signature"
}
```

署名対象: `{terminal_id}:{timestamp}`

**Response** (200 OK):
```json
{
  "valid": true,
  "terminal": {
    "terminal_id": "...",
    "device_name": "レジ1号機",
    "status": "active"
  }
}
```

---

## 認証フロー

### 初回起動 (未登録端末)

```
1. アプリ起動
2. Keychainに秘密鍵があるか確認
3. なければ:
   a. Ed25519キーペアを生成
   b. 秘密鍵をKeychainに保存
   c. terminal_idを生成してKeychainに保存
   d. QRコード表示画面へ遷移
4. 管理者がQRをスキャンして登録
5. 端末が定期的に /terminals/auth を呼び出して登録確認
6. 登録確認できたら通常のログイン画面へ
```

### 通常起動 (登録済み端末)

```
1. アプリ起動
2. Keychainから秘密鍵とterminal_idを取得
3. /terminals/auth でサーバーに認証
4. 成功: 通常のPOSログイン画面へ
5. 失敗 (revoked): QRコード再表示 or エラー画面
```

### API呼び出し時の署名

```
各API呼び出しのヘッダー:
X-Terminal-ID: {terminal_id}
X-Terminal-Timestamp: {unix_timestamp}
X-Terminal-Signature: {base64_signature}

署名対象: "{terminal_id}:{timestamp}:{request_path}"
```

---

## Android対応

Androidでは `keyring-rs` の代わりに Android Keystore を使用:

```kotlin
// Tauri Android Plugin で実装
val keyStore = KeyStore.getInstance("AndroidKeyStore")
keyStore.load(null)

// キー生成
val keyPairGenerator = KeyPairGenerator.getInstance(
    KeyProperties.KEY_ALGORITHM_EC,
    "AndroidKeyStore"
)
```

Rustからは JNI 経由で呼び出し（既存の `jni` クレート使用）。

---

## 実装ステップ

### Phase 1: Backend API (Lambda/DynamoDB)

1. DynamoDB terminals テーブル作成
2. `terminal_services.py` 作成
3. API エンドポイント追加 (`main.py`)
4. PyNaCl で署名検証実装
5. OpenAPI スキーマ更新

### Phase 2: mizpos-desktop (Rust/Tauri)

1. `Cargo.toml` に `keyring`, `ed25519-dalek` 追加
2. `terminal_auth.rs` モジュール作成
   - キーペア生成
   - Keychain 読み書き
   - 署名生成
3. Tauri コマンド公開
   - `get_terminal_status`
   - `generate_registration_qr`
   - `sign_request`
4. フロントエンド UI
   - 登録待ち画面 (QRコード表示)
   - 登録完了後の遷移

### Phase 3: mizpos-admin (React)

1. QRスキャナーコンポーネント追加
2. 端末登録ページ作成
3. 端末一覧・管理ページ作成
4. revoke 機能実装

### Phase 4: Android対応

1. Tauri Android プラグイン作成
2. Android Keystore 連携
3. 動作検証

---

## セキュリティ考慮事項

1. **秘密鍵の保護**: OS Keychain/Keystore により、アプリ外からのアクセスを防止
2. **Replay攻撃対策**: タイムスタンプを署名に含め、5分以内のリクエストのみ受付
3. **公開鍵の検証**: 登録時に弱い公開鍵をチェック (`is_weak()`)
4. **Revoke即時反映**: サーバー側で公開鍵削除後、次回認証時に即座に拒否
5. **登録権限**: Cognito認証済みの管理者のみが端末登録可能

---

## 今後の拡張

- 端末グループ管理（店舗単位など）
- 端末ごとの権限設定
- 監査ログ（認証履歴の保存）
- 端末の自動失効（一定期間未使用時）
