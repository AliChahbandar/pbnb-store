// @ts-check
import { defineConfig } from 'astro/config';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Static build for the GitHub Pages preview.
 *
 * This exists for one reason: a link that does not expire. The Cloudflare
 * config (astro.config.mjs) is the real production target and stays untouched —
 * this one produces a plain static copy of the same site for a free, permanent
 * host.
 *
 * That is an honest representation of the current state: with no Shopify
 * credentials every page already renders from build-time fixtures, so nothing
 * is actually dynamic yet. When the Storefront token lands, the Cloudflare SSR
 * build is what goes live and this preview stops being representative.
 *
 * GitHub Pages serves a project repo under /<repo>/, so everything needs a base
 * path. Rather than thread `import.meta.env.BASE_URL` through ~60 hardcoded
 * links in the templates — churn that would only ever serve this one host — the
 * integration below rewrites root-relative URLs in the emitted HTML after the
 * build. The templates stay clean and the production build is unaffected.
 */

const BASE = '/pbnb-store';

/**
 * Rewrite root-relative URLs in emitted HTML to sit under the base path.
 * @returns {import('astro').AstroIntegration}
 */
function basePathRewriter() {
  return {
    name: 'pbnb-base-path-rewriter',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let files = 0;
        let edits = 0;

        /** @param {string} d */
        const walk = async (d) => {
          for (const entry of await readdir(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) await walk(full);
            else if (entry.name.endsWith('.html')) {
              const before = await readFile(full, 'utf8');
              // Only href/src/action, only values starting with a single "/",
              // and never anything already under the base. Protocol-relative
              // "//host" and absolute "https://" are left alone, which is what
              // keeps the pbnb.store canonicals intact.
              const after = before.replace(
                /\b(href|src|action)="\/(?!\/)([^"]*)"/g,
                (m, attr, rest) =>
                  rest.startsWith(BASE.slice(1)) ? m : `${attr}="${BASE}/${rest}"`,
              );
              if (after !== before) {
                await writeFile(full, after);
                edits++;
              }
              files++;
            }
          }
        };

        await walk(root);
        logger.info(`base-path rewrite: ${edits}/${files} HTML files updated to ${BASE}/`);

        // The web manifest is JSON, not HTML, so the walk above never sees it —
        // and its root-relative start_url/icon paths 404 under a base path,
        // which surfaces as a console error and dings Best Practices.
        const manifestPath = path.join(root, 'site.webmanifest');
        try {
          const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
          if (typeof manifest.start_url === 'string' && manifest.start_url.startsWith('/')) {
            manifest.start_url = `${BASE}${manifest.start_url}`;
          }
          for (const icon of manifest.icons ?? []) {
            if (typeof icon.src === 'string' && icon.src.startsWith('/') && !icon.src.startsWith(BASE)) {
              icon.src = `${BASE}${icon.src}`;
            }
          }
          await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
          logger.info('rewrote site.webmanifest paths for the base path');
        } catch {
          logger.warn('site.webmanifest not found or unparseable — skipped');
        }

        // GitHub Pages runs Jekyll by default, which silently drops any path
        // beginning with an underscore — that would delete the entire _astro/
        // directory and take every stylesheet with it. This opts out.
        await writeFile(path.join(root, '.nojekyll'), '');
        logger.info('wrote .nojekyll (keeps _astro/ from being stripped by Jekyll)');
      },
    },
  };
}

export default defineConfig({
  site: 'https://alichahbandar.github.io',
  base: BASE,
  output: 'static',
  outDir: './dist-pages',
  build: { format: 'file' },
  trailingSlash: 'never',
  integrations: [basePathRewriter()],
  vite: {
    build: { assetsInlineLimit: 0 },
    resolve: {
      alias: {
        // Only exists inside the Workers runtime; this build has no adapter.
        'cloudflare:workers': fileURLToPath(new URL('./src/lib/workers-env-stub.ts', import.meta.url)),
      },
    },
  },
});
