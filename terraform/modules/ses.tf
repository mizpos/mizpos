# SES Email Configuration

# SES Email Identity (ドメインまたはメールアドレス)
# Note: 本番環境では実際のドメインを使用してください
resource "aws_ses_email_identity" "sender" {
  email = var.ses_sender_email
}

# SES Configuration Set (メール送信の追跡用)
resource "aws_ses_configuration_set" "main" {
  name = "${var.environment}-mizpos-emails"

  delivery_options {
    tls_policy = "Require"
  }

  reputation_metrics_enabled = true
  sending_enabled            = true
}

# SES Event Destination (CloudWatch Logs)
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "cloudwatch-destination"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true
  matching_types         = ["send", "reject", "bounce", "complaint", "delivery", "open", "click"]

  cloudwatch_destination {
    default_value  = "default"
    dimension_name = "ses:configuration-set"
    value_source   = "messageTag"
  }
}
