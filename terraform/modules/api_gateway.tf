# API Gateway HTTP API

# HTTP API
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.environment}-${var.project_name}-api"
  protocol_type = "HTTP"
  description   = "mizpos API Gateway for ${var.environment} environment"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization", "x-pos-session"]
    max_age       = 300
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api"
  }
}

# API Gateway Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api-stage"
  }
}

# CloudWatch Logs for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.environment}-${var.project_name}"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = {
    Name = "${var.environment}-${var.project_name}-api-logs"
  }
}

# Cognito Authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.environment}-cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

# Lambda Integration - accounts
resource "aws_apigatewayv2_integration" "accounts" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.accounts.invoke_arn
  payload_format_version = "2.0"
}

# Lambda Integration - stock
resource "aws_apigatewayv2_integration" "stock" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.stock.invoke_arn
  payload_format_version = "2.0"
}

# Lambda Integration - sales
resource "aws_apigatewayv2_integration" "sales" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.sales.invoke_arn
  payload_format_version = "2.0"
}

# Lambda Integration - pos
resource "aws_apigatewayv2_integration" "pos" {
  api_id           = aws_apigatewayv2_api.main.id
  integration_type = "AWS_PROXY"

  connection_type        = "INTERNET"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.pos.invoke_arn
  payload_format_version = "2.0"
}

# Routes - accounts (JWT validation handled by Lambda)
resource "aws_apigatewayv2_route" "accounts" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /accounts/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.accounts.id}"

  authorization_type = "NONE"
}

# Routes - stock (JWT validation handled by Lambda)
resource "aws_apigatewayv2_route" "stock" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /stock/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.stock.id}"

  authorization_type = "NONE"
}

# Routes - sales (JWT validation handled by Lambda)
resource "aws_apigatewayv2_route" "sales" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /sales/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.sales.id}"

  authorization_type = "NONE"
}

# Routes - pos (POS端末専用、認証はLambda内で処理)
resource "aws_apigatewayv2_route" "pos" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /pos/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.pos.id}"

  authorization_type = "NONE"
}

# OpenAPI Documentation Routes (public access)
resource "aws_apigatewayv2_route" "openapi_accounts" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /accounts/openapi.json"
  target    = "integrations/${aws_apigatewayv2_integration.accounts.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "docs_accounts" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /accounts/docs"
  target    = "integrations/${aws_apigatewayv2_integration.accounts.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "openapi_stock" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /stock/openapi.json"
  target    = "integrations/${aws_apigatewayv2_integration.stock.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "docs_stock" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /stock/docs"
  target    = "integrations/${aws_apigatewayv2_integration.stock.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "openapi_sales" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /sales/openapi.json"
  target    = "integrations/${aws_apigatewayv2_integration.sales.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "docs_sales" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /sales/docs"
  target    = "integrations/${aws_apigatewayv2_integration.sales.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "openapi_pos" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /pos/openapi.json"
  target    = "integrations/${aws_apigatewayv2_integration.pos.id}"

  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "docs_pos" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /pos/docs"
  target    = "integrations/${aws_apigatewayv2_integration.pos.id}"

  authorization_type = "NONE"
}

# Lambda Permissions
resource "aws_lambda_permission" "accounts" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.accounts.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "stock" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stock.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "sales" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sales.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "pos" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
