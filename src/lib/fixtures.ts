/**
 * Fixture catalogue.
 *
 * WHY THIS EXISTS
 * There is no photography and no Shopify catalogue yet (no Admin credentials,
 * and pbnb.store is still a password page with zero products). Everything here
 * is derived strictly from the design files in assets-raw/ — the garments, the
 * colourways and the graphics are the ones actually drawn. Nothing is invented:
 *
 *   - Colourways exist only where a flat was drawn in that colour.
 *   - Fabric composition is [FABRIC: FILL] everywhere. No label was
 *     photographed, so there is no composition, GSM or country of origin to
 *     transcribe, and inventing them would be a labelling claim.
 *   - The only *measured* garment dimension in the whole archive is the size-L
 *     tee on the spec sheet (assets-raw/Untitled_Artwork 4.png): 28in body,
 *     21.5in chest, 8.5in sleeve, 7x3in front print, 17x12in back print.
 *     Every other size is graded from it and flagged `measured: false`.
 *
 * Prices are PLACEHOLDER — see DECISIONS.md for the reasoning behind each.
 * Weights are ESTIMATES by garment type, flagged in DECISIONS.md.
 *
 * Fixture stock levels are a deliberate demo mix (in stock / low / sold out /
 * option-combination-not-offered) so all four product-page states are
 * reviewable. The Shopify seed script sets every real variant to 0, as asked.
 */

import type { Product, Variant, SizeChart, ImageRef } from './types';

const IMG = '/product-designs';

/* ------------------------------------------------------------------------ */
/* Size charts — modelled exactly as the `size_chart` metaobject will be.    */
/* ------------------------------------------------------------------------ */

export const SIZE_CHARTS: Record<string, SizeChart> = {
  'unisex-tops': {
    key: 'unisex-tops',
    title: 'Tops — unisex',
    unit: 'in',
    kind: 'top',
    columns: ['Size', 'Chest (flat)', 'Body length', 'Sleeve'],
    rows: [
      { size: 'XS', chest: 17.0, length: 25, sleeve: 7.0, measured: false },
      { size: 'S', chest: 18.5, length: 26, sleeve: 7.5, measured: false },
      { size: 'M', chest: 20.0, length: 27, sleeve: 8.0, measured: false },
      { size: 'L', chest: 21.5, length: 28, sleeve: 8.5, measured: true },
      { size: 'XL', chest: 23.0, length: 29, sleeve: 9.0, measured: false },
      { size: 'XXL', chest: 24.5, length: 30, sleeve: 9.5, measured: false },
    ],
    note: 'Measured flat, in inches. Size L is taken from the production spec sheet. Other sizes are graded from it at 1.5in chest / 1in length / 0.5in sleeve per step and are not yet confirmed against a sample.',
  },
  'unisex-bottoms': {
    key: 'unisex-bottoms',
    title: 'Bottoms — unisex',
    unit: 'in',
    kind: 'bottom',
    columns: ['Size', 'Waist (flat)', 'Inseam', 'Rise'],
    rows: [
      { size: '28', waist: 14.0, inseam: 30, rise: 12.0, measured: false },
      { size: '30', waist: 15.0, inseam: 30, rise: 12.5, measured: false },
      { size: '32', waist: 16.0, inseam: 31, rise: 13.0, measured: false },
      { size: '34', waist: 17.0, inseam: 31, rise: 13.5, measured: false },
      { size: '36', waist: 18.0, inseam: 32, rise: 14.0, measured: false },
      { size: '38', waist: 19.0, inseam: 32, rise: 14.5, measured: false },
    ],
    note: '[CONFIRM] No bottoms spec sheet exists in the archive yet. Every row here is a standard baggy-fit grade, not a measurement. Confirm against a sample before publishing.',
  },
};

/* ------------------------------------------------------------------------ */
/* Product definitions                                                       */
/* ------------------------------------------------------------------------ */

type StockState = 'ok' | 'low' | 'out';

