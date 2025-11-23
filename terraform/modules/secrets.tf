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

# Note: Stripe Terminal configuration is now stored in DynamoDB config table
# instead of Secrets Manager to allow per-location/event configuration

# GCP Service Account for Android Management API
resource "aws_secretsmanager_secret" "google_service_account" {
  name        = "${var.environment}-${var.project_name}-gcp-service-account"
  description = "Google Cloud service account key for Android Management API"

  recovery_window_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-gcp-service-account"
  }
}

resource "aws_secretsmanager_secret_version" "google_service_account" {
  secret_id = aws_secretsmanager_secret.google_service_account.id
  secret_string = jsonencode({
    type                        = "service_account"
    project_id                  = "PLACEHOLDER_PROJECT_ID"
    private_key_id              = "PLACEHOLDER_KEY_ID"
    private_key                 = "PLACEHOLDER_PRIVATE_KEY"
    client_email                = "PLACEHOLDER_CLIENT_EMAIL"
    client_id                   = "PLACEHOLDER_CLIENT_ID"
    auth_uri                    = "https://accounts.google.com/o/oauth2/auth"
    token_uri                   = "https://oauth2.googleapis.com/token"
    auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
    client_x509_cert_url        = "PLACEHOLDER_CERT_URL"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
