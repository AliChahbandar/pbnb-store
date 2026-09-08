// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Server-rendered by default (Storefront data is per-request: inventory,
// cart, buyer-scoped pricing). Marketing/legal routes opt back into
// prerendering with `export const prerender = true`.
export default defineConfig({
  site: 'https://pbnb.store',
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  // We manage the cart id in our own signed cookie, so Astro sessions are not
  // used. Leaving them on makes the Cloudflare adapter demand a KV binding —
  // and its generated session-driver module single-quotes the project path,
  // which breaks outright on a directory containing an apostrophe.
  session: false,
  // Prerendered routes default to `about/index.html`, which makes /about a 307
  // to /about/ — a redirect hop on every content-page click, and inconsistent
  // with the non-slash canonicals we emit. Emit flat files and never add the
  // trailing slash.
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap({ filter: (page) => !page.includes('/cart') && !page.includes('/search') })],
  vite: { build: { assetsInlineLimit: 0 } },
});
