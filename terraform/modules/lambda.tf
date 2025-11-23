# Lambda Functions

# Lambda Function - accounts
resource "aws_lambda_function" "accounts" {
  function_name = "${var.environment}-${var.project_name}-accounts"
  role          = aws_iam_role.lambda_accounts.arn
  handler       = "main.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  # デプロイパッケージのプレースホルダー
  # 実際のデプロイは別途CI/CDで行う
  filename         = "${path.module}/lambda_placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder.zip")

  environment {
    variables = {
      ENVIRONMENT               = var.environment
      USERS_TABLE               = aws_dynamodb_table.users.name
      ROLES_TABLE               = aws_dynamodb_table.roles.name
      POS_EMPLOYEES_TABLE       = aws_dynamodb_table.pos_employees.name
      POS_SESSIONS_TABLE        = aws_dynamodb_table.pos_sessions.name
      OFFLINE_SALES_QUEUE_TABLE = aws_dynamodb_table.offline_sales_queue.name
      SALES_TABLE               = aws_dynamodb_table.sales.name
      STOCK_TABLE               = aws_dynamodb_table.stock.name
      COUPONS_TABLE             = aws_dynamodb_table.coupons.name
      USER_POOL_ID              = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID         = aws_cognito_user_pool_client.main.id
      SES_SENDER_EMAIL          = var.ses_sender_email
      SES_CONFIGURATION_SET     = aws_ses_configuration_set.main.name
    }
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-accounts"
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

# CloudWatch Logs - accounts
resource "aws_cloudwatch_log_group" "accounts" {
  name              = "/aws/lambda/${aws_lambda_function.accounts.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-accounts-logs"
  }
}

# Lambda Function - stock
resource "aws_lambda_function" "stock" {
  function_name = "${var.environment}-${var.project_name}-stock"
  role          = aws_iam_role.lambda_stock.arn
  handler       = "main.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/lambda_placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder.zip")

  environment {
    variables = {
      ENVIRONMENT         = var.environment
      STOCK_TABLE         = aws_dynamodb_table.stock.name
      STOCK_HISTORY_TABLE = aws_dynamodb_table.stock_history.name
      USER_POOL_ID        = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID   = aws_cognito_user_pool_client.main.id
      CDN_BUCKET_NAME     = aws_s3_bucket.cdn_assets.id
      CDN_DOMAIN          = var.enable_custom_domain ? "cdn.${var.domain_name}" : aws_cloudfront_distribution.cdn_assets.domain_name
    }
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-stock"
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

# CloudWatch Logs - stock
resource "aws_cloudwatch_log_group" "stock" {
  name              = "/aws/lambda/${aws_lambda_function.stock.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-stock-logs"
  }
}

# Lambda Function - sales
resource "aws_lambda_function" "sales" {
  function_name = "${var.environment}-${var.project_name}-sales"
  role          = aws_iam_role.lambda_sales.arn
  handler       = "main.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 512

  filename         = "${path.module}/lambda_placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder.zip")

  environment {
    variables = {
      ENVIRONMENT           = var.environment
      SALES_TABLE           = aws_dynamodb_table.sales.name
      STOCK_TABLE           = aws_dynamodb_table.stock.name
      STOCK_HISTORY_TABLE   = aws_dynamodb_table.stock_history.name
      EVENTS_TABLE          = aws_dynamodb_table.events.name
      CONFIG_TABLE          = aws_dynamodb_table.config.name
      USERS_TABLE           = aws_dynamodb_table.users.name
      STRIPE_SECRET_ARN     = aws_secretsmanager_secret.stripe_api_key.arn
      USER_POOL_ID          = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID     = aws_cognito_user_pool_client.main.id
      SES_SENDER_EMAIL      = var.ses_sender_email
      SES_CONFIGURATION_SET = aws_ses_configuration_set.main.name
    }
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-sales"
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

# CloudWatch Logs - sales
resource "aws_cloudwatch_log_group" "sales" {
  name              = "/aws/lambda/${aws_lambda_function.sales.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-sales-logs"
  }
}

# Lambda Function - android-mgmt (Android Enterprise Management)
resource "aws_lambda_function" "android_mgmt" {
  function_name = "${var.environment}-${var.project_name}-enterprise-android-manager"
  role          = aws_iam_role.lambda_android_mgmt.arn
  handler       = "main.handler"
  runtime       = "python3.12"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/lambda_placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_placeholder.zip")

  environment {
    variables = {
      ENVIRONMENT                     = var.environment
      ENTERPRISES_TABLE_NAME          = aws_dynamodb_table.android_mgmt_enterprises.name
      POLICIES_TABLE_NAME             = aws_dynamodb_table.android_mgmt_policies.name
      DEVICES_TABLE_NAME              = aws_dynamodb_table.android_mgmt_devices.name
      USER_POOL_ID                    = aws_cognito_user_pool.main.id
      COGNITO_CLIENT_ID               = aws_cognito_user_pool_client.main.id
      GCP_SERVICE_ACCOUNT_SECRET_NAME = aws_secretsmanager_secret.gcp_service_account.name
    }
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-enterprise-android-manager"
  }

  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }
}

# CloudWatch Logs - android-mgmt
resource "aws_cloudwatch_log_group" "android_mgmt" {
  name              = "/aws/lambda/${aws_lambda_function.android_mgmt.function_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-enterprise-android-manager-logs"
  }
}
