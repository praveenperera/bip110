# BIP-110

> # ⚠️ DEPRECATED ⚠️
>
> **This repository is deprecated.**
>
> **The content on [bip110.org](https://bip110.org) is no longer controlled by
> this repository.** Changes made here have no effect on the live site.

Website for BIP-110: Protecting Bitcoin's Purpose

## Development

```bash
cd web
npm install
npm run dev
```

The development command compiles ReScript before Astro starts and recompiles
through Astro's Vite watcher. Run all formatting, tests, and production-build
checks with:

```bash
cd web
npm run check
```

The project uses Astro for static pages, ReScript for application logic,
validation, state, request planning, and package-light React presentation, and
TypeScript for narrow runtime and package adapters. See the
[ReScript rewrite case study](https://github.com/praveenperera/research/blob/master/rescript-rewrite-evaluation/RESCRIPT_CASE_STUDY.md)
for the measured tradeoffs and architecture decision.

## Deploy

### Production

```bash
just deploy
```

### Preview

```bash
just preview
```

## GitHub Actions (Cloudflare Workers via Wrangler)

This repo deploys previews for every PR update and deploys production on pushes to `master`.