interface ColorSpec {
  name: string;
  slug: string;
  /** hex used for the swatch chip */
  swatch: string;
  /** sizes offered in this colourway; sizes absent here are *not offered* */
  sizes: string[];
  stock?: Record<string, StockState>;
}

interface Spec {
  handle: string;
  title: string;
  productType: string;
  tags: string[];
  price: number;
  /** grams — estimated by garment type, see DECISIONS.md */
  weight: number;
  skuType: string;
  sizeChartKey: string;
  colors: ColorSpec[];
  blurb: string;
  fit: string;
  care: string;
  seoTitle: string;
  seoDescription: string;
  /** graphic description, used for alt text */
  frontAlt: string;
  backAlt: string;
  /** which view carries the graphic, and therefore leads the gallery */
  lead: 'front' | 'back';
  new?: boolean;
}

const TEE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const DENIM_SIZES = ['28', '30', '32', '34', '36', '38'];

const SPECS: Spec[] = [
  {
    handle: 'nova-star-tee',
    lead: 'back' as const,
    title: 'Nova Star Tee',
    productType: 'Tees',
    tags: ['tee', 'graphic', 'star', 'core'],
    price: 58,
    weight: 220,
    skuType: 'NST',
    sizeChartKey: 'unisex-tops',
    new: true,
    colors: [
      {
        name: 'Charcoal',
        slug: 'charcoal',
        swatch: '#353131',
        sizes: TEE_SIZES,
        stock: { XS: 'low', XXL: 'out' },
      },
      { name: 'Bone', slug: 'bone', swatch: '#cec4af', sizes: TEE_SIZES, stock: { S: 'low' } },
      // Black was only drawn in a mid-run. Offering XS/S/XXL would be inventing a size run.
      { name: 'Black', slug: 'black', swatch: '#121110', sizes: ['M', 'L', 'XL'], stock: { XL: 'out' } },
    ],
    blurb:
      'The house star, blown out across the full back — a five-point nova cut through with plaid tribal spines and scattered starbursts. Chest carries the PB&B wordmark at 7 inches. Boxy body, dropped shoulder, heavy enough to hang straight instead of clinging.',
    fit: 'Boxy and relaxed. Sits true to size with a wide chest and a short, square body — size down for a closer fit, stay put for the intended drape.',
    care: 'Wash cold inside out. Tumble dry low or hang. Do not iron directly on the print.',
    seoTitle: 'Nova Star Tee — PB&B',
    seoDescription:
      'Boxy heavyweight tee with a full-back nova star graphic and 7in chest wordmark. Charcoal, bone and black. Unisex XS–XXL.',
    frontAlt: 'chest with the PB&B wordmark printed 7 inches wide',
    backAlt: 'full back print of an orange five-point nova star with magenta plaid tribal spines',
  },
  {
    handle: 'moth-tee',
    lead: 'back' as const,
    title: 'Moth Tee',
    productType: 'Tees',
    tags: ['tee', 'graphic', 'moth', 'core'],
    price: 58,
    weight: 220,
    skuType: 'MTH',
    sizeChartKey: 'unisex-tops',
    new: true,
    colors: [
      { name: 'Charcoal', slug: 'charcoal', swatch: '#353131', sizes: TEE_SIZES, stock: { M: 'low' } },
      { name: 'Grey', slug: 'grey', swatch: '#8b8b88', sizes: TEE_SIZES, stock: { XS: 'out', S: 'out' } },
      { name: 'Bone', slug: 'bone', swatch: '#ede9e0', sizes: ['S', 'M', 'L', 'XL'], stock: {} },
    ],
    blurb:
      'A split-winged moth spread shoulder to shoulder, drawn in bone and berry with barbed wingtips and a scatter of small stars. Wordmark on the chest. Same boxy body as the Nova Star.',
    fit: 'Boxy and relaxed, identical block to the Nova Star Tee. True to size.',
    care: 'Wash cold inside out. Tumble dry low or hang. Do not iron directly on the print.',
    seoTitle: 'Moth Tee — PB&B',
    seoDescription:
      'Boxy heavyweight tee with a shoulder-to-shoulder moth back print in bone and berry. Charcoal, grey and bone. Unisex XS–XXL.',
    frontAlt: 'chest with the PB&B wordmark',
    backAlt: 'full back print of a split-winged moth in bone and berry with barbed wingtips',
  },
  {
    handle: 'nova-star-zip-hoodie',
    lead: 'front' as const,
    title: 'Nova Star Zip Hoodie',
    productType: 'Hoodies',
    tags: ['hoodie', 'zip', 'star', 'heavyweight'],
    price: 145,
    weight: 850,
    skuType: 'NSZ',
    sizeChartKey: 'unisex-tops',
    new: true,
    colors: [
      {
        name: 'Charcoal',
        slug: 'charcoal',
        swatch: '#353131',
        sizes: TEE_SIZES,
        stock: { XS: 'out', S: 'low', XXL: 'out' },
      },
    ],
    blurb:
      'Cropped, boxy full-zip with the nova star carried across the chest and split by the zip line. Wordmark across the back hem. Ribbed cuffs with a studded edge, kangaroo pocket, heavy fleece body that holds its shape.',
    fit: 'Cropped and boxy with a wide sleeve. Sits above the hip. Take your usual size for the intended cropped line, or size up to wear it long.',
    care: 'Wash cold inside out. Hang to dry. Do not iron directly on the print.',
    seoTitle: 'Nova Star Zip Hoodie — PB&B',
    seoDescription:
      'Cropped boxy full-zip hoodie in heavy fleece with a split nova star chest graphic and back-hem wordmark. Charcoal. Unisex XS–XXL.',
    frontAlt: 'cropped full-zip hoodie with the nova star graphic split across the zip line',
    backAlt: 'back of the cropped hoodie with the PB&B wordmark across the hem',
  },
  {
    handle: 'ironwork-zip-hoodie',
    lead: 'back' as const,
    title: 'Ironwork Zip Hoodie',
    productType: 'Hoodies',
    tags: ['hoodie', 'zip', 'moth', 'heavyweight'],
    price: 145,
    weight: 850,
    skuType: 'IWZ',
    sizeChartKey: 'unisex-tops',
    new: true,
    colors: [
      { name: 'Charcoal', slug: 'charcoal', swatch: '#353131', sizes: TEE_SIZES, stock: { XS: 'low', XL: 'out' } },
    ],
    blurb:
      'The moth reworked as wrought ironwork across the full back, all barbs and curled points in bone and deep berry. Wordmark in berry across the chest. Same cropped heavyweight zip body as the Nova Star.',
    fit: 'Cropped and boxy with a wide sleeve. Sits above the hip. True to size.',
    care: 'Wash cold inside out. Hang to dry. Do not iron directly on the print.',
    seoTitle: 'Ironwork Zip Hoodie — PB&B',
    seoDescription:
      'Cropped heavyweight full-zip hoodie with a wrought-iron moth back print in bone and berry. Charcoal. Unisex XS–XXL.',
    frontAlt: 'cropped full-zip hoodie with the PB&B wordmark in berry across the chest',
    backAlt: 'full back print of a wrought-iron moth motif in bone and deep berry',
  },
  {
    handle: 'filigree-jean',
    lead: 'front' as const,
    title: 'Filigree Jean',
    productType: 'Bottoms',
    tags: ['denim', 'bottoms', 'baggy', 'filigree'],
    price: 165,
    weight: 700,
    skuType: 'FIL',
    sizeChartKey: 'unisex-bottoms',
    new: true,
    colors: [
      {
        name: 'Washed Black',
        slug: 'washed-black',
        swatch: '#2b2927',
        sizes: DENIM_SIZES,
        stock: { '28': 'out', '30': 'low', '38': 'out' },
      },
    ],
    blurb:
      'Baggy five-pocket denim in a washed black, with pink filigree scrollwork climbing the outer leg front and back. Full straight leg from the knee down, stacked over the shoe. Leather patch at the back waist.',
    fit: 'Baggy through the hip and thigh with a full straight leg. Sits at the natural waist. Take your true waist measurement — the volume is in the leg, not the waistband.',
    care: 'Wash cold inside out, separately for the first few washes. Hang to dry.',
    seoTitle: 'Filigree Jean — PB&B',
    seoDescription:
      'Baggy washed-black five-pocket denim with pink filigree scrollwork up the outer leg. Waist 28–38.',
    frontAlt: 'front of baggy washed-black jeans with pink filigree scrollwork on the leg',
    backAlt: 'back of baggy washed-black jeans with filigree scrollwork and a leather waist patch',
  },
  {
    handle: 'pbnb-oval-sticker',
    lead: 'front' as const,
    title: 'PB&B Oval Sticker',
    productType: 'Accessories',
    tags: ['sticker', 'accessory'],
    price: 6,
    weight: 10,
    skuType: 'STK',
    sizeChartKey: '',
    colors: [{ name: 'Berry', slug: 'berry', swatch: '#a8174c', sizes: ['One Size'], stock: {} }],
    blurb:
      'Die-cut oval sticker. Berry wordmark on bone, ringed in berry, with the stars and fruit scattered around the border. Weatherproof vinyl.',
    fit: '',
    care: 'Apply to a clean, dry surface.',
    seoTitle: 'PB&B Oval Sticker',
    seoDescription: 'Die-cut weatherproof vinyl oval sticker. Berry PB&B wordmark on bone.',
    frontAlt: 'oval PB&B sticker, berry wordmark on bone with a berry border ring',
    backAlt: '',
  },
];

