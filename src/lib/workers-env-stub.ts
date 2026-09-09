/**
 * Stand-in for the `cloudflare:workers` module.
 *
 * That module only exists inside the Workers runtime. The static Pages preview
 * builds without the Cloudflare adapter, so the import has nothing to resolve
 * to — this stub takes its place via a Vite alias in astro.config.pages.mjs.
 *
 * Returning an empty env is exactly right for that build: it has no Shopify
 * credentials, so `isConfigured()` is false and the catalogue falls back to
 * fixtures, which is what the preview is meant to show.
 */
export const env: Record<string, string | undefined> = {};
