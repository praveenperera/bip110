variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone.Page Rules and Zone.Zone permissions"
  type        = string
  sensitive   = true
}

variable "bip110_org_zone_id" {
  description = "Zone ID for bip110.org"
  type        = string
}

variable "bip_110_com_zone_id" {
  description = "Zone ID for bip-110.com"
  type        = string
}
