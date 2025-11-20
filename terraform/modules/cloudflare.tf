# Cloudflare Turnstile Widget Configuration

resource "cloudflare_turnstile_widget" "admin_login" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-${var.environment}-admin-login"
  domains    = [var.admin_domain]
  mode       = "managed" # managed, non-interactive, invisible から選択

  # 必要に応じてカスタマイズ
  # offlabel = false
  # region   = "world"
}

# Turnstile Secret KeyをAWS Secrets Managerに保存
resource "aws_secretsmanager_secret" "turnstile_secret_key" {
  name = "${var.project_name}-${var.environment}-turnstile-secret-key"

  tags = {
    Name        = "${var.project_name}-${var.environment}-turnstile-secret-key"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_secretsmanager_secret_version" "turnstile_secret_key" {
  secret_id     = aws_secretsmanager_secret.turnstile_secret_key.id
  secret_string = cloudflare_turnstile_widget.admin_login.secret
}
