# Outputs from the module

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.mizpos_infrastructure.cognito_user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.mizpos_infrastructure.cognito_user_pool_client_id
}

output "api_gateway_endpoint" {
  description = "API Gateway Endpoint"
  value       = module.mizpos_infrastructure.api_gateway_endpoint
}

output "api_gateway_custom_domain" {
  description = "API Gateway Custom Domain"
  value       = module.mizpos_infrastructure.api_gateway_custom_domain
}

output "api_gateway_domain_name_target" {
  description = "API Gateway Custom Domain Target for DNS"
  value       = module.mizpos_infrastructure.api_gateway_domain_name_target
}

output "frontend_apps" {
  description = "Frontend apps configuration (S3 bucket, CloudFront distribution, etc.)"
  value       = module.mizpos_infrastructure.frontend_apps
}

output "dynamodb_users_table_name" {
  description = "DynamoDB Users Table Name"
  value       = module.mizpos_infrastructure.dynamodb_users_table_name
}

output "dynamodb_roles_table_name" {
  description = "DynamoDB Roles Table Name"
  value       = module.mizpos_infrastructure.dynamodb_roles_table_name
}

output "dynamodb_stock_table_name" {
  description = "DynamoDB Stock Table Name"
  value       = module.mizpos_infrastructure.dynamodb_stock_table_name
}

output "dynamodb_stock_history_table_name" {
  description = "DynamoDB Stock History Table Name"
  value       = module.mizpos_infrastructure.dynamodb_stock_history_table_name
}

output "dynamodb_sales_table_name" {
  description = "DynamoDB Sales Table Name"
  value       = module.mizpos_infrastructure.dynamodb_sales_table_name
}

output "dynamodb_events_table_name" {
  description = "DynamoDB Events Table Name"
  value       = module.mizpos_infrastructure.dynamodb_events_table_name
}

output "dynamodb_config_table_name" {
  description = "DynamoDB Config Table Name"
  value       = module.mizpos_infrastructure.dynamodb_config_table_name
}

output "dynamodb_publishers_table_name" {
  description = "DynamoDB Publishers Table Name"
  value       = module.mizpos_infrastructure.dynamodb_publishers_table_name
}

output "cdn_bucket_name" {
  description = "CDN S3 Bucket Name"
  value       = module.mizpos_infrastructure.cdn_bucket_name
}

output "cdn_domain" {
  description = "CDN CloudFront Domain"
  value       = module.mizpos_infrastructure.cdn_domain
}
