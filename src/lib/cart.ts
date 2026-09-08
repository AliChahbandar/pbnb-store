/**
 * Cart, backed by the Storefront Cart API.
 *
 * The cart id lives in an httpOnly cookie. All mutations run server-side
 * through /api/cart so the token never reaches the browser and the buyer IP is
 * forwarded on every call.
 *
 * checkoutUrl is read from the cart we already have — no extra request is made
 * to "prepare" checkout. The buyer is redirected to Shopify's hosted checkout
 * only when they press the button.
 */

import { storefront } from './shopify';
import {
  CART_CREATE,
  GET_CART,
  CART_LINES_ADD,
  CART_LINES_UPDATE,
  CART_LINES_REMOVE,
} from './queries';
import type { Cart, CartLine } from './types';

export const CART_COOKIE = 'pbnb_cart';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export interface CartCtx {
  request?: Request;
  locals?: App.Locals;
}

type Raw = Record<string, any>;

function normalizeCart(raw: Raw | null): Cart | null {
  if (!raw) return null;
  const lines: CartLine[] = (raw.lines?.nodes ?? [])
    .filter((l: Raw) => l?.merchandise?.id)
    .map((l: Raw) => ({
      id: l.id,
      quantity: l.quantity,
      merchandise: {
        id: l.merchandise.id,
        title: l.merchandise.title,
        selectedOptions: l.merchandise.selectedOptions ?? [],
        image: l.merchandise.image ?? null,
        price: l.merchandise.price,
        product: {
          handle: l.merchandise.product?.handle ?? '',
          title: l.merchandise.product?.title ?? '',
          featuredImage: l.merchandise.product?.featuredImage ?? null,
        },
      },
      cost: l.cost,
    }));

  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity ?? 0,
    lines,
    cost: raw.cost,
  };
}

function firstError(payload: Raw | undefined): string | null {
  const ue = payload?.userErrors?.[0]?.message;
  if (ue) return ue;
  const w = payload?.warnings?.[0]?.message;
  return w ?? null;
}

export interface CartOp {
  cart: Cart | null;
  error: string | null;
  /** true when Shopify isn't configured — the UI explains rather than lying */
  unconfigured: boolean;
}

export async function getCart(id: string | null, ctx: CartCtx = {}): Promise<CartOp> {
  if (!id) return { cart: null, error: null, unconfigured: false };
  const res = await storefront<{ cart: Raw | null }>({
    query: GET_CART,
    variables: { id },
    request: ctx.request,
    locals: ctx.locals,
  });
  if (res.unconfigured) return { cart: null, error: null, unconfigured: true };
  return { cart: normalizeCart(res.data?.cart ?? null), error: res.errors?.[0]?.message ?? null, unconfigured: false };
}

export async function createCart(
  merchandiseId: string,
  quantity: number,
  ctx: CartCtx = {},
): Promise<CartOp> {
  const res = await storefront<{ cartCreate: Raw }>({
    query: CART_CREATE,
    variables: { input: { lines: [{ merchandiseId, quantity }] } },
    request: ctx.request,
    locals: ctx.locals,
  });
  if (res.unconfigured) return { cart: null, error: null, unconfigured: true };
  const p = res.data?.cartCreate;
  return {
    cart: normalizeCart(p?.cart ?? null),
    error: res.errors?.[0]?.message ?? firstError(p),
    unconfigured: false,
  };
}

export async function addLine(
  cartId: string,
  merchandiseId: string,
  quantity: number,
  ctx: CartCtx = {},
): Promise<CartOp> {
  const res = await storefront<{ cartLinesAdd: Raw }>({
    query: CART_LINES_ADD,
    variables: { cartId, lines: [{ merchandiseId, quantity }] },
    request: ctx.request,
    locals: ctx.locals,
  });
  if (res.unconfigured) return { cart: null, error: null, unconfigured: true };
  const p = res.data?.cartLinesAdd;
  return { cart: normalizeCart(p?.cart ?? null), error: res.errors?.[0]?.message ?? firstError(p), unconfigured: false };
}

export async function updateLine(
  cartId: string,
  lineId: string,
  quantity: number,
  ctx: CartCtx = {},
): Promise<CartOp> {
  const res = await storefront<{ cartLinesUpdate: Raw }>({
    query: CART_LINES_UPDATE,
    variables: { cartId, lines: [{ id: lineId, quantity }] },
    request: ctx.request,
    locals: ctx.locals,
  });
  if (res.unconfigured) return { cart: null, error: null, unconfigured: true };
  const p = res.data?.cartLinesUpdate;
  return { cart: normalizeCart(p?.cart ?? null), error: res.errors?.[0]?.message ?? firstError(p), unconfigured: false };
}

export async function removeLine(cartId: string, lineId: string, ctx: CartCtx = {}): Promise<CartOp> {
  const res = await storefront<{ cartLinesRemove: Raw }>({
    query: CART_LINES_REMOVE,
    variables: { cartId, lineIds: [lineId] },
    request: ctx.request,
    locals: ctx.locals,
  });
  if (res.unconfigured) return { cart: null, error: null, unconfigured: true };
  const p = res.data?.cartLinesRemove;
  return { cart: normalizeCart(p?.cart ?? null), error: res.errors?.[0]?.message ?? firstError(p), unconfigured: false };
}

export function cartCookie(id: string): string {
  return `${CART_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${COOKIE_MAX_AGE}`;
}

export function clearCartCookie(): string {
  return `${CART_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

/** Size and colour, formatted for a cart line. */
export function lineOptions(line: CartLine): string {
  const o = line.merchandise.selectedOptions;
  const color = o.find((x) => x.name.toLowerCase() === 'color')?.value;
  const size = o.find((x) => x.name.toLowerCase() === 'size')?.value;
  return [color, size && `Size ${size}`].filter(Boolean).join(' · ');
}
