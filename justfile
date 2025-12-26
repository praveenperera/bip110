# development server
dev:
    cd web && npm run dev

# build the site
build:
    cd web && npm run build

# deploy to cloudflare pages
deploy: build
    cd web && npx wrangler pages deploy dist --project-name bip110
