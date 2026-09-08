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
  integrations: [sitemap({ filter: (page) => !page.includes('/cart') && !page.includes('/search') })],
  vite: { build: { assetsInlineLimit: 0 } },
});
