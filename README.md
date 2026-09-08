# pbnb.store

Custom storefront for **PB&B**, built on Astro with Shopify as the commerce backend.
Deploys to Cloudflare Pages.

## Status

The site is built and running. **Shopify is not yet connected** — there are no
credentials, so the catalogue currently renders from design-derived fixtures. See
[`DECISIONS.md`](./DECISIONS.md) §16 for exactly which tokens to generate and where.

## Stack

| | |
|---|---|
| Framework | Astro 7 (`output: 'server'`, per-page prerendering) |
| Host | Cloudflare Pages / Workers |
| Commerce | Shopify Storefront API `2026-07` (reads + cart), Admin API (one-time seed) |
| Checkout | Shopify hosted, via `cart.checkoutUrl` |
| Client JS | Two small inline scripts. No framework, no webfonts, no scroll library. |

## Run it

```bash
npm install
npm run dev              # http://localhost:4321
npm run build
npm run preview          # production build under wrangler
npx astro check          # types
```

## Connect Shopify

Create `.env` (gitignored) from `.env.example`, then:

```bash
node --experimental-strip-types scripts/seed-shopify.mjs --all --dry-run
node --experimental-strip-types scripts/seed-shopify.mjs --all
```

That creates the metaobject and metafield definitions, the size charts, uploads the
product imagery and creates all six products as **DRAFT** with **0 inventory**.

## Layout

```
src/
  lib/          shopify client, GraphQL documents, catalogue access, cart, fixtures
  layouts/      Base (SEO shell), Prose (content pages)
  components/   Header, Footer, ProductCard, AnnouncementBar, SizeGuideDialog
  pages/        home, collections/[handle], products/[handle], cart, search,
                api/cart, and the content + policy pages
  styles/       global.css — design tokens and scroll-driven motion
scripts/        seed-shopify.mjs
assets-raw/     original artwork (gitignored, never committed)
```

## Deploy

The repo is on GitHub at `AliChahbandar/pbnb-store` (private). Pushing to `main`
runs `.github/workflows/deploy.yml`: type check → build → deploy.

**Target is Cloudflare Workers, not Pages.** `@astrojs/cloudflare` v14 builds a Worker
with a static-assets binding and writes its own `dist/server/wrangler.json`, so the
deploy command is `wrangler deploy`, not `wrangler pages deploy`. Cloudflare Pages is
in maintenance mode for new projects; Workers Static Assets is its successor.

Two repo secrets are required before the deploy job can run:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token → *Edit Cloudflare Workers* template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right-hand sidebar |

```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```

Shopify credentials are **Worker secrets**, not repo secrets — they belong to the
running Worker, not the build:

```bash
npx wrangler secret put SHOPIFY_STORE_DOMAIN            --config dist/server/wrangler.json
npx wrangler secret put SHOPIFY_STOREFRONT_TOKEN        --config dist/server/wrangler.json
npx wrangler secret put SHOPIFY_STOREFRONT_PRIVATE_TOKEN --config dist/server/wrangler.json
```

`SHOPIFY_ADMIN_TOKEN` is **never** set as a Worker secret. It is read only by
`scripts/seed-shopify.mjs` from your local `.env`.

To deploy by hand instead:

```bash
npx wrangler login
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

## Docs

- [`DECISIONS.md`](./DECISIONS.md) — every non-obvious call, placeholder prices,
  weight estimates, every `[FILL]` / `[CONFIRM]`, and what's blocked
- [`DESIGN.md`](./DESIGN.md) — design direction, sampled palette, motion rules
- [`IMAGE-INVENTORY.md`](./IMAGE-INVENTORY.md) — all 57 source files, what each is,
  what was used and what wasn't
