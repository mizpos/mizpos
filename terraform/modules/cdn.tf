# S3 Bucket for CDN assets (book covers, images, etc.)

resource "aws_s3_bucket" "cdn_assets" {
  bucket = "${var.environment}-${var.project_name}-cdn-assets"

  tags = {
    Name = "${var.environment}-${var.project_name}-cdn-assets"
  }
}

# Block public access settings (CloudFront OAC will be used)
resource "aws_s3_bucket_public_access_block" "cdn_assets" {
  bucket = aws_s3_bucket.cdn_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket ownership controls
resource "aws_s3_bucket_ownership_controls" "cdn_assets" {
  bucket = aws_s3_bucket.cdn_assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# CORS configuration for S3 bucket
resource "aws_s3_bucket_cors_configuration" "cdn_assets" {
  bucket = aws_s3_bucket.cdn_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Lifecycle configuration for app builds (delete non-latest files after 30 days)
# Note: "latest" files are tagged with keep=true and excluded from expiration.
# Timestamped files are not tagged and will be deleted after 30 days.
resource "aws_s3_bucket_lifecycle_configuration" "cdn_assets" {
  bucket = aws_s3_bucket.cdn_assets.id

  # Rule for Android builds - delete timestamped files after 30 days (files without keep=true tag)
  rule {
    id     = "expire-old-android-builds"
    status = "Enabled"

    filter {
      and {
        prefix = "android/"
        tags = {
          keep = "false"
        }
      }
    }

    expiration {
      days = 30
    }
  }

  # Rule for Desktop builds - delete timestamped files after 30 days (files without keep=true tag)
  rule {
    id     = "expire-old-desktop-builds"
    status = "Enabled"

    filter {
      and {
        prefix = "desktop/"
        tags = {
          keep = "false"
        }
      }
    }

    expiration {
      days = 30
    }
  }
}

# CloudFront Origin Access Control
resource "aws_cloudfront_origin_access_control" "cdn_assets" {
  name                              = "${var.environment}-${var.project_name}-cdn-oac"
  description                       = "OAC for ${var.environment} CDN assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Route53 Hosted Zone (data source)
data "aws_route53_zone" "cdn" {
  count = var.enable_custom_domain ? 1 : 0
  name  = var.domain_name
}

# ACM Certificate for CloudFront (must be in us-east-1)
resource "aws_acm_certificate" "cdn" {
  count    = var.enable_custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name       = "cdn.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-cdn-cert"
  }
}

# DNS validation records for CDN certificate
resource "aws_route53_record" "cdn_cert_validation" {
  for_each = var.enable_custom_domain ? {
    for dvo in aws_acm_certificate.cdn[0].domain_validation_options : dvo.domain_name => {
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
resource "aws_acm_certificate_validation" "cdn" {
  count    = var.enable_custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.cdn[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cdn_cert_validation : record.fqdn]
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn_assets" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = ""
  comment             = "${var.environment} CDN for mizpos assets"
  price_class         = "PriceClass_200" # Use only Asia, Europe, North America

  # Custom domain alias (if enabled)
  aliases = var.enable_custom_domain ? ["cdn.${var.domain_name}"] : []

  origin {
    domain_name              = aws_s3_bucket.cdn_assets.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.cdn_assets.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.cdn_assets.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.cdn_assets.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400    # 1 day
    max_ttl                = 31536000 # 1 year
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Use custom certificate if enabled, otherwise use CloudFront default
  dynamic "viewer_certificate" {
    for_each = var.enable_custom_domain ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate_validation.cdn[0].certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }

  dynamic "viewer_certificate" {
    for_each = var.enable_custom_domain ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }

  tags = {
    Name = "${var.environment}-${var.project_name}-cdn"
  }
}

# Route53 A record for CDN (Alias to CloudFront)
resource "aws_route53_record" "cdn" {
  count = var.enable_custom_domain ? 1 : 0

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "cdn.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn_assets.domain_name
    zone_id                = aws_cloudfront_distribution.cdn_assets.hosted_zone_id
    evaluate_target_health = false
  }
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cdn_assets" {
  bucket = aws_s3_bucket.cdn_assets.id

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
        Resource = "${aws_s3_bucket.cdn_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn_assets.arn
          }
        }
      }
    ]
  })
}

# Desktop App Deploy Policy (GitHub Actions用)
resource "aws_iam_policy" "desktop_app_deploy" {
  name        = "${var.project_name}-${var.environment}-desktop-app-deploy"
  description = "Policy for deploying desktop app binaries to CDN S3 and invalidating CloudFront cache"

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
          "s3:ListBucket",
          "s3:CopyObject"
        ]
        Resource = [
          aws_s3_bucket.cdn_assets.arn,
          "${aws_s3_bucket.cdn_assets.arn}/*"
        ]
      },
      {
        Sid    = "CloudFrontInvalidation"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations"
        ]
        Resource = [aws_cloudfront_distribution.cdn_assets.arn]
      }
    ]
  })
}