/* ------------------------------------------------------------------------ */
/* Expansion                                                                 */
/* ------------------------------------------------------------------------ */

const QTY: Record<StockState, number> = { ok: 24, low: 3, out: 0 };

function imagesFor(spec: Spec, color: ColorSpec): ImageRef[] {
  const base = `${IMG}/pbnb-${spec.handle.replace('pbnb-', '')}-${color.slug}`;
  if (spec.handle === 'pbnb-oval-sticker') {
    return [{ url: `${IMG}/pbnb-oval-sticker-01.webp`, altText: `${spec.title} — ${spec.frontAlt}`, width: 1600, height: 1600 }];
  }
  // Hoodie/jean/tee files were named by garment, not by product handle.
  const stem =
    spec.handle === 'nova-star-zip-hoodie'
      ? 'nova-star-hoodie'
      : spec.handle === 'ironwork-zip-hoodie'
        ? 'ironwork-hoodie'
        : spec.handle;
  const b = `${IMG}/pbnb-${stem}-${color.slug}`;
  void base;
  // The graphic leads, and which side carries it varies by garment: the Nova
  // Star hoodie prints on the chest, the tees and the Ironwork hoodie print on
  // the back. Leading with the plain side would make every card look alike.
  const front = {
    url: `${b}-front.webp`,
    altText: `${spec.title} in ${color.name} — ${spec.frontAlt}`,
    width: 1600,
    height: 1600,
  };
  const back = {
    url: `${b}-back.webp`,
    altText: `${spec.title} in ${color.name} — ${spec.backAlt}`,
    width: 1600,
    height: 1600,
  };
  return spec.lead === 'front' ? [front, back] : [back, front];
}

