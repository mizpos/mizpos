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

  global_secondary_index {
    name            = "EventIndex"
    hash_key        = "event_id"
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
