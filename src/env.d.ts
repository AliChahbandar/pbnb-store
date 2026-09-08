/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_TOKEN?: string;
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN?: string;
  SHOPIFY_ADMIN_TOKEN?: string;
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
