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
