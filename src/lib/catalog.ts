/**
 * Catalogue access.
 *
 * Every read goes through here. When Storefront credentials are present the
 * data comes from Shopify; when they aren't, it falls back to the fixture
 * catalogue so the site is fully browsable during build-out. The shapes are
 * identical either way, so nothing downstream changes when the token lands.
 */

import { storefront } from './shopify';
import { GET_PRODUCT, GET_COLLECTION, GET_COLLECTIONS, SEARCH_PRODUCTS } from './queries';
import { FIXTURE_PRODUCTS, FIXTURE_COLLECTIONS, COLOR_SWATCHES, SIZE_CHARTS } from './fixtures';
import type { Product, Collection, Variant, FilterFacet, ImageRef, SizeChart } from './types';

export interface Ctx {
  request?: Request;
  locals?: App.Locals;
}

export interface CatalogResult<T> {
  data: T;
  /** true when the data came from fixtures rather than Shopify */
  fixture: boolean;
  error: string | null;
}

/* ------------------------------------------------------------------ */
/* Normalisation: Shopify -> our Product shape                         */
/* ------------------------------------------------------------------ */

type RawProduct = Record<string, any>;

function normalizeProduct(raw: RawProduct): Product {
  const variants: Variant[] = (raw.variants?.nodes ?? []).map((v: RawProduct) => ({
    id: v.id,
    title: v.title,
    sku: v.sku ?? null,
    availableForSale: Boolean(v.availableForSale),
    quantityAvailable: typeof v.quantityAvailable === 'number' ? v.quantityAvailable : null,
    currentlyNotInStock: Boolean(v.currentlyNotInStock),
    selectedOptions: v.selectedOptions ?? [],
    price: v.price,
    compareAtPrice: v.compareAtPrice ?? null,
    image: v.image ?? null,
    weight: v.weight ?? null,
    weightUnit: v.weightUnit ?? null,
  }));

  const images: ImageRef[] = raw.images?.nodes ?? (raw.featuredImage ? [raw.featuredImage] : []);

  // Group images by colourway using the variant->image association Shopify
  // stores. This is what makes the gallery swap on colour change without JS
  // faking it.
  const imagesByColor: Record<string, ImageRef[]> = {};
  for (const v of variants) {
    const color = v.selectedOptions.find((o) => o.name.toLowerCase() === 'color')?.value;
    if (!color || !v.image) continue;
    imagesByColor[color] ??= [];
    if (!imagesByColor[color].some((i) => i.url === v.image!.url)) {
      imagesByColor[color].push(v.image);
    }
  }

  const mfValue = (k: string) => (raw[k]?.value as string | undefined) ?? null;

  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description ?? '',
    descriptionHtml: raw.descriptionHtml ?? '',
    productType: raw.productType ?? '',
    tags: raw.tags ?? [],
    vendor: raw.vendor ?? 'PB&B',
    availableForSale: Boolean(raw.availableForSale),
    featuredImage: raw.featuredImage ?? images[0] ?? null,
    images,
    options: (raw.options ?? []).map((o: RawProduct) => ({
      id: o.id,
      name: o.name,
      values: (o.optionValues ?? []).map((ov: RawProduct) => ov.name),
    })),
    variants,
    priceRange: raw.priceRange,
    seo: raw.seo ?? { title: null, description: null },
    imagesByColor: Object.keys(imagesByColor).length ? imagesByColor : undefined,
    fit: mfValue('fit'),
    fabric: mfValue('fabric'),
    care: mfValue('care'),
    modelInfo: mfValue('modelInfo'),
    sizeChartKey: raw.sizeChart?.reference?.handle ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function getProduct(handle: string, ctx: Ctx = {}): Promise<CatalogResult<Product | null>> {
  const res = await storefront<{ product: RawProduct | null }>({
    query: GET_PRODUCT,
    variables: { handle },
    request: ctx.request,
    locals: ctx.locals,
    cacheSeconds: 60,
  });

  if (res.unconfigured || res.errors || !res.data) {
    const p = FIXTURE_PRODUCTS.find((x) => x.handle === handle) ?? null;
    return { data: p, fixture: true, error: res.errors?.[0]?.message ?? null };
  }
  return {
    data: res.data.product ? normalizeProduct(res.data.product) : null,
    fixture: false,
    error: null,
  };
}

export interface CollectionQuery {
  first?: number;
  after?: string | null;
  /** Storefront ProductFilter inputs */
  filters?: Array<Record<string, unknown>>;
  sortKey?: string;
  reverse?: boolean;
}

export interface CollectionPage {
  collection: Collection | null;
  facets: FilterFacet[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

export async function getCollection(
  handle: string,
  q: CollectionQuery = {},
  ctx: Ctx = {},
): Promise<CatalogResult<CollectionPage>> {
  const first = q.first ?? 24;
  const res = await storefront<{ collection: RawProduct | null }>({
    query: GET_COLLECTION,
    variables: {
      handle,
      first,
      after: q.after ?? null,
      filters: q.filters ?? null,
      sortKey: q.sortKey ?? null,
      reverse: q.reverse ?? false,
    },
    request: ctx.request,
    locals: ctx.locals,
    cacheSeconds: 60,
  });

  if (res.unconfigured || res.errors || !res.data?.collection) {
    return { data: fixtureCollection(handle, q), fixture: true, error: res.errors?.[0]?.message ?? null };
  }

  const c = res.data.collection;
  const products = (c.products?.nodes ?? []).map(normalizeProduct);
  return {
    data: {
      collection: {
        id: c.id,
        handle: c.handle,
        title: c.title,
        description: c.description ?? '',
        image: c.image ?? null,
        products,
        seo: c.seo ?? { title: null, description: null },
      },
      facets: deriveFacets(products),
      pageInfo: {
        hasNextPage: Boolean(c.products?.pageInfo?.hasNextPage),
        endCursor: c.products?.pageInfo?.endCursor ?? null,
      },
    },
    fixture: false,
    error: null,
  };
}

function fixtureCollection(handle: string, q: CollectionQuery): CollectionPage {
  const def = FIXTURE_COLLECTIONS.find((c) => c.handle === handle);
  if (!def) return { collection: null, facets: [], pageInfo: { hasNextPage: false, endCursor: null } };

  let products = FIXTURE_PRODUCTS.filter(def.match);
  const facets = deriveFacets(products);

  // Apply the same ProductFilter semantics locally so filtering behaves
  // identically with and without a live Storefront token.
  for (const f of q.filters ?? []) {
    const vo = f.variantOption as { name: string; value: string } | undefined;
    if (vo) {
      products = products.filter((p) =>
        p.variants.some((v) =>
          v.selectedOptions.some(
            (o) => o.name.toLowerCase() === vo.name.toLowerCase() && o.value === vo.value,
          ),
        ),
      );
    }
    if (typeof f.productType === 'string') {
      products = products.filter((p) => p.productType === f.productType);
    }
    if (f.available === true) products = products.filter((p) => p.availableForSale);
  }

  const first = q.first ?? 24;
  const start = q.after ? Number(q.after) || 0 : 0;
  const page = products.slice(start, start + first);

  return {
    collection: {
      id: `gid://shopify/Collection/${handle}`,
      handle,
      title: def.title,
      description: def.description,
      image: null,
      products: page,
      seo: { title: `${def.title} — PB&B`, description: def.description },
    },
    facets,
    pageInfo: {
      hasNextPage: start + first < products.length,
      endCursor: String(start + first),
    },
  };
}

export async function getCollections(ctx: Ctx = {}): Promise<CatalogResult<Array<{ handle: string; title: string; description: string }>>> {
  const res = await storefront<{ collections: { nodes: RawProduct[] } }>({
    query: GET_COLLECTIONS,
    variables: { first: 20 },
    request: ctx.request,
    locals: ctx.locals,
    cacheSeconds: 300,
  });
  if (res.unconfigured || res.errors || !res.data) {
    return {
      data: FIXTURE_COLLECTIONS.map((c) => ({ handle: c.handle, title: c.title, description: c.description })),
      fixture: true,
      error: res.errors?.[0]?.message ?? null,
    };
  }
  return {
    data: res.data.collections.nodes.map((c) => ({
      handle: c.handle,
      title: c.title,
      description: c.description ?? '',
    })),
    fixture: false,
    error: null,
  };
}

export async function searchProducts(query: string, ctx: Ctx = {}): Promise<CatalogResult<Product[]>> {
  if (!query.trim()) return { data: [], fixture: true, error: null };

  const res = await storefront<{ search: { nodes: RawProduct[] } }>({
    query: SEARCH_PRODUCTS,
    variables: { query, first: 40, after: null },
    request: ctx.request,
    locals: ctx.locals,
  });

  if (res.unconfigured || res.errors || !res.data) {
    // Fixture search covers title, colour, type and tags — the brief asks for
    // name and colour at minimum.
    const q = query.toLowerCase();
    const hits = FIXTURE_PRODUCTS.filter((p) => {
      const colors = p.options.find((o) => o.name === 'Color')?.values ?? [];
      return (
        p.title.toLowerCase().includes(q) ||
        p.productType.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        colors.some((c) => c.toLowerCase().includes(q))
      );
    });
    return { data: hits, fixture: true, error: res.errors?.[0]?.message ?? null };
  }
  return { data: res.data.search.nodes.map(normalizeProduct), fixture: false, error: null };
}

/* ------------------------------------------------------------------ */
/* Facets & variant helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Derive the available filter values from the loaded product set.
 *
 * Shopify can return a `filters` list on the products connection, but only
 * once the Search & Discovery app has filters configured for the shop. Deriving
 * them from the catalogue works either way and never renders a facet that
 * matches nothing.
 */
export function deriveFacets(products: Product[]): FilterFacet[] {
  const buckets: Record<string, Map<string, number>> = {
    Size: new Map(),
    Color: new Map(),
    Type: new Map(),
  };

  for (const p of products) {
    if (p.productType) {
      buckets.Type!.set(p.productType, (buckets.Type!.get(p.productType) ?? 0) + 1);
    }
    const seen = { Size: new Set<string>(), Color: new Set<string>() };
    for (const v of p.variants) {
      for (const o of v.selectedOptions) {
        const key = o.name === 'Size' ? 'Size' : o.name === 'Color' ? 'Color' : null;
        if (!key) continue;
        if (seen[key as 'Size' | 'Color'].has(o.value)) continue;
        seen[key as 'Size' | 'Color'].add(o.value);
        buckets[key]!.set(o.value, (buckets[key]!.get(o.value) ?? 0) + 1);
      }
    }
  }

  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
  const order = (name: string) => (a: [string, number], b: [string, number]) => {
    if (name === 'Size') {
      const ia = SIZE_ORDER.indexOf(a[0]);
      const ib = SIZE_ORDER.indexOf(b[0]);
      if (ia !== -1 && ib !== -1) return ia - ib;
      const na = Number(a[0]);
      const nb = Number(b[0]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    }
    return a[0].localeCompare(b[0]);
  };

  return Object.entries(buckets)
    .filter(([, m]) => m.size > 0)
    .map(([name, m]) => ({
      name,
      values: [...m.entries()].sort(order(name)).map(([value, count]) => ({ value, count })),
    }));
}

export function colorSwatch(color: string): string {
  return COLOR_SWATCHES[color] ?? '#666';
}

export function optionValues(p: Product, name: string): string[] {
  return p.options.find((o) => o.name.toLowerCase() === name.toLowerCase())?.values ?? [];
}

export function findVariant(p: Product, selected: Record<string, string>): Variant | null {
  return (
    p.variants.find((v) =>
      v.selectedOptions.every((o) => !selected[o.name] || selected[o.name] === o.value),
    ) ?? null
  );
}

export function exactVariant(p: Product, selected: Record<string, string>): Variant | null {
  const keys = Object.keys(selected);
  return (
    p.variants.find(
      (v) => keys.every((k) => v.selectedOptions.find((o) => o.name === k)?.value === selected[k]),
    ) ?? null
  );
}

/** Images for a colourway, falling back to the full product set. */
export function galleryFor(p: Product, color?: string | null): ImageRef[] {
  if (color && p.imagesByColor?.[color]?.length) return p.imagesByColor[color];
  return p.images.length ? p.images : p.featuredImage ? [p.featuredImage] : [];
}

export function getSizeChart(key?: string | null): SizeChart | null {
  if (!key) return null;
  return SIZE_CHARTS[key] ?? null;
}

export const LOW_STOCK_THRESHOLD = 6;
