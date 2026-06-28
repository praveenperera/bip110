# development server
dev: dev-stop
    cd web && npm run dev -- --host --open

# stop any existing astro development server
[private]
dev-stop:
    cd web && npm run astro -- dev stop

# build the site
build: install
    cd web && npm run build

# install dependencies
install:
    cd web && npm install

# update all dependencies
update:
    cd web && npm update

# deploy to cloudflare workers
deploy: build
    cd web && npx --yes wrangler deploy

# deploy preview to cloudflare workers (optional: just preview <subdomain>)
preview subdomain="": build
    #!/usr/bin/env bash
    name="{{ subdomain }}"
    if [ -z "$name" ]; then
        name=$(git branch --show-current | tr '/' '-' | tr '[:upper:]' '[:lower:]')
    fi
    cd web && npx --yes wrangler versions upload --preview-alias "$name"

# initialize terraform
tf-init:
    cd terraform && terraform init

# plan terraform changes
tf-plan:
    cd terraform && terraform plan

# apply terraform changes
tf-apply:
    cd terraform && terraform apply

# ------------------------------------------------------------------------------
# nostr
# ------------------------------------------------------------------------------

# add a NIP-05 nostr identity (usage: just nostr <username> <npub>)
[group('nostr')]
nostr username npub:
    bun run scripts/nostr-add.ts {{ username }} {{ npub }}

# ------------------------------------------------------------------------------
# format
# ------------------------------------------------------------------------------

# format all code
[group('format')]
@fmt:
    just fmt-web && just fmt-tf

# format web code
[group('format'), private]
[working-directory: 'web']
fmt-web:
    npx prettier --write .

# format terraform code
[group('format'), private]
[working-directory: 'terraform']
fmt-tf:
    terraform fmt
