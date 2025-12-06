# DynamoDB Tables for mizpos

# Users table - ユーザー情報とロールの紐付け
resource "aws_dynamodb_table" "users" {
  name         = "${var.environment}-mizpos-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailIndex"
    hash_key        = "email"
    projection_type = "ALL"
  }

  ttl {
    enabled        = false
    attribute_name = ""
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-users"
  }
}

# Roles table - ユーザーロール管理（管理者、販売担当など）
# サポートするロール:
#   - system_admin: システム全体の管理者
#   - publisher_admin: サークル管理者（特定のpublisher_id）
#   - publisher_sales: 販売担当（特定のpublisher_id）
#   - event_admin: イベント管理者（特定のevent_id）
#   - event_sales: イベント販売担当（特定のevent_id）
resource "aws_dynamodb_table" "roles" {
  name         = "${var.environment}-mizpos-roles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"
  range_key    = "role_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "role_id"
    type = "S"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "publisher_id"
    type = "S"
  }

  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "PublisherIndex"
    hash_key        = "publisher_id"
    range_key       = "user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-roles"
  }
}

# Stock table - 在庫情報
resource "aws_dynamodb_table" "stock" {
  name         = "${var.environment}-mizpos-stock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "product_id"

  attribute {
    name = "product_id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "CategoryIndex"
    hash_key        = "category"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-stock"
  }
}

# Stock history table - 在庫変動履歴
resource "aws_dynamodb_table" "stock_history" {
  name         = "${var.environment}-mizpos-stock-history"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "product_id"
  range_key    = "timestamp"

  attribute {
    name = "product_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-stock-history"
  }
}

# Sales table - 販売履歴
resource "aws_dynamodb_table" "sales" {
  name         = "${var.environment}-mizpos-sales"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sale_id"
  range_key    = "timestamp"

  attribute {
    name = "sale_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "N"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "user_id"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-sales"
  }
}

# Events table - イベント情報（対面販売時の在庫管理用）
resource "aws_dynamodb_table" "events" {
  name         = "${var.environment}-mizpos-events"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "event_id"

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "start_date"
    type = "N"
  }

  global_secondary_index {
    name            = "StartDateIndex"
    hash_key        = "start_date"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-events"
  }
}

# Config table - アプリケーション設定（Stripe Terminal等）
resource "aws_dynamodb_table" "config" {
  name         = "${var.environment}-mizpos-config"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "config_key"

  attribute {
    name = "config_key"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-config"
  }
}

# Publishers table - 出版社/サークル情報（委託販売設定含む）
resource "aws_dynamodb_table" "publishers" {
  name         = "${var.environment}-mizpos-publishers"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "publisher_id"

  attribute {
    name = "publisher_id"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-publishers"
  }
}

# POS Employees table - POS端末用従業員情報（簡易認証用）
# mizpos-desktop専用の従業員番号＋PINログイン
resource "aws_dynamodb_table" "pos_employees" {
  name         = "${var.environment}-mizpos-pos-employees"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "employee_number"

  attribute {
    name = "employee_number"
    type = "S"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  attribute {
    name = "publisher_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "PublisherIndex"
    hash_key        = "publisher_id"
    projection_type = "ALL"
  }

  # mizposアカウントとの紐付け用
  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-pos-employees"
  }
}

# POS Sessions table - POS端末セッション管理
# オフライン対応のため、セッション情報を保持
resource "aws_dynamodb_table" "pos_sessions" {
  name         = "${var.environment}-mizpos-pos-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "employee_number"
    type = "S"
  }

  global_secondary_index {
    name            = "EmployeeIndex"
    hash_key        = "employee_number"
    projection_type = "ALL"
  }

  ttl {
    enabled        = true
    attribute_name = "expires_at"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-pos-sessions"
  }
}

# Offline Sales Queue table - オフライン販売キュー
# オフライン時の販売データを一時保存し、オンライン時に同期
resource "aws_dynamodb_table" "offline_sales_queue" {
  name         = "${var.environment}-mizpos-offline-sales-queue"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "queue_id"
  range_key    = "created_at"

  attribute {
    name = "queue_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  attribute {
    name = "terminal_id"
    type = "S"
  }

  attribute {
    name = "sync_status"
    type = "S"
  }

  global_secondary_index {
    name            = "TerminalIndex"
    hash_key        = "terminal_id"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "SyncStatusIndex"
    hash_key        = "sync_status"
    range_key       = "created_at"
    projection_type = "ALL"
  }

  ttl {
    enabled        = true
    attribute_name = "expires_at"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-offline-sales-queue"
  }
}

# Terminals table - POS端末管理（Ed25519公開鍵登録）
# mizpos-desktop端末の登録・認証用
resource "aws_dynamodb_table" "terminals" {
  name         = "${var.environment}-mizpos-terminals"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "terminal_id"

  attribute {
    name = "terminal_id"
    type = "S"
  }

  attribute {
    name = "name"
    type = "S"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  # 端末名での検索用
  global_secondary_index {
    name            = "NameIndex"
    hash_key        = "name"
    projection_type = "ALL"
  }

  # イベント別端末一覧取得用
  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-terminals"
  }
}

# Coupons table - クーポン管理
# クーポンタイプ:
#   - fixed: 固定金額割引（例: ¥500引き）- 売上計算上マイナス円の商品として扱う
#   - percentage: 割引率（例: 10%引き）
# スコープ:
#   - publisher_id指定あり: そのサークルの商品にのみ適用
#   - publisher_id指定なし: 全商品に適用可能
resource "aws_dynamodb_table" "coupons" {
  name         = "${var.environment}-mizpos-coupons"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "coupon_id"

  attribute {
    name = "coupon_id"
    type = "S"
  }

  attribute {
    name = "code"
    type = "S"
  }

  attribute {
    name = "publisher_id"
    type = "S"
  }

  attribute {
    name = "event_id"
    type = "S"
  }

  # クーポンコードでの検索用（ユニークコード入力時）
  global_secondary_index {
    name            = "CodeIndex"
    hash_key        = "code"
    projection_type = "ALL"
  }

  # サークル別クーポン一覧取得用
  global_secondary_index {
    name            = "PublisherIndex"
    hash_key        = "publisher_id"
    projection_type = "ALL"
  }

  # イベント別クーポン一覧取得用
  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.environment}-mizpos-coupons"
  }
}
