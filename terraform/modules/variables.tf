# Variables for mizpos infrastructure

variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "mizpos"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-1"
}

variable "domain_name" {
  description = "Base domain name for the API"
  type        = string
  # GitHub secretから渡される想定
  # dev: *.stg-pos.miz.cab
  # prod: *.pos.miz.cab
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  # GitHub secretから渡される想定
}

variable "enable_custom_domain" {
  description = "Enable custom domain (requires validated ACM certificate)"
  type        = bool
  default     = false
}

variable "frontend_apps" {
  description = "List of frontend applications to deploy"
  type = list(object({
    name      = string
    subdomain = string
  }))
  default = [
    {
      name      = "mizpos-admin"
      subdomain = "admin"
    },
    {
      name      = "mizpos-online-sales"
      subdomain = "sales"
    }
  ]
}
