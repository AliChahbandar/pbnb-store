/**
 * Storefront API documents, written against 2026-07.
 *
 * Field choices worth knowing about:
 *  - `ProductOption.values` is deprecated; we select `optionValues { id name }`.
 *  - `ProductVariant.quantityAvailable` requires the
 *    `unauthenticated_read_product_inventory` scope on the Storefront token.
 *    Without it Shopify returns an error for that field, so the low-stock
 *    indicator degrades to "in stock / sold out" only. See DECISIONS.md.
 *  - Cart mutation payloads expose `warnings` in addition to `userErrors`;
 *    we select both so throttling//inventory notices surface.
 */

export const IMAGE_FIELDS = `
  url
  altText
  width
  height
`;

export const VARIANT_FIELDS = `
  id
  title
  sku
  availableForSale
  quantityAvailable
  currentlyNotInStock
  selectedOptions { name value }
  price { amount currencyCode }
  compareAtPrice { amount currencyCode }
  weight
  weightUnit
  image { ${IMAGE_FIELDS} }
`;

export const PRODUCT_CARD_FIELDS = `
  id
  handle
  title
  productType
  tags
  vendor
  availableForSale
  featuredImage { ${IMAGE_FIELDS} }
  priceRange {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
  options { id name optionValues { id name } }
  variants(first: 100) { nodes { ${VARIANT_FIELDS} } }
`;

export const PRODUCT_FULL_FIELDS = `
  ${PRODUCT_CARD_FIELDS}
  description
  descriptionHtml
  seo { title description }
  images(first: 40) { nodes { ${IMAGE_FIELDS} } }
  fit: metafield(namespace: "pbnb", key: "fit_notes") { value }
  fabric: metafield(namespace: "pbnb", key: "fabric_composition") { value }
  care: metafield(namespace: "pbnb", key: "care_instructions") { value }
  modelInfo: metafield(namespace: "pbnb", key: "model_info") { value }
  sizeChart: metafield(namespace: "pbnb", key: "size_chart") {
    reference {
      ... on Metaobject {
        handle
        fields { key value }
      }
    }
  }
`;

export const GET_PRODUCT = `
  query GetProduct($handle: String!) {
    product(handle: $handle) {
      ${PRODUCT_FULL_FIELDS}
    }
  }
`;

export const GET_COLLECTION = `
  query GetCollection(
    $handle: String!
    $first: Int!
    $after: String
    $filters: [ProductFilter!]
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      seo { title description }
      image { ${IMAGE_FIELDS} }
      products(first: $first, after: $after, filters: $filters, sortKey: $sortKey, reverse: $reverse) {
        nodes { ${PRODUCT_CARD_FIELDS} }
        pageInfo { hasNextPage hasPreviousPage endCursor startCursor }
        filters {
          id
          label
          type
          values { id label count input }
        }
      }
    }
  }
`;

export const GET_COLLECTIONS = `
  query GetCollections($first: Int!) {
    collections(first: $first) {
      nodes {
        id
        handle
        title
        description
        image { ${IMAGE_FIELDS} }
      }
    }
  }
`;

export const SEARCH_PRODUCTS = `
  query SearchProducts($query: String!, $first: Int!, $after: String) {
    search(query: $query, first: $first, after: $after, types: [PRODUCT], prefix: LAST) {
      totalCount
      nodes { ... on Product { ${PRODUCT_CARD_FIELDS} } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/* -------------------------------------------------------------------------
   Cart
   ------------------------------------------------------------------------- */

export const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount { amount currencyCode }
    totalAmount { amount currencyCode }
    totalTaxAmount { amount currencyCode }
  }
  lines(first: 100) {
    nodes {
      id
      quantity
      cost {
        totalAmount { amount currencyCode }
        amountPerQuantity { amount currencyCode }
      }
      merchandise {
        ... on ProductVariant {
          id
          title
          selectedOptions { name value }
          image { ${IMAGE_FIELDS} }
          price { amount currencyCode }
          product { handle title featuredImage { ${IMAGE_FIELDS} } }
        }
      }
    }
  }
`;

export const CART_CREATE = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
      warnings { code message target }
    }
  }
`;

export const GET_CART = `
  query GetCart($id: ID!) {
    cart(id: $id) { ${CART_FIELDS} }
  }
`;

export const CART_LINES_ADD = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
      warnings { code message target }
    }
  }
`;

export const CART_LINES_UPDATE = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
      warnings { code message target }
    }
  }
`;

export const CART_LINES_REMOVE = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ${CART_FIELDS} }
      userErrors { field message }
      warnings { code message target }
    }
  }
`;

/* -------------------------------------------------------------------------
   Metaobjects — editable copy lives in Shopify, never in this repo.
   ------------------------------------------------------------------------- */

export const GET_METAOBJECTS = `
  query GetMetaobjects($type: String!, $first: Int!) {
    metaobjects(type: $type, first: $first) {
      nodes {
        id
        handle
        type
        fields { key value type }
      }
    }
  }
`;

export const GET_METAOBJECT = `
  query GetMetaobject($handle: MetaobjectHandleInput!) {
    metaobject(handle: $handle) {
      id
      handle
      type
      fields { key value type }
    }
  }
`;
