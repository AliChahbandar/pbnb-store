/**
 * Shopify Storefront API client.
 *
 * API version is pinned. 2026-07 is the latest *stable* release as of
 * 2026-09 (2026-10 exists but is only a release candidate). Verified against
 * shopify.dev/docs/api/usage/versioning — not assumed.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LOOKS THE WAY IT DOES — the buyer-IP problem
 * ---------------------------------------------------------------------------
 * Shopify enforces Storefront API limits per *buyer*, and it identifies the
 * buyer by IP. In a normal theme the browser calls Shopify directly, so that
 * works out of the box. We server-render on Cloudflare, which means every
 * request to Shopify leaves from a small pool of Cloudflare egress IPs. To
 * Shopify that looks like one extremely busy buyer, and the response is
 * throttling plus degraded bot protection.
 *
 * The supported fix (shopify.dev, "make server-side requests with a private
 * access token") is to use a PRIVATE Storefront token server-side and forward
 * the real buyer address:
 *
 *   Shopify-Storefront-Private-Token: <private token>   // secret, server only
 *   Shopify-Storefront-Buyer-IP:      <real buyer IP>   // case-sensitive
 *
 * Without the buyer-IP header Shopify "can't differentiate requests from
 * different buyers, which can result in throttled API requests, limited bot
 * protection, and unauthenticated flows at checkout."
 *
 * So: pass the incoming Request through to every storefront() call, and we
 * pull the address off CF-Connecting-IP. Build-time calls (prerender) have no
 * buyer, so the header is correctly omitted there.
 */

import { env as workerEnv } from 'cloudflare:workers';

export const API_VERSION = '2026-07';

export interface ShopifyEnv {
  SHOPIFY_STORE_DOMAIN?: string;
  SHOPIFY_STOREFRONT_TOKEN?: string;
  SHOPIFY_STOREFRONT_PRIVATE_TOKEN?: string;
  SHOPIFY_API_VERSION?: string;
}

export interface StorefrontResult<T> {
  data: T | null;
  errors: Array<{ message: string }> | null;
  /** true when no credentials are configured — callers fall back to fixtures */
  unconfigured: boolean;
}

/**
 * Read config from the Workers binding first, then process.env for local dev.
 *
 * `Astro.locals.runtime.env` was removed in Astro v6 — the supported route is
 * the `cloudflare:workers` module, which the adapter also shims during
 * `astro dev` and at build time.
 */
export function readEnv(_locals?: App.Locals): ShopifyEnv {
  let runtime: Record<string, string | undefined> | undefined;
  try {
    runtime = workerEnv as unknown as Record<string, string | undefined>;
  } catch {
    runtime = undefined;
  }
  const fromProcess = typeof process !== 'undefined' ? (process.env as Record<string, string>) : {};
  const get = (k: string) => runtime?.[k] ?? fromProcess?.[k];
  return {
    SHOPIFY_STORE_DOMAIN: get('SHOPIFY_STORE_DOMAIN'),
    SHOPIFY_STOREFRONT_TOKEN: get('SHOPIFY_STOREFRONT_TOKEN'),
    SHOPIFY_STOREFRONT_PRIVATE_TOKEN: get('SHOPIFY_STOREFRONT_PRIVATE_TOKEN'),
    SHOPIFY_API_VERSION: get('SHOPIFY_API_VERSION'),
  };
}

export function isConfigured(env: ShopifyEnv): boolean {
  return Boolean(
    env.SHOPIFY_STORE_DOMAIN && (env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN || env.SHOPIFY_STOREFRONT_TOKEN),
  );
}

/** Real client address, as seen by Cloudflare. */
function buyerIp(request?: Request): string | null {
  if (!request) return null;
  const h = request.headers;
  const cf = h.get('CF-Connecting-IP');
  if (cf) return cf;
  const fwd = h.get('X-Forwarded-For');
  if (fwd) return fwd.split(',')[0]!.trim();
  return null;
}

export interface StorefrontOptions {
  query: string;
  variables?: Record<string, unknown>;
  /** Pass the incoming request so the buyer's IP can be forwarded. */
  request?: Request;
  locals?: App.Locals;
  /** Cache hint for read-only queries. Mutations must not be cached. */
  cacheSeconds?: number;
}

export async function storefront<T = unknown>(opts: StorefrontOptions): Promise<StorefrontResult<T>> {
  const env = readEnv(opts.locals);

  if (!isConfigured(env)) {
    return { data: null, errors: null, unconfigured: true };
  }

  const version = env.SHOPIFY_API_VERSION || API_VERSION;
  const domain = env.SHOPIFY_STORE_DOMAIN!.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${domain}/api/${version}/graphql.json`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Prefer the private token server-side. It is the one Shopify expects to be
  // paired with a forwarded buyer IP, and it is never exposed to the browser.
  if (env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN) {
    headers['Shopify-Storefront-Private-Token'] = env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  } else {
    headers['X-Shopify-Storefront-Access-Token'] = env.SHOPIFY_STOREFRONT_TOKEN!;
  }

  // Case-sensitive header name. Omitted for build-time calls, which have no buyer.
  const ip = buyerIp(opts.request);
  if (ip) headers['Shopify-Storefront-Buyer-IP'] = ip;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: opts.query, variables: opts.variables ?? {} }),
      ...(opts.cacheSeconds
        ? { cf: { cacheTtl: opts.cacheSeconds, cacheEverything: true } }
        : {}),
    } as RequestInit);

    if (!res.ok) {
      const body = await res.text();
      return {
        data: null,
        errors: [{ message: `Storefront API ${res.status}: ${body.slice(0, 400)}` }],
        unconfigured: false,
      };
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    return { data: json.data ?? null, errors: json.errors ?? null, unconfigured: false };
  } catch (err) {
    return {
      data: null,
      errors: [{ message: err instanceof Error ? err.message : 'Storefront request failed' }],
      unconfigured: false,
    };
  }
}

/** Shopify CDN transformation params. Never resize in the browser. */
export function shopifyImage(url: string, width: number, height?: number): string {
  if (!url) return url;
  if (!url.includes('cdn.shopify.com') && !url.includes('/cdn/shop/')) return url;
  const u = new URL(url);
  u.searchParams.set('width', String(width));
  if (height) u.searchParams.set('height', String(height));
  return u.toString();
}

/** Decode a Storefront global id, e.g. gid://shopify/ProductVariant/123 -> 123 */
export function gidTail(gid: string): string {
  const i = gid.lastIndexOf('/');
  return i === -1 ? gid : gid.slice(i + 1);
}
