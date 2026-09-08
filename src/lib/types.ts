/** Types mirroring the Storefront API shapes we actually select. */

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ImageRef {
  url: string;
  altText: string | null;
  width?: number | null;
  height?: number | null;
}

export interface Variant {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  /** Requires the unauthenticated_read_product_inventory scope. Null without it. */
  quantityAvailable: number | null;
  currentlyNotInStock: boolean;
  selectedOptions: SelectedOption[];
  price: Money;
  compareAtPrice: Money | null;
  image: ImageRef | null;
  weight: number | null;
  weightUnit: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
  /** optionValues on the 2026-07 schema; `values` kept for compatibility. */
  values: string[];
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  productType: string;
  tags: string[];
  vendor: string;
  availableForSale: boolean;
  featuredImage: ImageRef | null;
  images: ImageRef[];
  options: ProductOption[];
  variants: Variant[];
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  seo: { title: string | null; description: string | null };
  /** Colour -> ordered image list. Drives the gallery swap on colour change. */
  imagesByColor?: Record<string, ImageRef[]>;
  /** Editorial fields that live in Shopify metafields once the model exists. */
  fit?: string | null;
  fabric?: string | null;
  care?: string | null;
  modelInfo?: string | null;
  sizeChartKey?: string | null;
}

export interface Collection {
  id: string;
  handle: string;
  title: string;
  description: string;
  image: ImageRef | null;
  products: Product[];
  seo: { title: string | null; description: string | null };
}

export interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    selectedOptions: SelectedOption[];
    image: ImageRef | null;
    price: Money;
    product: { handle: string; title: string; featuredImage: ImageRef | null };
  };
  cost: { totalAmount: Money; amountPerQuantity: Money };
}

export interface Cart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
}

export interface SizeChartRow {
  size: string;
  /** inches */
  chest?: number;
  length?: number;
  sleeve?: number;
  waist?: number;
  inseam?: number;
  rise?: number;
  /** false when the row is graded rather than measured off a real garment */
  measured: boolean;
}

export interface SizeChart {
  key: string;
  title: string;
  unit: 'in';
  kind: 'top' | 'bottom';
  columns: string[];
  rows: SizeChartRow[];
  note?: string;
}

export interface FilterFacet {
  name: string;
  values: Array<{ value: string; count: number }>;
}
