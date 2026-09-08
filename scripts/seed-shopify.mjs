#!/usr/bin/env node
/**
 * One-shot Shopify seed: content model (Phase 1) + catalogue (Phase 2).
 *
 *   node scripts/seed-shopify.mjs --dry-run     # print what would happen
 *   node scripts/seed-shopify.mjs --model       # metaobject + metafield definitions
 *   node scripts/seed-shopify.mjs --catalog     # size charts, images, products
 *   node scripts/seed-shopify.mjs --all
 *
 * Requires SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN in .env.
 * The Admin token is read here and nowhere else — it never reaches src/.
 *
 * Mutation shapes verified against shopify.dev for API 2026-07:
 *   - productCreate no longer accepts variants. `productSet` creates a product
 *     with productOptions + variants + files in one call, and takes a per-variant
 *     `file` for variant→media association. That is what makes the gallery swap
 *     on colour selection without any JavaScript faking it.
 *   - stagedUploadsCreate returns {url, resourceUrl, parameters[]}; you POST the
 *     file to `url` as multipart with those parameters, then pass `resourceUrl`
 *     as `originalSource`. A separate fileCreate call is only needed for
 *     standalone files, not for media attached during productSet.
 *   - Metaobject definitions need access.storefront = PUBLIC_READ or the
 *     Storefront API cannot read them.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_VERSION = '2026-07';

/* ---------------------------------------------------------------- env ---- */
async function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (existsSync(f)) {
    for (const line of (await readFile(f, 'utf8')).split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) {
    console.error(
      'Missing credentials.\n' +
        '  SHOPIFY_STORE_DOMAIN  e.g. pbnb-store.myshopify.com\n' +
        '  SHOPIFY_ADMIN_TOKEN   custom app token, scopes:\n' +
        '                        write_products, read_products, write_files,\n' +
        '                        write_inventory, write_metaobject_definitions,\n' +
        '                        write_metaobjects',
    );
    process.exit(1);
  }
  return { domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''), token };
}

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const DO_MODEL = args.has('--model') || args.has('--all');
const DO_CATALOG = args.has('--catalog') || args.has('--all');

let ENV;
async function admin(query, variables = {}) {
  if (DRY) {
    const name = query.match(/mutation\s+(\w+)|query\s+(\w+)/)?.slice(1).find(Boolean) ?? 'op';
    console.log(`  [dry-run] ${name}`, JSON.stringify(variables).slice(0, 160));
    return { data: {} };
  }
  const res = await fetch(`https://${ENV.domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': ENV.token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  // Surface userErrors from whichever mutation ran.
  for (const payload of Object.values(json.data ?? {})) {
    const ue = payload?.userErrors;
    if (Array.isArray(ue) && ue.length) throw new Error(JSON.stringify(ue, null, 2));
  }
  return json;
}

/* ------------------------------------------------------- Phase 1: model -- */

const METAOBJECT_DEFS = [
  {
    name: 'Size chart',
    type: 'size_chart',
    description: 'A measurement table. Tops and bottoms use different columns, so each chart carries its own column set.',
    fieldDefinitions: [
      { key: 'title', name: 'Title', type: 'single_line_text_field', required: true },
      { key: 'kind', name: 'Kind', type: 'single_line_text_field', required: true,
        validations: [{ name: 'choices', value: JSON.stringify(['top', 'bottom']) }] },
      { key: 'unit', name: 'Unit', type: 'single_line_text_field', required: true },
      { key: 'columns', name: 'Columns', type: 'json', required: true },
      { key: 'rows', name: 'Rows', type: 'json', required: true },
      { key: 'note', name: 'Note', type: 'multi_line_text_field' },
    ],
  },
  {
    name: 'Homepage section',
    type: 'homepage_section',
    description: 'An editable block on the homepage. Position orders them.',
    fieldDefinitions: [
      { key: 'position', name: 'Position', type: 'number_integer', required: true },
      { key: 'layout', name: 'Layout', type: 'single_line_text_field', required: true,
        validations: [{ name: 'choices', value: JSON.stringify(['hero', 'grid', 'editorial', 'promise']) }] },
      { key: 'eyebrow', name: 'Eyebrow', type: 'single_line_text_field' },
      { key: 'heading', name: 'Heading', type: 'single_line_text_field' },
      { key: 'body', name: 'Body', type: 'multi_line_text_field' },
      { key: 'cta_label', name: 'CTA label', type: 'single_line_text_field' },
      { key: 'cta_url', name: 'CTA url', type: 'url' },
      { key: 'image', name: 'Image', type: 'file_reference' },
      { key: 'collection', name: 'Collection', type: 'collection_reference' },
      { key: 'enabled', name: 'Enabled', type: 'boolean' },
    ],
  },
  {
    name: 'FAQ entry',
    type: 'faq_entry',
    fieldDefinitions: [
      { key: 'position', name: 'Position', type: 'number_integer', required: true },
      { key: 'question', name: 'Question', type: 'single_line_text_field', required: true },
      { key: 'answer', name: 'Answer', type: 'multi_line_text_field', required: true },
      { key: 'category', name: 'Category', type: 'single_line_text_field' },
    ],
  },
  {
    name: 'About page content',
    type: 'about_content',
    fieldDefinitions: [
      { key: 'position', name: 'Position', type: 'number_integer', required: true },
      { key: 'heading', name: 'Heading', type: 'single_line_text_field' },
      { key: 'body', name: 'Body', type: 'multi_line_text_field', required: true },
      { key: 'image', name: 'Image', type: 'file_reference' },
    ],
  },
  {
    name: 'Announcement bar',
    type: 'announcement_bar',
    description: 'The strip above the header. Handle "current" is the one the site reads.',
    fieldDefinitions: [
      { key: 'enabled', name: 'Enabled', type: 'boolean', required: true },
      { key: 'message', name: 'Message', type: 'single_line_text_field', required: true },
      { key: 'link', name: 'Link', type: 'url' },
    ],
  },
];

const METAFIELD_DEFS = [
  { key: 'fabric_composition', name: 'Fabric composition', type: 'single_line_text_field',
    description: 'Exact composition as printed on the garment label. This is a labelling claim — transcribe, never estimate.' },
  { key: 'care_instructions', name: 'Care instructions', type: 'multi_line_text_field' },
  { key: 'fit_notes', name: 'Fit notes', type: 'multi_line_text_field' },
  { key: 'model_info', name: 'Model info', type: 'single_line_text_field',
    description: 'Model height and the size they are wearing.' },
  { key: 'gsm', name: 'Fabric weight (GSM)', type: 'number_integer' },
  { key: 'size_chart', name: 'Size chart', type: 'metaobject_reference',
    validations: [{ name: 'metaobject_definition_type', value: 'size_chart' }] },
];

const M_DEF_CREATE = `
  mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type }
      userErrors { field message code }
    }
  }`;

const MF_DEF_CREATE = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id key namespace }
      userErrors { field message code }
    }
  }`;

