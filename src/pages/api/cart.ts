import type { APIRoute } from 'astro';
import {
  CART_COOKIE,
  cartCookie,
  createCart,
  addLine,
  updateLine,
  removeLine,
  getCart,
} from '../../lib/cart';

export const prerender = false;

/**
 * Cart mutations run here, server-side, so the Storefront token stays off the
 * client and the buyer's IP is forwarded to Shopify on every call.
 *
 * Accepts a normal form POST (works with JavaScript disabled — the form
 * redirects back to where it came from) and fetch() with Accept: application/json.
 */
export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
  const ctype = request.headers.get('content-type') ?? '';
  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

  let body: Record<string, string> = {};
  if (ctype.includes('application/json')) {
    body = (await request.json()) as Record<string, string>;
  } else {
    const fd = await request.formData();
    body = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  }

  const action = body.action ?? 'add';
  const back = body.redirect || '/cart';
  const ctx = { request, locals };
  let cartId = cookies.get(CART_COOKIE)?.value ?? null;

  const fail = (message: string, status = 400) =>
    wantsJson
      ? new Response(JSON.stringify({ ok: false, error: message }), {
          status,
          headers: { 'content-type': 'application/json' },
        })
      : redirect(`${back}${back.includes('?') ? '&' : '?'}cart_error=${encodeURIComponent(message)}`, 303);

  try {
    let result;

    if (action === 'add') {
      const variantId = body.variantId;
      const qty = Math.max(1, Number(body.quantity ?? 1) || 1);
      if (!variantId) return fail('Pick a size before adding to the bag.');

      // A stale cookie (completed or expired cart) must not wedge the buyer.
      if (cartId) {
        const existing = await getCart(cartId, ctx);
        if (!existing.cart) cartId = null;
      }
      result = cartId ? await addLine(cartId, variantId, qty, ctx) : await createCart(variantId, qty, ctx);
    } else if (action === 'update') {
      if (!cartId) return fail('Your bag has expired.');
      const qty = Number(body.quantity ?? 0) || 0;
      result =
        qty <= 0
          ? await removeLine(cartId, body.lineId!, ctx)
          : await updateLine(cartId, body.lineId!, qty, ctx);
    } else if (action === 'remove') {
      if (!cartId) return fail('Your bag has expired.');
      result = await removeLine(cartId, body.lineId!, ctx);
    } else {
      return fail('Unknown cart action.');
    }

    if (result.unconfigured) {
      return fail(
        'The store isn’t connected to Shopify yet, so checkout is disabled.',
        503,
      );
    }
    if (result.error) return fail(result.error, 422);
    if (!result.cart) return fail('Could not update the bag.', 502);

    const headers = new Headers();
    headers.append('Set-Cookie', cartCookie(result.cart.id));

    if (wantsJson) {
      headers.set('content-type', 'application/json');
      return new Response(JSON.stringify({ ok: true, cart: result.cart }), { status: 200, headers });
    }
    headers.set('Location', back);
    return new Response(null, { status: 303, headers });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Cart request failed', 500);
  }
};

/** Current cart as JSON — used by the header badge after a client-side add. */
export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const cartId = cookies.get(CART_COOKIE)?.value ?? null;
  const { cart } = await getCart(cartId, { request, locals });
  return new Response(JSON.stringify({ ok: true, cart }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
