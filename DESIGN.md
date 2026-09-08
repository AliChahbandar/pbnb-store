# PB&B — design direction

No `DESIGN.md` existed when this started, so the direction below was derived from
the artwork rather than invented, then built. Change anything here you disagree
with — it's a first opinionated pass, not a fixed position.

---

## Where the direction came from

The archive is unambiguous about what this brand is. Barbed tribal spines, split-wing
moths, a five-point nova star, plaid fills, filigree scrollwork up a baggy jean leg,
cropped boxy zip fleece with studded cuffs. That's Y2K mall-goth streetwear with a
hand-drawn edge — closer to a tattoo flash sheet than to minimal basics.

So the site does not try to be a quiet Scandinavian storefront. It's dark, heavy,
and gets out of the way of graphics that are already loud.

## Colour — sampled, not chosen

The artist drew a six-swatch palette strip into four of the design files
(`Untitled_Artwork 5.png`, `6.png`, `Final_Backup.png`, `final 2.png`). Rather than
eyeball colours off a screenshot, the strip was read pixel-by-pixel across four scan
lines, which returned identical values every time:

| Token | Hex | Role |
|---|---|---|
| `--berry` | `#A8174C` | Primary accent — buttons, announcement bar, active states |
| `--wheat` | `#E3BD84` | Focus ring, highlights |
| `--orange` | `#E39D51` | Low-stock warnings, "measured" badge |
| `--bone` | `#CEC4AF` | The wordmark colour. Primary button fill, selected states |
| `--rose` / `--rose-deep` | `#C49593` / `#BF7981` | Secondary links, sold-out notices |
| `--charcoal` | `#353131` | The garment colour. Surfaces |

The spec sheet labels the chest print **"Color 4"**, and the fourth swatch is
`#CEC4AF` — the exact wordmark colour. The strip is a numbered system the brand
already uses, not decoration.

Two greys were added for the site ground, since a webpage needs more depth than a
print palette provides: `--bg #191817` and `--bg-sunken #121110`, both sitting just
below the charcoal so garments read as lighter than the page.

`--paper #EDE9E0` is the product-image background, matched exactly so image tiles
never show a seam against their container.

### Contrast

Every foreground token was checked against all three grounds with the WCAG formula.
The original `--ink-faint` failed at 3.2:1, so it was moved to `#918980`, which
clears 4.5:1 on the darkest ground (5.15 / 5.47 / 4.76). Lighthouse accessibility
is 100 on all three tested pages.

## Typography

**No webfonts.** The wordmark is the brand's voice and it ships as traced vector,
so the body text doesn't need to carry identity — it needs to be fast and
invisible. A system stack means zero font requests, zero FOUT, and no layout shift
from font swapping. That's a large part of why CLS is 0 and LCP is ~2s.

- **Display** — heavy system grotesque, uppercase, `-0.045em` tracking. Big and tight.
- **Body** — system sans at 1.55 line height.
- **Mono** — used for all metadata: prices, sizes, SKUs, eyebrows, nav. This is the
  single strongest typographic decision on the site. Monospace on numbers and labels
  reads as technical and spec-sheet-ish, which suits a brand whose own source
  material is an annotated production drawing.

If you later want a display face with more personality, that's the one place to
spend a font request — headings only, `font-display: swap`, and keep the body system.

## Layout

Big imagery, restrained type, product carries it.

- **Split hero** rather than full-bleed. The garment flats sit on a bone ground; floating
  that behind dark type turns both to mud. A hard vertical split — charcoal type panel,
  bone image panel — is cleaner and honest about what the assets are.
- **Square product tiles** on `--paper`, edge to edge in the grid.
- **PDP gallery** leads with one full-width image, then the second view at half width.
- **The graphic leads.** Which side carries it varies per garment — the Nova Star
  hoodie prints on the chest, the tees print on the back — so lead view is set per
  product. Leading with the plain side would make every card look identical.

## Motion

Native CSS scroll-driven animations only. No GSAP, no Lenis, no scroll library.

Every effect is double-gated:

```css
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    /* ... */
  }
}
```

The `@supports` guard is load-bearing, not decorative. Firefox stable still doesn't
support `animation-timeline`, and without the guard the element would be stranded in
its `from` state — invisible, permanently. That's the failure mode the guard exists
to prevent.

Rules held to:

- **The LCP element is never opacity-animated.** The hero image is `loading="eager"`,
  `fetchpriority="high"`, and carries no entry animation at all.
- **Transform and opacity only.** Nothing that triggers layout.
- **Space is always reserved.** Every media box declares `aspect-ratio` before the
  image loads. Measured CLS is 0 on all three tested pages.
- **No motion on the shopping path.** Collection, product, cart and search set
  `data-motion="off"` on `<body>`, and every animation rule is scoped
  `body:not([data-motion="off"])`. Motion is for browsing, not for buying.

Three effects exist: `[data-reveal]` (fade + rise on entry), `[data-rise]` (rise only),
and `[data-drift]` (slow parallax on large editorial imagery).

## What the design deliberately does not do

- No carousels. They hide product and hurt conversion.
- No hover-only affordances. Every swatch interaction also fires on `:focus-visible`.
- No modal on entry.
- No fake urgency. The low-stock indicator only appears when `quantityAvailable` is
  genuinely at or under 6, and it states the real number.
- Sold-out sizes are **shown, struck through, and explained** rather than hidden.
  Seeing that a brand makes your size and ran out is useful information.
- **Sold out and never-made look different.** Struck through means we make it and
  it ran out; faded means that colourway was never cut in that size. They're
  different facts and shouldn't look the same.