async function seedModel() {
  console.log('\n== Phase 1: content model ==');
  for (const def of METAOBJECT_DEFS) {
    process.stdout.write(`  metaobject ${def.type} ... `);
    try {
      await admin(M_DEF_CREATE, {
        definition: {
          ...def,
          // Without PUBLIC_READ the Storefront API cannot see these at all.
          access: { admin: 'MERCHANT_READ_WRITE', storefront: 'PUBLIC_READ' },
        },
      });
      console.log('created');
    } catch (e) {
      console.log(String(e).includes('TAKEN') ? 'already exists' : `FAILED\n${e}`);
    }
  }
  for (const def of METAFIELD_DEFS) {
    process.stdout.write(`  metafield pbnb.${def.key} ... `);
    try {
      await admin(MF_DEF_CREATE, {
        definition: {
          ...def,
          namespace: 'pbnb',
          ownerType: 'PRODUCT',
          access: { storefront: 'PUBLIC_READ' },
        },
      });
      console.log('created');
    } catch (e) {
      console.log(String(e).includes('TAKEN') ? 'already exists' : `FAILED\n${e}`);
    }
  }
}

/* ----------------------------------------------------- Phase 2: catalog -- */

const STAGED = `
  mutation StagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

const PRODUCT_SET = `
  mutation SetProduct($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product { id handle title status
        variants(first: 100) { nodes { id sku title } }
        media(first: 40) { nodes { ... on MediaImage { id } } } }
      userErrors { field message code }
    }
  }`;

const MO_CREATE = `
  mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle type }
      userErrors { field message code }
    }
  }`;

/** Stage one local file and return the resourceUrl to hand to productSet. */
async function uploadImage(filePath) {
  const filename = path.basename(filePath);
  const body = await readFile(filePath);
  if (DRY) {
    console.log(`  [dry-run] upload ${filename} (${body.length} bytes)`);
    return `dry://${filename}`;
  }
  const staged = await admin(STAGED, {
    input: [
      {
        filename,
        mimeType: filename.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
        resource: 'PRODUCT_IMAGE',
        httpMethod: 'POST',
        fileSize: String(body.length),
      },
    ],
  });
  const target = staged.data.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const p of target.parameters) form.append(p.name, p.value);
  form.append('file', new Blob([body]), filename);
  const up = await fetch(target.url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`upload failed ${up.status} for ${filename}: ${await up.text()}`);
  return target.resourceUrl;
}

