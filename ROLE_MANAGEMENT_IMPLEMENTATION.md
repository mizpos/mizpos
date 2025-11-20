# ロール管理機能 実装概要

## 概要

このドキュメントは、MizPOSにおけるサークル（Publisher）単位のロール管理機能の実装内容をまとめたものです。

## 実装完了項目

### 1. データベーススキーマ拡張

**ファイル**: `terraform/modules/dynamodb.tf`

Rolesテーブルに以下の変更を加えました:

- `publisher_id` 属性を追加
- `PublisherIndex` GSI を追加（publisher_id でクエリ可能）
- ロールタイプのコメントを追加

#### サポートするロールタイプ

```
- system_admin: システム全体の管理者
- publisher_admin: サークル管理者（特定のpublisher_id）
- publisher_sales: 販売担当（特定のpublisher_id）
- event_admin: イベント管理者（特定のevent_id）
- event_sales: イベント販売担当（特定のevent_id）
```

#### データモデル

```typescript
{
  user_id: string (PK)
  role_id: string (SK)
  scope: "system" | "publisher" | "event"
  role_type: string
  publisher_id?: string (publisher スコープの場合)
  event_id?: string (event スコープの場合)
  created_at: string
  created_by: string
}
```

### 2. バックエンド実装

#### モデル定義

**ファイル**: `lambda/accounts/models.py`

- `AssignRoleRequest`: ロール付与リクエスト（publisher_id/event_id 対応）
- `RoleResponse`: ロールレスポンス（scope, created_by 追加）
- `ListRolesRequest`: ロール一覧取得フィルタ

#### サービス関数

**ファイル**: `lambda/accounts/services.py`

新規追加した関数:

- `assign_role()`: ロールを付与（スコープ別のバリデーション付き）
- `get_user_roles()`: ユーザーの全ロールを取得
- `get_roles_by_publisher()`: サークルのロール一覧を取得
- `get_roles_by_event()`: イベントのロール一覧を取得
- `remove_role()`: ロールを削除
- `has_role()`: ユーザーが特定のロールを持つかチェック
- `is_system_admin()`: システム管理者かチェック
- `is_publisher_admin()`: サークル管理者かチェック
- `can_assign_role()`: ロール付与の権限があるかチェック

#### 権限チェック機能

**ファイル**: `lambda/accounts/permissions.py`（新規作成）

FastAPI Dependency として使用可能な権限チェック関数:

- `get_user_id_from_auth()`: 認証ユーザーのuser_idを取得
- `require_system_admin()`: システム管理者権限を要求
- `require_publisher_access()`: サークルへのアクセス権限を要求
- `require_event_access()`: イベントへのアクセス権限を要求
- `check_resource_permission()`: リソース別の権限チェック

#### APIエンドポイント

**ファイル**: `lambda/accounts/main.py`

既存エンドポイントを更新し、権限チェックを追加:

##### ユーザーロール管理

- `GET /users/{user_id}/roles`: ユーザーのロール一覧取得
  - 権限: 本人またはシステム管理者

- `POST /users/{user_id}/roles`: ロール付与
  - 権限:
    - システム管理者: すべてのロールを付与可能
    - サークル管理者: 自分のサークルの publisher_admin/publisher_sales を付与可能
    - イベント管理者: 自分のイベントの event_admin/event_sales を付与可能

- `DELETE /users/{user_id}/roles/{role_id}`: ロール削除
  - 権限: システム管理者のみ

##### サークルロール管理

- `GET /publishers/{publisher_id}/roles`: サークルのロール一覧取得
  - 権限: システム管理者またはサークルのメンバー

##### イベントロール管理

- `GET /events/{event_id}/roles`: イベントのロール一覧取得
  - 権限: システム管理者またはイベントのメンバー

### 3. 権限体系

#### システム管理者（system_admin）

- すべてのサークル・イベントの管理
- 委託販売設定の管理
- すべてのユーザーのロール付与・削除
- グローバルな設定変更

#### サークル管理者（publisher_admin）

- 自分のサークルの商品・在庫管理
- 自分のサークルのメンバーにロール付与（publisher_admin / publisher_sales）
- サークル情報の編集

#### 販売担当（publisher_sales）

- 自分のサークルの商品の販売
- 在庫確認（読み取り専用）

#### イベント管理者（event_admin）

- 自分のイベントの管理
- 自分のイベントのメンバーにロール付与（event_admin / event_sales）

#### イベント販売担当（event_sales）

