# DECISIONS

Every non-obvious call made while building this, and why.

---

## 0. The two things that block Shopify work

**No credentials exist.** There is no `.env`, and none of `SHOPIFY_STORE_DOMAIN`,
`SHOPIFY_STOREFRONT_TOKEN` or `SHOPIFY_ADMIN_TOKEN` are set anywhere. Every phase
that writes to or reads from Shopify is therefore blocked. What's needed is listed
at the bottom of this file.

**There is no product photography.** The brief describes `./assets-raw/` holding
unsorted iPhone exports with hangtags and care labels to transcribe. What actually
exists is 57 Procreate drawings sitting loose in the project root — brand lockups,
sticker art, and technical garment flats. No photographs, no labels, no fabric
composition to read. See `IMAGE-INVENTORY.md`.

Consequences, and how each was handled:

| Brief expected | Reality | Decision |
|---|---|---|
| Transcribe fabric from care labels | No labels exist | `[FABRIC: FILL]` everywhere. Composition is a labelling claim; inventing it would put you on the hook. |
| Country of manufacture from labels | Not present | Left blank, flagged `[FILL]` on the about page. |
| GSM / fabric weight | Not present | Omitted. A `pbnb.gsm` metafield is defined and ready. |
| Group photos by colourway | Flats, not photos | Grouped by drawn colourway. Only colourways actually drawn exist as variants. |
| Lead with the strongest on-model shot | No on-model shots | Lead with the view carrying the graphic; set per product. |
| Model height / size worn | No model | `[FILL]` on every garment. |

**The artwork was moved.** The 57 PNGs were loose in the project root. They were
moved into `assets-raw/` — which the brief assumed they were already in — and that
directory is gitignored. Originals are never committed.

---

## 1. Platform and versions

**Shopify API pinned to `2026-07`.** Verified on shopify.dev rather than assumed.
As of September 2026 the version table lists releases through 2027-01, but those are
*scheduled*, not shipped. `2026-07` (released 1 Jul 2026) is the latest **stable**;
`2026-10` exists only as a release candidate and Shopify explicitly does not
recommend RCs for production. The Storefront API reference page's own examples use
`2026-07`, which confirms it.

**Astro 7.3.1 + `@astrojs/cloudflare` 14.3.0 + `@astrojs/sitemap` 3.7.4.**

**`output: 'server'` with per-page `prerender = true`.** The Cloudflare docs prose
still mentions `output: 'hybrid'`, but that's stale — checking the installed package's
config schema shows `hybrid` is now actively rejected with a migration error. Only
`'static'` and `'server'` are valid. Server-rendered by default is right here because
inventory, cart and pricing are per-request; the 9 marketing and legal routes opt back
into prerendering.

**`session: false`.** We manage the cart id in our own cookie and never use Astro
sessions. Leaving them on makes the Cloudflare adapter demand a KV binding, and its
generated session-driver module writes the project path into a single-quoted import
string — which is a hard parse error because this project's directory is
`ahmad's website`. Worth knowing generally: **the apostrophe in the folder name is a
landmine for any tool that string-builds paths.** Renaming the directory would remove
a whole class of future breakage.

**No webfonts, no UI framework, no client-side router.** Total JS shipped is two small
inline scripts (variant selection, size-guide dialog). This is most of why Performance
is 99 and TBT is 0 ms.

---

## 2. The Storefront API rate-limit problem — the important architectural call

The brief flagged that the Storefront API "is rate limited by buyer IP and isn't built
for server-side proxying. Architect around it." That's correct and it's the single
biggest design constraint here, so it's worth being precise about the fix.

Shopify identifies a buyer by IP. In a normal theme the browser calls Shopify directly,
so that works by default. We server-render on Cloudflare Workers, which means every
request to Shopify leaves from a small pool of Cloudflare egress addresses. To Shopify
that looks like one extremely busy buyer: throttling, degraded bot protection, and —
per Shopify's own docs — "unauthenticated flows at checkout."

