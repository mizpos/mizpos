# ACM Certificate for API Gateway Custom Domain

# ACM証明書（サブドメイン用）
resource "aws_acm_certificate" "api" {
  count             = var.enable_custom_domain ? 1 : 0
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api-cert"
  }
}

# Route53 Hosted Zone (data source)
data "aws_route53_zone" "main" {
  count = var.enable_custom_domain ? 1 : 0
  name  = var.domain_name
}

# DNS validation records for API certificate
resource "aws_route53_record" "api_cert_validation" {
  for_each = var.enable_custom_domain ? {
    for dvo in aws_acm_certificate.api[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# Certificate validation
resource "aws_acm_certificate_validation" "api" {
  count = var.enable_custom_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.api[0].arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# API Gateway用のカスタムドメイン（証明書検証後に有効化）
resource "aws_apigatewayv2_domain_name" "api" {
  count = var.enable_custom_domain ? 1 : 0

  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.api[0].certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-api-domain"
  }
}

# Route53 A record for API Gateway
resource "aws_route53_record" "api" {
  count = var.enable_custom_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "api.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# API Mappings
resource "aws_apigatewayv2_api_mapping" "api" {
  count = var.enable_custom_domain ? 1 : 0

  api_id      = aws_apigatewayv2_api.main.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.main.id
}