async function seedCatalog() {
  console.log('\n== Phase 2: size charts, images, products ==');

  // Reuse the exact fixture data the site already renders.
  const fx = await import(path.join(ROOT, 'src/lib/fixtures.ts')).catch(() => null);
  if (!fx) {
    console.error(
      '  Could not import src/lib/fixtures.ts directly (it is TypeScript).\n' +
        '  Run with a TS loader, e.g.:  node --experimental-strip-types scripts/seed-shopify.mjs --catalog',
    );
    process.exit(1);
  }
  const { SIZE_CHARTS, FIXTURE_PRODUCTS } = fx;

  // -- size charts ---------------------------------------------------------
  const chartIds = {};
  for (const chart of Object.values(SIZE_CHARTS)) {
    process.stdout.write(`  size chart ${chart.key} ... `);
    try {
      const r = await admin(MO_CREATE, {
        metaobject: {
          type: 'size_chart',
          handle: chart.key,
          fields: [
            { key: 'title', value: chart.title },
            { key: 'kind', value: chart.kind },
            { key: 'unit', value: chart.unit },
            { key: 'columns', value: JSON.stringify(chart.columns) },
            { key: 'rows', value: JSON.stringify(chart.rows) },
            { key: 'note', value: chart.note ?? '' },
          ],
        },
      });
      chartIds[chart.key] = r.data?.metaobjectCreate?.metaobject?.id;
      console.log('created');
    } catch (e) {
      console.log(String(e).includes('TAKEN') ? 'already exists' : `FAILED\n${e}`);
    }
  }

  // -- announcement bar ----------------------------------------------------
  try {
    await admin(MO_CREATE, {
      metaobject: {
        type: 'announcement_bar',
        handle: 'current',
        fields: [
          { key: 'enabled', value: 'true' },
          { key: 'message', value: 'Free US shipping over $150 · Exchanges are free within 30 days' },
          { key: 'link', value: 'https://pbnb.store/policies/shipping' },
        ],
      },
    });
    console.log('  announcement bar ... created');
  } catch {
    console.log('  announcement bar ... already exists');
  }

  // -- products ------------------------------------------------------------
  const imgDir = path.join(ROOT, 'public/product-designs');
  const available = new Set(await readdir(imgDir));
  const uploaded = new Map(); // local filename -> resourceUrl

  for (const product of FIXTURE_PRODUCTS) {
    console.log(`\n  ${product.title}`);

    // Upload each colourway's images once.
    const byColor = product.imagesByColor ?? {};
    const fileFor = {};
    for (const [color, imgs] of Object.entries(byColor)) {
      fileFor[color] = [];
      for (const img of imgs) {
        const name = path.basename(img.url);
        if (!available.has(name)) {
          console.log(`    ! missing image ${name} — skipped`);
          continue;
        }
        if (!uploaded.has(name)) {
          uploaded.set(name, await uploadImage(path.join(imgDir, name)));
          console.log(`    uploaded ${name}`);
        }
        fileFor[color].push({
          originalSource: uploaded.get(name),
          alt: img.altText ?? product.title,
          filename: name,
          contentType: 'IMAGE',
        });
      }
    }

    const productOptions = product.options.map((o, i) => ({
      name: o.name,
      position: i + 1,
      values: o.values.map((v) => ({ name: v })),
    }));

    const variants = product.variants.map((v) => {
      const color = v.selectedOptions.find((o) => o.name === 'Color')?.value;
      return {
        optionValues: v.selectedOptions.map((o) => ({ optionName: o.name, name: o.value })),
        sku: v.sku,
        price: v.price.amount,
        // Every variant starts at zero. Real counts get loaded separately.
        inventoryPolicy: 'DENY',
        inventoryItem: { tracked: true, measurement: { weight: { value: v.weight, unit: 'GRAMS' } } },
        // Variant → media. This is what drives the gallery swap on colour change.
        file: color && fileFor[color]?.[0] ? fileFor[color][0] : undefined,
      };
    });

    const input = {
      title: product.title,
      handle: product.handle,
      descriptionHtml: product.descriptionHtml,
      productType: product.productType,
      vendor: 'PB&B',
      tags: product.tags,
      status: 'DRAFT', // never ACTIVE from a script
      seo: { title: product.seo.title, description: product.seo.description },
      productOptions,
      variants,
      files: Object.values(fileFor).flat(),
      metafields: [
        { namespace: 'pbnb', key: 'fabric_composition', type: 'single_line_text_field', value: product.fabric ?? '[FABRIC: FILL]' },
        { namespace: 'pbnb', key: 'care_instructions', type: 'multi_line_text_field', value: product.care ?? '' },
        { namespace: 'pbnb', key: 'fit_notes', type: 'multi_line_text_field', value: product.fit ?? '' },
        ...(product.sizeChartKey && chartIds[product.sizeChartKey]
          ? [{ namespace: 'pbnb', key: 'size_chart', type: 'metaobject_reference', value: chartIds[product.sizeChartKey] }]
          : []),
      ].filter((m) => m.value),
    };

    try {
      const r = await admin(PRODUCT_SET, { input, synchronous: true });
      const p = r.data?.productSet?.product;
      console.log(`    created ${p?.handle ?? product.handle} — ${variants.length} variants, status DRAFT`);
    } catch (e) {
      console.log(`    FAILED\n${e}`);
    }
  }
}

/* --------------------------------------------------------------- main ---- */
(async () => {
  ENV = await loadEnv();
  if (!DO_MODEL && !DO_CATALOG) {
    console.log('Nothing to do. Pass --model, --catalog, or --all (add --dry-run to preview).');
    process.exit(0);
  }
  console.log(`Store: ${ENV.domain}   API: ${API_VERSION}${DRY ? '   (DRY RUN)' : ''}`);
  if (DO_MODEL) await seedModel();
  if (DO_CATALOG) await seedCatalog();
  console.log('\nDone. Products are DRAFT and every variant is at 0 inventory.');
})();
