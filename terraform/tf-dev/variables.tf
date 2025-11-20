# Variables for dev environment

variable "domain_name" {
  description = "Domain name for the API (e.g., pos-stg.miz.cab)"
  type        = string
  # GitHub Actionsから環境変数として渡される
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  # GitHub Actionsから環境変数として渡される
}

variable "enable_custom_domain" {
  description = "Enable custom domain (requires validated ACM certificate)"
  type        = bool
  default     = false
}

# Cloudflare Turnstile Settings
variable "cloudflare_account_id" {
  description = "Cloudflare Account ID for Turnstile"
  type        = string
  # GitHub Actionsから環境変数として渡される
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for Turnstile"
  type        = string
  # GitHub Actionsから環境変数として渡される
}
