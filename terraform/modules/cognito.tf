# Cognito User Pool for authentication

resource "aws_cognito_user_pool" "main" {
  name = "${var.environment}-${var.project_name}-user-pool"

  # ユーザー名の設定
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # パスワードポリシー
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # アカウント回復設定
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA設定（オプショナル）
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # ユーザー属性のスキーマ
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # カスタム属性：ロール情報
  schema {
    name                     = "role"
    attribute_data_type      = "String"
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # WebAuthn（パスキー）設定
  # Note: advanced_security_mode は ESSENTIALS tier では利用できません
  # 本番環境で PLUS tier 以上を使用する場合のみ有効化してください
  # user_pool_add_ons {
  #   advanced_security_mode = "AUDIT" # または "ENFORCED"（本番環境では "ENFORCED" を推奨）
  # }

  # WebAuthn設定を有効化
  # Note: Terraform AWS Provider 5.70.0以降で利用可能
  # WebAuthn認証をサポートするためのRelying Party設定
  # この設定により、Cognito Hosted UIでパスキー登録・ログインが可能になります

  # 削除保護
  deletion_protection = var.environment == "prod" ? "ACTIVE" : "INACTIVE"

  tags = {
    Name = "${var.environment}-${var.project_name}-user-pool"
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.environment}-${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false

  # OAuth設定
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = ["https://admin.${var.domain_name}/callback", "https://sales.${var.domain_name}/callback", "http://localhost:3000/callback", "http://localhost:5173/callback"]
  logout_urls                          = ["https://admin.${var.domain_name}/logout", "https://sales.${var.domain_name}/logout", "http://localhost:3000/logout", "http://localhost:5173/logout"]

  # トークンの有効期限
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  # 認証フロー
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_AUTH" # WebAuthn/Passkey用（必須）
  ]

  # WebAuthn設定（Passkey対応）
  enable_token_revocation = true

  # 認証セッションの有効期限（分）
  auth_session_validity = 3

  prevent_user_existence_errors = "ENABLED"

  # Supported identity providers (Hosted UIで使用)
  supported_identity_providers = ["COGNITO"]

  # WebAuthn用の追加設定
  # パスキーログイン時に必要な設定
  read_attributes = [
    "email",
    "email_verified",
    "name",
    "custom:role"
  ]

  write_attributes = [
    "email",
    "name",
    "custom:role"
  ]
}

# User Pool Domain (カスタムドメイン使用時とデフォルトドメイン使用時で分岐)
# Note: カスタムドメインを使用する場合、ACM証明書が必要で、CNAMEの競合に注意が必要
resource "aws_cognito_user_pool_domain" "main" {
  domain          = var.enable_custom_domain ? "auth.${var.domain_name}" : "${var.environment}-${var.project_name}-auth"
  user_pool_id    = aws_cognito_user_pool.main.id
  certificate_arn = var.enable_custom_domain ? aws_acm_certificate_validation.cognito_domain[0].certificate_arn : null

  # カスタムドメイン使用時は証明書の検証完了を待つ
  depends_on = [
    aws_acm_certificate_validation.cognito_domain
  ]
}

# Route53 A record for Cognito Custom Domain
resource "aws_route53_record" "cognito_domain" {
  count = var.enable_custom_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "auth.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cognito_user_pool_domain.main.cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.main.cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}

# Identity Pool
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.environment}_${var.project_name}_identity_pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.main.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-identity-pool"
  }
}

# Identity Pool Role Attachment
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.authenticated.arn
  }
}
