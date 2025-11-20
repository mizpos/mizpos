terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.21.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "mizphses-opensource-mizpos-dev"
    key          = "mizpos/dev/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      CostTag     = "mizpos-dev"
      Environment = "dev"
    }
  }
}

# CloudFront用ACM証明書にはus-east-1が必須
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      CostTag     = "mizpos-dev"
      Environment = "dev"
    }
  }
}

# Cloudflare provider
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

module "mizpos_infrastructure" {
  source = "../modules"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
    cloudflare    = cloudflare
  }

  environment  = "dev"
  project_name = "mizpos"
  aws_region   = "ap-northeast-1"

  # GitHub Secretsから渡される想定
  domain_name          = var.domain_name
  frontend_url         = var.frontend_url
  enable_custom_domain = var.enable_custom_domain

  # Cloudflare Turnstile Settings
  cloudflare_account_id = var.cloudflare_account_id
  cloudflare_api_token  = var.cloudflare_api_token
}