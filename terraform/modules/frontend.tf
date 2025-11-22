# Frontend Static Hosting Infrastructure
# S3 + CloudFront for React SPA (Multiple Apps)

locals {
  frontend_apps_map = { for app in var.frontend_apps : app.name => app }

  # ドメイン名を計算（subdomainが空の場合はルートドメイン）
  frontend_domain_names = {
    for app_key, app in local.frontend_apps_map :
    app_key => app.subdomain == "" ? var.domain_name : "${app.subdomain}.${var.domain_name}"
  }
}

# CloudFront用のACM証明書（us-east-1リージョンが必須）
resource "aws_acm_certificate" "frontend" {
  for_each = local.frontend_apps_map
  provider = aws.us_east_1

  domain_name       = local.frontend_domain_names[each.key]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-${each.key}-cert"
  }
}

# S3バケット（フロントエンド静的ファイル用）
resource "aws_s3_bucket" "frontend" {
  for_each = local.frontend_apps_map
  bucket   = "${var.project_name}-${var.environment}-${each.key}"

  tags = {
    Name = "${var.environment}-${var.project_name}-${each.key}"
  }
}

resource "aws_s3_bucket_versioning" "frontend" {
  for_each = local.frontend_apps_map
  bucket   = aws_s3_bucket.frontend[each.key].id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  for_each = local.frontend_apps_map
  bucket   = aws_s3_bucket.frontend[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "frontend" {
  for_each = local.frontend_apps_map

  name                              = "${var.project_name}-${var.environment}-${each.key}-oac"
  description                       = "OAC for ${var.project_name} ${each.key}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# S3バケットポリシー（CloudFrontからのアクセスのみ許可）
resource "aws_s3_bucket_policy" "frontend" {
  for_each = local.frontend_apps_map
  bucket   = aws_s3_bucket.frontend[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend[each.key].arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend[each.key].arn
          }
        }
      }
    ]
  })
}

# CloudFrontディストリビューション
resource "aws_cloudfront_distribution" "frontend" {
  for_each = local.frontend_apps_map

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  comment             = "${var.project_name} ${var.environment} ${each.key}"
  price_class         = "PriceClass_200" # アジア・北米・ヨーロッパ

  aliases = var.enable_custom_domain ? [local.frontend_domain_names[each.key]] : []

  origin {
    domain_name              = aws_s3_bucket.frontend[each.key].bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.frontend[each.key].id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend[each.key].id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend[each.key].id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1日
    max_ttl                = 31536000 # 1年
    compress               = true
  }

  # SPAルーティング用：404を index.html にリダイレクト
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.enable_custom_domain ? false : true
    acm_certificate_arn            = var.enable_custom_domain ? aws_acm_certificate_validation.frontend[each.key].certificate_arn : null
    ssl_support_method             = var.enable_custom_domain ? "sni-only" : null
    minimum_protocol_version       = var.enable_custom_domain ? "TLSv1.2_2021" : null
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-${each.key}-cdn"
  }
}

# CloudFrontキャッシュ無効化用のIAMポリシー（GitHub Actions用）
resource "aws_iam_policy" "frontend_deploy" {
  name        = "${var.project_name}-${var.environment}-frontend-deploy"
  description = "Policy for deploying frontend to S3 and invalidating CloudFront cache"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = flatten([
          for app in local.frontend_apps_map : [
            aws_s3_bucket.frontend[app.name].arn,
            "${aws_s3_bucket.frontend[app.name].arn}/*"
          ]
        ])
      },
      {
        Sid    = "CloudFrontInvalidation"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations"
        ]
        Resource = [for app in local.frontend_apps_map : aws_cloudfront_distribution.frontend[app.name].arn]
      }
    ]
  })
}

# DNS validation records for Frontend certificate
resource "aws_route53_record" "frontend_cert_validation" {
  for_each = var.enable_custom_domain ? merge([
    for app_key, app in local.frontend_apps_map : {
      for dvo in aws_acm_certificate.frontend[app_key].domain_validation_options : "${app_key}-${dvo.domain_name}" => {
        app_key = app_key
        name    = dvo.resource_record_name
        record  = dvo.resource_record_value
        type    = dvo.resource_record_type
      }
    }
  ]...) : {}

  provider = aws.us_east_1

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main[0].zone_id
}

# Certificate validation for Frontend
resource "aws_acm_certificate_validation" "frontend" {
  for_each = var.enable_custom_domain ? local.frontend_apps_map : {}
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.frontend[each.key].arn
  validation_record_fqdns = [
    for k, v in aws_route53_record.frontend_cert_validation : v.fqdn
    if startswith(k, "${each.key}-")
  ]
}

# Route53 A record for CloudFront
resource "aws_route53_record" "frontend" {
  for_each = var.enable_custom_domain ? local.frontend_apps_map : {}

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = local.frontend_domain_names[each.key]
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend[each.key].domain_name
    zone_id                = aws_cloudfront_distribution.frontend[each.key].hosted_zone_id
    evaluate_target_health = false
  }
}
