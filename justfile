# development server
dev:
    cd web && npm run dev -- --open

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

# local preview with wrangler dev
preview: build
    cd web && npx --yes wrangler dev

# initialize terraform
tf-init:
    cd terraform && terraform init

# plan terraform changes
tf-plan:
    cd terraform && terraform plan

# apply terraform changes
tf-apply:
    cd terraform && terraform apply
