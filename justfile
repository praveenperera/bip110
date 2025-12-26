# development server
dev:
    cd web && npm run dev

# build the site
build:
    cd web && npm run build

# deploy to cloudflare pages (production)
deploy: build
    cd web && npx wrangler pages deploy dist --project-name bip110

# deploy preview
preview: build
    cd web && npx wrangler pages deploy dist --project-name bip110 --branch preview
