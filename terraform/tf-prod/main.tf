terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.21.0"
    }
  }

  backend "s3" {
    bucket       = "mizphses-opensource-mizpos-prod"
    key          = "mizpos/prod/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = "ap-northeast-1"

  default_tags {
    tags = {
      CostTag     = "mizpos-prod"
      Environment = "prod"
    }
  }
}

module "mizpos_infrastructure" {
  source = "../modules"

  environment  = "prod"
  project_name = "mizpos"
  aws_region   = "ap-northeast-1"

  # GitHub Secretsから渡される想定
  domain_name          = var.domain_name
  frontend_url         = var.frontend_url
  enable_custom_domain = var.enable_custom_domain
}