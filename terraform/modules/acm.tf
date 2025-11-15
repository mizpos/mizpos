# ACM Certificate for API Gateway Custom Domain

# ACM証明書（ワイルドカード証明書）
resource "aws_acm_certificate" "api" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api-cert"
  }
}

# API Gateway用のカスタムドメイン（証明書検証後に有効化）
resource "aws_apigatewayv2_domain_name" "api" {
  count = var.enable_custom_domain ? 1 : 0

  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api-domain"
  }

  depends_on = [aws_acm_certificate.api]
}

# API Mappings
resource "aws_apigatewayv2_api_mapping" "api" {
  count = var.enable_custom_domain ? 1 : 0

  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.main.id
}