The supported fix (shopify.dev, *make server-side requests with a private access token*)
is two headers:

```
Shopify-Storefront-Private-Token: <private token>   // secret, server-only
Shopify-Storefront-Buyer-IP:      <real buyer IP>   // case-sensitive
```

`src/lib/shopify.ts` implements exactly this. Every call passes the incoming `Request`
through, and the buyer address is read from `CF-Connecting-IP` (falling back to
`X-Forwarded-For`). Build-time prerender calls have no buyer, so the header is
correctly omitted there.

**This means the credential list in the brief is incomplete.** A *private* Storefront
token is needed in addition to the public one. Both are issued by the Headless channel.
The client falls back to the public token with `X-Shopify-Storefront-Access-Token` if
no private token is configured, but that path carries the throttling risk above.

---

## 3. Where the data comes from right now

`src/lib/catalog.ts` is the only read path. When Storefront credentials are present it
queries Shopify; when they aren't, it returns fixtures. **The shapes are identical**, so
nothing downstream changes when the token lands — no rewrite, no migration.

The fixture catalogue (`src/lib/fixtures.ts`) is derived strictly from the drawings.
Fixture filtering re-implements the same `ProductFilter` semantics locally, so
filtering behaves the same with and without a live token.

**Product images are committed to the repo, which the brief said not to do.** This is a
deliberate, temporary exception: images can't live on Shopify's CDN until there's an
Admin token to upload them with, and a storefront with no imagery isn't reviewable.
They're processed, renamed, EXIF-stripped WebP totalling 952 KB.
`scripts/seed-shopify.mjs` uploads them and `shopifyImage()` already applies CDN
transformation params — so the moment the catalogue is live, delete
`public/product-designs/` and the exception reverses.

**Fixture stock is a deliberate demo mix** (in stock / low / sold out / not-offered) so
all four product-page states are reviewable. The seed script sets every *real* variant
to 0, as asked.

---

## 4. Catalogue structure

Six products, 50 variants, from the flats that were actually drawn.

| Product | Type | Colourways | Sizes |
|---|---|---|---|
| Nova Star Tee | Tees | Charcoal, Bone, Black | XS–XXL (Black: M/L/XL only) |
| Moth Tee | Tees | Charcoal, Grey, Bone | XS–XXL (Bone: S–XL only) |
| Nova Star Zip Hoodie | Hoodies | Charcoal | XS–XXL |
| Ironwork Zip Hoodie | Hoodies | Charcoal | XS–XXL |
| Filigree Jean | Bottoms | Washed Black | 28–38 |
| PB&B Oval Sticker | Accessories | Berry | One Size |

**Colourways exist only where a flat was drawn in that colour.** The Black Nova Star
Tee was only drawn in a mid-run, so it's offered in M/L/XL and the other sizes render
as *not offered* rather than *sold out*. Nothing was invented to square the matrix.

**Size runs.** XS–XXL for unisex tops — this is a guess, as the brief permits. The
only hard evidence is the spec sheet's size L. Denim uses waist 28–38 rather than
XS–XXL because that's how baggy five-pockets are actually sold; also a guess.

**Collections** are built only from types that have product: `all`, `new`, `tees`,
`hoodies`, `bottoms`, `accessories`. No empty collections. `new` currently covers all
five garments, since this is Drop 01 and everything in it is new.

**Design iterations were not turned into SKUs.** The green moth, the pink checkered
tribal, the leopard-fill star, the horned hoodie backs and the side-placement moths
each appear once and read as exploration. `IMAGE-INVENTORY.md` lists them — if any
are real products, they're a few lines each to add.

---

## 5. Placeholder prices — all PLACEHOLDER, replace with real unit costs

Priced by garment type, positioned as an independent brand with heavy blanks and
large-format prints. Coherent as a range: an entry sticker, a mid tee, a step to
outerwear.

