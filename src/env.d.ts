/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

// Worker bindings. The Admin token is deliberately absent: it is only ever read
// by scripts/seed-shopify.mjs from .env on your machine, and must never be
// deployed as a Worker binding or referenced from src/.
interface Env {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_TOKEN?: string;
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN?: string;
  SHOPIFY_API_VERSION?: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}

// The Cloudflare runtime binding module. Astro v6+ removed
// `Astro.locals.runtime.env`; this is the supported replacement, and the
// adapter shims it in dev and at build time.
declare module 'cloudflare:workers' {
  export const env: Env;
}