- 自分のイベントの販売業務

## 未実装項目

### 1. フロントエンド実装

管理画面（`frontend/apps/mizpos-admin`）にロール管理UIを追加する必要があります:

#### 必要なコンポーネント

1. **ロール管理モーダル**
   - ユーザーにロールを付与するUI
   - サークル/イベント選択
   - ロールタイプ選択（system_admin, publisher_admin, publisher_sales など）

2. **ロール一覧表示**
   - ユーザー詳細画面にロール一覧を表示
   - サークル詳細画面にメンバーとロールを表示

3. **権限による表示制御**
   - システム管理者のみが見られる画面・機能の制御
   - サークル管理者が自分のサークルのみ管理できる制御

#### 実装の流れ

1. API型定義の更新
   ```bash
   # OpenAPI型定義を再生成
   pnpm run generate:api
   ```

2. ロール管理コンポーネントの作成
   ```
   frontend/apps/mizpos-admin/src/components/RoleManagement.tsx
   ```

3. ユーザー管理画面の更新
   ```
   frontend/apps/mizpos-admin/src/routes/users.tsx
   ```
   - ユーザー詳細にロール一覧を表示
   - ロール付与ボタンとモーダルを追加

4. サークル管理画面の更新
   ```
   frontend/apps/mizpos-admin/src/routes/publishers.tsx
   ```
   - サークルのメンバーとロール一覧を表示
   - ロール管理UI を追加

5. 権限チェックの実装
   ```
   frontend/apps/mizpos-admin/src/lib/permissions.ts
   ```
   - ユーザーのロール情報を取得
   - 画面・機能の表示制御

### 2. テストと動作確認

#### テスト項目

1. **DynamoDB GSI の動作確認**
   - Terraform apply で GSI が正しく作成されるか
   - PublisherIndex でクエリができるか

2. **APIエンドポイントのテスト**
   - ロール付与・削除が正しく動作するか
   - 権限チェックが正しく機能するか
   - エラーハンドリングが適切か

3. **権限体系のテスト**
   - システム管理者がすべての操作を実行できるか
   - サークル管理者が自分のサークルのみ管理できるか
   - 販売担当が適切な権限を持つか

4. **フロントエンドの動作確認**
   - ロール管理UIが正しく表示されるか
   - ロール付与・削除が正しく動作するか
   - 権限による表示制御が機能するか

## デプロイ手順

### 1. Terraformの適用

```bash
cd terraform/tf-dev  # または tf-prod
terraform plan
terraform apply
```

### 2. Lambda関数のデプロイ

```bash
cd lambda/accounts
# 依存関係のインストール
pip install -r requirements.txt

# デプロイ（既存のデプロイスクリプトを使用）
make deploy-accounts
```

### 3. フロントエンドのデプロイ

```bash
cd frontend
pnpm install
pnpm run build
pnpm run deploy
```

## 今後の拡張

### セキュリティ強化

1. **監査ログ**
   - ロール変更の履歴を記録
   - 誰がいつどのロールを付与/削除したかを追跡

2. **ロール有効期限**
   - 期間限定のロールを設定可能にする
   - 自動的に期限切れのロールを削除

3. **多要素認証（MFA）**
   - システム管理者には MFA を必須にする

### 機能拡張

1. **カスタムロール**
   - 固定のロールタイプ以外にカスタムロールを定義可能にする
   - きめ細かい権限設定

2. **グループ管理**
   - ユーザーグループを作成
   - グループに一括でロールを付与

3. **ロールテンプレート**
   - よく使うロールの組み合わせをテンプレート化
   - 新規メンバー追加時に簡単にロール付与

## 参考情報

### ロール管理のベストプラクティス

1. **最小権限の原則**
   - ユーザーには必要最小限の権限のみを付与
   - 定期的に権限を見直し

2. **職務分離**
   - 重要な操作は複数の権限を要求
   - システム管理者でも一部の操作は制限

3. **監査とレビュー**
   - ロール変更のログを定期的にレビュー
   - 不審な権限変更を検出

### トラブルシューティング

#### ロールが表示されない

- DynamoDB GSI が正しく作成されているか確認
- Lambda関数の環境変数（ROLES_TABLE）が正しいか確認

#### 権限エラーが発生する

- ユーザーに適切なロールが付与されているか確認
- ロールのスコープ（publisher_id, event_id）が正しいか確認

#### API呼び出しエラー

- JWT トークンが有効か確認
- API Gateway のロギングを有効にして詳細を確認
