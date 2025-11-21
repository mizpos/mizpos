# Example Terraform variables for prod environment
# Copy this file to terraform.tfvars and fill in the actual values
# DO NOT commit terraform.tfvars to git

domain_name  = "pos.miz.cab"
frontend_url = "https://app.pos.miz.cab"
# 一時的にデフォルトドメインを使用（CNAME競合回避のため）
# CloudFrontの削除が完了したら true に戻す
enable_custom_domain = true