| Product | Price | Reasoning |
|---|---|---|
| Nova Star Tee | **$58** | Heavyweight boxy tee with a 17×12in back print plus a chest print. Two-location printing on a heavy blank. Independent graphic tees run $45–70; $58 sits mid-band without reading cheap. |
| Moth Tee | **$58** | Same blank, same block, same two-location print. Identical pricing is deliberate — pricing identical garments differently invites suspicion. |
| Nova Star Zip Hoodie | **$145** | Cropped heavyweight full-zip: zip hardware, studded cuff, kangaroo pocket, large print. Independent heavyweight zip hoodies run $120–180. |
| Ironwork Zip Hoodie | **$145** | Same body, same construction. |
| Filigree Jean | **$165** | Baggy five-pocket denim with a custom print on both legs, front and back. Printed indie denim runs $150–200. Priced above the hoodie because denim carries higher unit cost. |
| PB&B Oval Sticker | **$6** | Die-cut vinyl. Entry-price item that makes free-shipping thresholds reachable. |

Free-shipping threshold is set at **$150** — above one tee, reachable with two, and
automatic on any hoodie or jean. Marked `[CONFIRM]`.

---

## 6. Weight estimates — all ESTIMATED, needed for shipping to calculate

Shipping rates will not calculate without these. Every one is an estimate by garment
type; none is a weighed measurement.

| Product | Weight | Basis |
|---|---|---|
| Tees | **220 g** | Heavyweight cotton tee, size M. Typical range 200–240 g. |
| Zip hoodies | **850 g** | Heavyweight fleece full-zip with hardware. Typical range 700–950 g. |
| Filigree Jean | **700 g** | Mid-weight baggy five-pocket. Typical range 600–800 g. |
| Sticker | **10 g** | Vinyl die-cut plus backing. |

One flat weight per product, not per size — an XXL is meaningfully heavier than an XS.
Weigh one garment per type per size and replace these.

---

## 7. Size charts

Modelled as a `size_chart` metaobject, not hardcoded, because there is more than one
and they need different columns. Tops carry chest/length/sleeve; bottoms carry
waist/inseam/rise. `kind` distinguishes them.

**Only one row in the entire chart is a real measurement**: size L tops, taken from the
spec sheet (28in body, 21.5in chest, 8.5in sleeve). Every other row is graded from it
at 1.5in chest / 1in length / 0.5in sleeve per step. Graded rows are flagged
`measured: false` and the UI shows a *measured* badge on the real row and states the
distinction in plain text. Presenting a grade as a measurement is how fit complaints
start.

The bottoms chart is **entirely** derived — no denim spec sheet exists. Marked
`[CONFIRM]` in the chart's own note.

---

## 8. Product page behaviour

- **Selection lives in the URL** (`?color=Bone&size=S`). Variants are linkable and
  shareable, and the page works with JavaScript disabled — every selector is a real
  link, and a full page load renders the correct state.
- **Sold out vs never-made are visually and textually distinct.** Struck through and
  dashed = we make it, it ran out. Faded = that colourway was never cut in that size.
  Both are announced in text, not just implied by styling.
- **Galleries are server-rendered per colourway** and toggled with `hidden`, rather
  than rebuilt with `innerHTML`. Rebuilding drops Astro's scoped-style attribute,
  which silently broke the gallery layout the first time round.
- **`aria-current`, not `aria-pressed`.** The selectors are links, and the link role
  disallows `aria-pressed` — Lighthouse flagged it. `aria-current` is valid and
  carries the same meaning here.
- **Low stock threshold is 6.** Requires `quantityAvailable`, which needs the
  `unauthenticated_read_product_inventory` scope on the Storefront token. Without that
  scope the field errors and the indicator degrades to in-stock/sold-out.

---

## 9. Cart and checkout

Storefront Cart API. Cart id in an `httpOnly`, `SameSite=Lax`, `Secure` cookie, 14 days.
All mutations run server-side through `/api/cart` so the token never reaches the
browser and the buyer IP is forwarded on every call.