function buildProduct(spec: Spec): Product {
  const variants: Variant[] = [];
  const imagesByColor: Record<string, ImageRef[]> = {};
  const allImages: ImageRef[] = [];

  for (const color of spec.colors) {
    const imgs = imagesFor(spec, color);
    imagesByColor[color.name] = imgs;
    allImages.push(...imgs);
    for (const size of color.sizes) {
      const state: StockState = color.stock?.[size] ?? 'ok';
      const qty = QTY[state];
      variants.push({
        id: `gid://shopify/ProductVariant/${spec.skuType}-${color.slug}-${size}`,
        title: spec.handle === 'pbnb-oval-sticker' ? color.name : `${color.name} / ${size}`,
        sku: `PBB-${spec.skuType}-${color.slug.slice(0, 3).toUpperCase()}-${size}`,
        availableForSale: qty > 0,
        quantityAvailable: qty,
        currentlyNotInStock: qty === 0,
        selectedOptions:
          spec.handle === 'pbnb-oval-sticker'
            ? [{ name: 'Color', value: color.name }]
            : [
                { name: 'Color', value: color.name },
                { name: 'Size', value: size },
              ],
        price: { amount: spec.price.toFixed(2), currencyCode: 'USD' },
        compareAtPrice: null,
        image: imgs[0] ?? null,
        weight: spec.weight,
        weightUnit: 'GRAMS',
      });
    }
  }

  const sizeValues = Array.from(
    new Set(spec.colors.flatMap((c) => c.sizes)),
  );

  const description = [
    spec.blurb,
    '',
    `Fabric: [FABRIC: FILL] — no care label exists in the archive to transcribe.`,
    spec.fit ? `Fit: ${spec.fit}` : '',
    `Care: ${spec.care}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    id: `gid://shopify/Product/${spec.skuType}`,
    handle: spec.handle,
    title: spec.title,
    description,
    descriptionHtml: description
      .split('\n\n')
      .map((p) => `<p>${p}</p>`)
      .join(''),
    productType: spec.productType,
    tags: [...spec.tags, ...(spec.new ? ['new'] : [])],
    vendor: 'PB&B',
    availableForSale: variants.some((v) => v.availableForSale),
    featuredImage: allImages[0] ?? null,
    images: allImages,
    options:
      spec.handle === 'pbnb-oval-sticker'
        ? [{ id: 'opt-color', name: 'Color', values: spec.colors.map((c) => c.name) }]
        : [
            { id: 'opt-color', name: 'Color', values: spec.colors.map((c) => c.name) },
            { id: 'opt-size', name: 'Size', values: sizeValues },
          ],
    variants,
    priceRange: {
      minVariantPrice: { amount: spec.price.toFixed(2), currencyCode: 'USD' },
      maxVariantPrice: { amount: spec.price.toFixed(2), currencyCode: 'USD' },
    },
    seo: { title: spec.seoTitle, description: spec.seoDescription },
    imagesByColor,
    fit: spec.fit || null,
    fabric: '[FABRIC: FILL]',
    care: spec.care,
    modelInfo:
      spec.productType === 'Accessories'
        ? null
        : '[FILL] Model height and size worn — no on-model photography exists yet.',
    sizeChartKey: spec.sizeChartKey || null,
  };
}

