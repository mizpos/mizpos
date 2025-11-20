# Outputs for mizpos infrastructure

# Cognito Outputs
output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_user_pool_endpoint" {
  description = "Cognito User Pool Endpoint"
  value       = aws_cognito_user_pool.main.endpoint
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "cognito_domain" {
  description = "Cognito User Pool Domain"
  value       = aws_cognito_user_pool_domain.main.domain
}

# DynamoDB Outputs
output "dynamodb_users_table_name" {
  description = "DynamoDB Users Table Name"
  value       = aws_dynamodb_table.users.name
}

output "dynamodb_roles_table_name" {
  description = "DynamoDB Roles Table Name"
  value       = aws_dynamodb_table.roles.name
}

output "dynamodb_stock_table_name" {
  description = "DynamoDB Stock Table Name"
  value       = aws_dynamodb_table.stock.name
}

output "dynamodb_stock_history_table_name" {
  description = "DynamoDB Stock History Table Name"
  value       = aws_dynamodb_table.stock_history.name
}

output "dynamodb_sales_table_name" {
  description = "DynamoDB Sales Table Name"
  value       = aws_dynamodb_table.sales.name
}

output "dynamodb_events_table_name" {
  description = "DynamoDB Events Table Name"
  value       = aws_dynamodb_table.events.name
}

output "dynamodb_config_table_name" {
  description = "DynamoDB Config Table Name"
  value       = aws_dynamodb_table.config.name
}

output "dynamodb_publishers_table_name" {
  description = "DynamoDB Publishers Table Name"
  value       = aws_dynamodb_table.publishers.name
}

# Lambda Outputs
output "lambda_accounts_function_name" {
  description = "Lambda Accounts Function Name"
  value       = aws_lambda_function.accounts.function_name
}

output "lambda_accounts_arn" {
  description = "Lambda Accounts Function ARN"
  value       = aws_lambda_function.accounts.arn
}

output "lambda_stock_function_name" {
  description = "Lambda Stock Function Name"
  value       = aws_lambda_function.stock.function_name
}

output "lambda_stock_arn" {
  description = "Lambda Stock Function ARN"
  value       = aws_lambda_function.stock.arn
}

output "lambda_sales_function_name" {
  description = "Lambda Sales Function Name"
  value       = aws_lambda_function.sales.function_name
}

output "lambda_sales_arn" {
  description = "Lambda Sales Function ARN"
  value       = aws_lambda_function.sales.arn
}

# API Gateway Outputs
output "api_gateway_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_gateway_endpoint" {
  description = "API Gateway Endpoint"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_gateway_custom_domain" {
  description = "API Gateway Custom Domain"
  value       = var.enable_custom_domain ? aws_apigatewayv2_domain_name.api[0].domain_name : ""
}

output "api_gateway_domain_name_target" {
  description = "API Gateway Custom Domain Target for DNS"
  value       = var.enable_custom_domain ? aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name : ""
}

# Secrets Manager Outputs
output "stripe_secret_arn" {
  description = "Stripe API Key Secret ARN"
  value       = aws_secretsmanager_secret.stripe_api_key.arn
  sensitive   = true
}

# ACM Certificate Outputs
output "acm_certificate_arn" {
  description = "ACM Certificate ARN"
  value       = var.enable_custom_domain ? aws_acm_certificate.api[0].arn : ""
}

output "acm_certificate_domain_validation_options" {
  description = "ACM Certificate Domain Validation Options"
  value       = var.enable_custom_domain ? aws_acm_certificate.api[0].domain_validation_options : []
}

# Frontend Outputs (Multiple Apps)
output "frontend_apps" {
  description = "Frontend apps configuration map"
  value = {
    for app_key, app in local.frontend_apps_map : app_key => {
      s3_bucket_name             = aws_s3_bucket.frontend[app_key].id
      s3_bucket_arn              = aws_s3_bucket.frontend[app_key].arn
      cloudfront_distribution_id = aws_cloudfront_distribution.frontend[app_key].id
      cloudfront_domain_name     = aws_cloudfront_distribution.frontend[app_key].domain_name
      url                        = var.enable_custom_domain ? "https://${app.subdomain}.${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend[app_key].domain_name}"
      acm_certificate_arn        = aws_acm_certificate.frontend[app_key].arn
    }
  }
}

output "frontend_deploy_policy_arn" {
  description = "IAM Policy ARN for frontend deployment"
  value       = aws_iam_policy.frontend_deploy.arn
}

# CDN Outputs
output "cdn_bucket_name" {
  description = "CDN S3 Bucket Name"
  value       = aws_s3_bucket.cdn_assets.id
}

output "cdn_bucket_arn" {
  description = "CDN S3 Bucket ARN"
  value       = aws_s3_bucket.cdn_assets.arn
}

output "cdn_cloudfront_distribution_id" {
  description = "CDN CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.cdn_assets.id
}

output "cdn_domain" {
  description = "CDN CloudFront Domain"
  value       = var.enable_custom_domain ? "https://cdn.${var.domain_name}" : "https://${aws_cloudfront_distribution.cdn_assets.domain_name}"
}

# SES Outputs
output "ses_sender_email" {
  description = "SES sender email address"
  value       = aws_sesv2_email_identity.sender.email_identity
}

# Cloudflare Turnstile Outputs
output "turnstile_site_key" {
  description = "Cloudflare Turnstile site key for admin login"
  value       = cloudflare_turnstile_widget.admin_login.id
  sensitive   = false
}

output "turnstile_secret_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing Turnstile secret key"
  value       = aws_secretsmanager_secret.turnstile_secret_key.arn
  sensitive   = false
}