The endpoint accepts a normal form POST — the cart works with JavaScript disabled —
and JSON for `fetch`. A stale cookie pointing at a completed or expired cart is
detected and replaced rather than wedging the buyer.

`checkoutUrl` is read from the cart already in hand; no extra request is made to
"prepare" checkout. Checkout itself is untouched — not built, not styled, not
intercepted.

---

## 10. Filters

Uses the verified `filters: [ProductFilter!]` argument on the products connection,
with `variantOption` for size and colour and `productType` for type.

**Available filter *values* are derived from the loaded catalogue** rather than read
from the connection's `filters` field. That field only returns anything once the
Search & Discovery app has filters configured for the shop; deriving them works either
way and never renders a facet that matches nothing. If you install Search & Discovery
later, switching to the API-returned facets is a small change in `deriveFacets()`.

---

## 11. SEO

- Product JSON-LD with **one offer per variant**, each with its own URL, SKU, price
  and availability. Plus BreadcrumbList, CollectionPage/ItemList, Organization,
  WebSite+SearchAction, and FAQPage.
- Canonicals on every page; `noindex` on cart and search.
- **All OG images are absolute and https.** The current password page serves
  `og:image` over http — that's not repeated here.
- Sitemap generated by `@astrojs/sitemap`, excluding cart and search.

**No 301 map was written, because there is nothing to redirect.** pbnb.store is
currently a password-protected "Opening soon" page. It exposes no product URLs, no
collection URLs, and no navigation — only `/admin`. There are no existing URLs to
preserve. If the store was previously public at a different domain, say so and the
map takes minutes.

---

## 12. Admin seed script

`scripts/seed-shopify.mjs` creates the content model and catalogue. Not yet run —
there's no token. Dry-run verified end to end: 6 products, 50 variants, all DRAFT,
no missing images.

Mutation shapes were verified against shopify.dev, and **this part of the API has
indeed changed**:

- **`productCreate` no longer accepts variants.** `productSet` is the current path and
  creates product + options + variants + media in one call.
- **Variant→media association uses a per-variant `file` field** on `ProductSetInput`.
  This is what makes the gallery swap on colour selection natively, rather than being
  faked in JavaScript.
- `stagedUploadsCreate` returns `{url, resourceUrl, parameters[]}`; you POST the file
  as multipart with those parameters, then pass `resourceUrl` as `originalSource`.
  A separate `fileCreate` call is only needed for standalone files, not for media
  attached during `productSet` — so the brief's
  `stagedUploadsCreate → fileCreate → attach` becomes
  `stagedUploadsCreate → upload → productSet(files)`. One fewer round trip, same result.
- **Metaobject definitions need `access.storefront: PUBLIC_READ`** or the Storefront
  API cannot read them at all. Easy to miss and produces a confusing silent empty.

Everything is created as **DRAFT** with **0 inventory**, as asked.

---

## 13. Content model

Metaobjects: `size_chart`, `homepage_section`, `faq_entry`, `about_content`,
`announcement_bar`.
Product metafields under the `pbnb` namespace: `fabric_composition`,
`care_instructions`, `fit_notes`, `model_info`, `gsm`, `size_chart` (metaobject
reference).

The announcement bar already reads from its metaobject at runtime with a hardcoded
fallback, so it's live-editable the moment the metaobject exists.

**Honest caveat:** page copy is currently in `.astro` files, not metaobjects. The
model is defined and the reader pattern is proven by the announcement bar, but wiring
homepage sections, FAQ entries and about content to render *from* Shopify needs the
metaobjects to exist first — which needs the Admin token. That's the main piece of
Phase 1 still outstanding.

---

## 14. Where headless made this harder than a theme

Asked for plainly, so:

1. **Buyer-IP forwarding.** A theme gets rate limiting right for free. Headless
   requires a private token and a manually forwarded `Shopify-Storefront-Buyer-IP`
   header, and getting it wrong degrades checkout — not just performance. This is the
   single biggest tax.