export const FIXTURE_PRODUCTS: Product[] = SPECS.map(buildProduct);

export const COLOR_SWATCHES: Record<string, string> = Object.fromEntries(
  SPECS.flatMap((s) => s.colors.map((c) => [c.name, c.swatch])),
);

/* ------------------------------------------------------------------------ */
/* Collections — built only from garment types that actually exist.          */
/* No empty collections.                                                     */
/* ------------------------------------------------------------------------ */

export interface FixtureCollection {
  handle: string;
  title: string;
  description: string;
  match: (p: Product) => boolean;
}

export const FIXTURE_COLLECTIONS: FixtureCollection[] = [
  {
    handle: 'all',
    title: 'Everything',
    description: 'The full PB&B range.',
    match: () => true,
  },
  {
    handle: 'new',
    title: 'New',
    description: 'The most recent drop.',
    match: (p) => p.tags.includes('new'),
  },
  {
    handle: 'tees',
    title: 'Tees',
    description: 'Boxy heavyweight tees with full-back graphics.',
    match: (p) => p.productType === 'Tees',
  },
  {
    handle: 'hoodies',
    title: 'Hoodies',
    description: 'Cropped heavyweight full-zip fleece.',
    match: (p) => p.productType === 'Hoodies',
  },
  {
    handle: 'bottoms',
    title: 'Bottoms',
    description: 'Baggy denim, printed and washed.',
    match: (p) => p.productType === 'Bottoms',
  },
  {
    handle: 'accessories',
    title: 'Accessories',
    description: 'Stickers and small goods.',
    match: (p) => p.productType === 'Accessories',
  },
];
