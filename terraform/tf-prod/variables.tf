# Variables for prod environment

variable "domain_name" {
  description = "Domain name for the API (e.g., pos.miz.cab)"
  type        = string
  # GitHub Actionsから環境変数として渡される
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  # GitHub Actionsから環境変数として渡される
}