2. **Editable copy is real work.** A theme gives merchants a visual editor. Here,
   every editable string needs a metaobject definition, a query, a renderer and a
   fallback. The model is built, but it is genuinely more work than the theme
   equivalent and it needs Admin credentials before any of it can exist.
3. **Faceted filtering.** Themes get Search & Discovery filtering as a drop-in.
   Here the facet UI, URL state, toggle logic and ProductFilter translation are all
   hand-written.
4. **Nothing is free.** Cart drawer, size guide, variant selection, low-stock,
   sold-out states, image swapping — all built from scratch.
5. **Two systems to keep in sync.** Product metafields have to be defined in Shopify
   *and* queried correctly here. A typo in a metafield key fails silently as `null`.

What headless bought in return: Performance 99, CLS 0, TBT 0 ms, ~2 s LCP on mobile,
a couple of KB of JavaScript, and complete control over the sold-out/never-made
distinction — which no stock theme handles properly.

---

## 15. Verification actually run

| Check | Result |
|---|---|
| `astro check` | 0 errors, 0 warnings, 0 hints |
| Production build | Passes |
| Lighthouse mobile — homepage | Perf **100**, A11y **100**, BP **100**, SEO **100** · LCP 1.82 s |
| Lighthouse mobile — collection | Perf **100**, A11y **100**, BP **100**, SEO **100** · LCP 1.52 s |
| Lighthouse mobile — product | Perf **99**, A11y **100**, BP **100**, SEO **100** · LCP 1.81 s |
| CLS / TBT | **0** and **0 ms** on all three |

Performance and LCP are the **median of 3 runs** against the production build under
wrangler. Measured on localhost, so LCP is optimistic relative to real-world network.

The collection page initially measured 96 median with a noisy 2.0–2.9 s LCP. Cause:
each card renders one image per colourway for the CSS swatch-hover swap, and those
alternates sit **inside the viewport**, so `loading="lazy"` does not defer them — they
were downloading at full 1600px and competing with the LCP image. Two fixes: cards now
use the 800px asset (they never render wider than ~390 CSS px), and only the single
first card carries `fetchpriority="high"` instead of two. Collection page image weight
went 408 KB → 196 KB and the score went to a stable 100 with LCP 1.52 s.
| 375px horizontal overflow | 14/14 pages clean |
| Keyboard-only variant selection | Passes — Tab reaches swatches and sizes, Enter activates, gallery swaps, URL updates, sold-out correctly refuses |
| EXIF/GPS in output images | 0 of 38 files carry exif/xmp/iptc |
| Seed script dry run | 6 products / 50 variants / all DRAFT / no missing images |

**Not run, because they need a live store:** test order through Shopify's test gateway,
shipping-rate calculation, inventory decrement, discount codes. These are Phase 7 and
are blocked on credentials.

---

## 16. What's needed to unblock

Create `.env` in the project root (already gitignored):

```
SHOPIFY_STORE_DOMAIN=pbnb-store.myshopify.com
SHOPIFY_STOREFRONT_TOKEN=
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=
SHOPIFY_ADMIN_TOKEN=
SHOPIFY_API_VERSION=2026-07
```

**Storefront tokens** — Shopify admin → Sales channels → **Headless** → add the
channel → Storefront API. It issues both a public token and a private token; take
both. Grant `unauthenticated_read_product_listings`,
`unauthenticated_read_product_inventory` (required for the low-stock indicator),
`unauthenticated_read_metaobjects`, and the cart/checkout scopes.

**Admin token** — Settings → Apps and sales channels → Develop apps → Create an app →
Configure Admin API scopes → Install. Scopes: `write_products`, `read_products`,
`write_files`, `write_inventory`, `write_metaobject_definitions`, `write_metaobjects`.
The last two are beyond the brief's list and are required for Phase 1.

Then:

```bash
node --experimental-strip-types scripts/seed-shopify.mjs --all --dry-run
node --experimental-strip-types scripts/seed-shopify.mjs --all
```
