# AWS Secrets Manager

# Stripe API Key
resource "aws_secretsmanager_secret" "stripe_api_key" {
  name        = "${var.environment}-${var.project_name}-stripe-api-key"
  description = "Stripe API key for payment processing"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-stripe-api-key"
  }
}

# Stripe API Key の初期値（プレースホルダー）
# 実際のキーは手動で設定する必要があります
resource "aws_secretsmanager_secret_version" "stripe_api_key" {
  secret_id = aws_secretsmanager_secret.stripe_api_key.id
  secret_string = jsonencode({
    api_key         = "PLACEHOLDER_STRIPE_API_KEY"
    publishable_key = "PLACEHOLDER_STRIPE_PUBLISHABLE_KEY"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Stripe Terminal Location ID
resource "aws_secretsmanager_secret" "stripe_terminal_config" {
  name        = "${var.environment}-${var.project_name}-stripe-terminal-config"
  description = "Stripe Terminal configuration for in-person payments"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-stripe-terminal-config"
  }
}

# Stripe Terminal Config の初期値（プレースホルダー）
resource "aws_secretsmanager_secret_version" "stripe_terminal_config" {
  secret_id = aws_secretsmanager_secret.stripe_terminal_config.id
  secret_string = jsonencode({
    location_id = "PLACEHOLDER_LOCATION_ID"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
