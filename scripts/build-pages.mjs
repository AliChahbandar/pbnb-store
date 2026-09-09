#!/usr/bin/env node
/**
 * Static build for the GitHub Pages preview.
 *
 *   node scripts/build-pages.mjs   ->  dist-pages/
 *
 * GitHub Pages serves files, not a runtime, so the one server endpoint
 * (/api/cart) cannot exist in this build — `export const prerender = false`
 * requires an adapter. Rather than fork the route or pollute it with build
 * flags, it is moved aside for the duration of the build and always put back,
 * including on failure.
 *
 * The cart is non-functional in this preview regardless: there are no Shopify
 * credentials, so /api/cart only ever returns "the store isn't connected yet".
 */

import { rename, mkdir, rm, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_DIR = path.join(ROOT, 'src/pages/api');
const STASH = path.join(ROOT, '.api-stash');

const exists = async (p) => access(p).then(() => true, () => false);

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: false });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    );
    child.on('error', reject);
  });
}

let stashed = false;
try {
  if (await exists(API_DIR)) {
    await rm(STASH, { recursive: true, force: true });
    await mkdir(path.dirname(STASH), { recursive: true });
    await rename(API_DIR, STASH);
    stashed = true;
    console.log('· set aside src/pages/api for the static build');
  }

  await run('npx', ['astro', 'build', '--config', 'astro.config.pages.mjs']);
} finally {
  if (stashed) {
    await rm(API_DIR, { recursive: true, force: true });
    await rename(STASH, API_DIR);
    console.log('· restored src/pages/api');
  }
}
