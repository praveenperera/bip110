terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# Redirect www.bip110.org → bip110.org
resource "cloudflare_ruleset" "bip110_org_redirects" {
  zone_id     = var.bip110_org_zone_id
  name        = "Redirect rules"
  description = "Redirect www to apex"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules {
    action = "redirect"
    action_parameters {
      from_value {
        status_code = 301
        target_url {
          expression = "concat(\"https://bip110.org\", http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
    expression  = "(http.host eq \"www.bip110.org\")"
    description = "Redirect www.bip110.org to bip110.org"
    enabled     = true
  }
}

# Redirect bip-110.com and www.bip-110.com → bip110.org
resource "cloudflare_ruleset" "bip_110_com_redirects" {
  zone_id     = var.bip_110_com_zone_id
  name        = "Redirect rules"
  description = "Redirect to bip110.org"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules {
    action = "redirect"
    action_parameters {
      from_value {
        status_code = 301
        target_url {
          expression = "concat(\"https://bip110.org\", http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
    expression  = "(http.host eq \"bip-110.com\") or (http.host eq \"www.bip-110.com\")"
    description = "Redirect bip-110.com to bip110.org"
    enabled     = true
  }
}
