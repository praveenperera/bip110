# BIP-110

Website for BIP-110: Protecting Bitcoin's Purpose

**Live at:** [bip110.org](https://bip110.org)

## Development

```bash
cd web
npm install
npm run dev
```

## Deploy

Build and deploy to Cloudflare Pages:

```bash
cd web
npm run build
npx wrangler pages deploy dist --project-name bip110
```

Or using just:

```bash
just deploy
```
