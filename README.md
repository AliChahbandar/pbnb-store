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

## Live preview

**https://alichahbandar.github.io/pbnb-store/** — permanent, rebuilt on every push
to `main` by `.github/workflows/pages.yml`.

This is a **static** build (`npm run build:pages` → `dist-pages/`), which is an
honest representation of the current state: with no Shopify credentials every page
already renders from build-time fixtures. Two differences from production worth
knowing:

- Deep-linked variants (`?color=Grey&size=XS`) resolve in the browser rather than
  server-side. Filtering likewise runs client-side. Both work; they just aren't
  server-rendered.
- The cart is inert. `/api/cart` needs a runtime and is excluded from this build.

Production is Cloudflare Workers, server-rendered — see below.

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

### Live preview

**https://alichahbandar.github.io/pbnb-store/** — permanent, rebuilt on every push
to `main` by `.github/workflows/pages.yml`.

This is a **static** build (`npm run build:pages` → `dist-pages/`), which is an
honest representation of the current state: with no Shopify credentials every page
already renders from build-time fixtures. Two differences from production worth
knowing:

- Deep-linked variants (`?color=Grey&size=XS`) resolve in the browser rather than
  server-side. Filtering likewise runs client-side. Both work; they just aren't
  server-rendered.
- The cart is inert. `/api/cart` needs a runtime and is excluded from this build.

Production is Cloudflare Workers, server-rendered — see below.

## Deploying by hand

```bash
npx wrangler login   # once, interactive
npm run deploy       # permanent, on your own account
```

### Throwaway preview URL (no login)

```bash
npm run deploy:preview
```

This uses `wrangler deploy --temporary`, which borrows a **temporary Cloudflare
account**. It gives a public `*.workers.dev` URL in about 30 seconds with no
credentials — but the account is reclaimed after a short window (in practice,
under a day), after which the hostname stops resolving. Cloudflare then answers
with the `100::` IPv6 discard address, so the browser hangs rather than showing
an error: the symptom is **"loading forever"**, not a 404.

Re-run the command to get a fresh URL. For anything you intend to share more
than once, use `npm run deploy` on your own account instead.

## Docs

- [`DECISIONS.md`](./DECISIONS.md) — every non-obvious call, placeholder prices,
  weight estimates, every `[FILL]` / `[CONFIRM]`, and what's blocked
- [`DESIGN.md`](./DESIGN.md) — design direction, sampled palette, motion rules
- [`IMAGE-INVENTORY.md`](./IMAGE-INVENTORY.md) — all 57 source files, what each is,
  what was used and what wasn't
