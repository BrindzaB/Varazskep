# MALFINI_REFACTOR.md — Phase 6 Architecture Reference

Detailed technical reference for the Malfini API integration (Phase 6). Read alongside `plan.md` which tracks step status and branches.

---

## Context

The webshop previously ran on two hand-seeded dummy products in a local PostgreSQL database. Phase 6 integrates the Malfini REST API so the clothing catalog is live and always up to date. Non-clothing products (mugs, etc.) continue to be managed locally via Prisma as before.

**Phase 6 scope:** T-shirts and sweatshirts only. Other clothing categories (polos, hoodies, etc.) are added in a later iteration once the integration is stable.

**Hybrid approach — two product sources, one unified UI:**

| | Malfini products (clothing) | Local products (mugs, etc.) |
|---|---|---|
| Data source | Malfini REST API | Prisma `Product` + `Variant` tables |
| URL pattern | `/products/malfini/[code]` | `/products/[slug]` (unchanged) |
| Color display | `<img src={colorIconLink}>` | CSS hex from `COLOR_MAP` (unchanged) |
| Designer mockup | Malfini per-color product photo | SVG + color replacement (unchanged) |
| Designer URL params | `?code&colorCode&sizeCode` | `?slug&color&size` (unchanged) |
| Cart item key | `productSizeCode` (7-char SKU) | `variantId` (Prisma CUID, unchanged) |
| Admin management | Read-only catalog browser | Full CRUD (unchanged) |

---

## Malfini API

- **Base URL:** `https://api.malfini.com`
- **Auth:** `POST /api/v4/auth/login` → Bearer token (cached 50 min, auto-refreshed on 401)
- **Docs:** https://api.malfini.com/api-docs/index.html

### Key endpoints

| Endpoint | Cache | Purpose |
|---|---|---|
| `POST /api/v4/auth/login` | — | Username/password login → Bearer token |
| `GET /api/v4/product?language=hu` | 1 hour | Full product catalog |
| `GET /api/v4/product?language=hu&productCodes=M150,M151` | 1 hour | Filtered product catalog (optional) |
| `GET /api/v4/product/availabilities?productCodes=...` | 5 min | Stock per SKU (comma-separated productSizeCodes) |
| `GET /api/v4/product/recommended-prices?productCodes=...` | 5 min | Retail EUR prices (comma-separated productSizeCodes) |

No per-product endpoint exists. `getProduct(code)` fetches the full list and filters by code — cheap due to 1h ISR cache.

**Note:** `POST /api/v4/api-auth/login` is a separate OAuth refresh token endpoint — not used here.

### Key data shapes

```typescript
MalfiniProduct {
  code: string           // 3-char product code — URL identifier
  name: string
  description: string
  categoryName: string
  categoryCode: string   // determines designer eligibility and category tab
  gender?: string        // human-readable gender label
  genderCode?: string    // machine-readable — exact values discovered in step 6.1b
  variants: MalfiniVariant[]
}

MalfiniVariant {
  code: string           // variant identifier — used as colorCode in URLs
  colorCode: string
  colorIconLink: string  // URL to color swatch icon image (use as <img> src)
  name: string           // color display name
  images: [{ viewCode: string, link: string }]  // "A" = front, "B" = back
  nomenclatures: MalfiniNomenclature[]
}

MalfiniNomenclature {
  productSizeCode: string  // 7-char SKU — primary key for availability/price lookups
  size: string
  sizeName: string
  sizeCode: string
}
```

---

## Environment Variables

Required in `.env.local` and Vercel project settings:

```env
MALFINI_API_URL=https://api.malfini.com
MALFINI_USERNAME=...
MALFINI_PASSWORD=...
EUR_TO_HUF_RATE=400
```

---

## Step 6.1 — Malfini API Layer (completed)

All files in `lib/malfini/` created and committed to `main`.

| File | Purpose |
|---|---|
| `lib/malfini/types.ts` | TypeScript interfaces for all Malfini API response shapes |
| `lib/malfini/auth.ts` | Token fetch + module-level cache with expiry; `clearCachedToken()` for 401 retry |
| `lib/malfini/client.ts` | `getProducts()`, `getProduct(code)`, `getAvailabilities()`, `getRecommendedPrices()`, `buildPriceMap()`, `buildAvailabilityMap()` |
| `lib/malfini/pricing.ts` | `convertEurToHuf(eurPrice)` — reads `EUR_TO_HUF_RATE` from env at call time |
| `lib/malfini/categoryConfig.ts` | Maps `categoryCode` → designer print area config; currently empty — populated in step 6.1b |

---

## Step 6.1b — Test & Discovery Endpoint

**Purpose:** Before any complex implementation, verify the API works and collect the field values that drive filtering and designer config.

**What to discover:**
- Real `categoryCode` values for t-shirts and sweatshirts (to populate `categoryConfig.ts`)
- Real `genderCode` values (e.g. `"M"`, `"F"`, `"D"`, `"U"`) — needed for gender filter logic
- Whether Malfini image URLs are CORS-safe for canvas loading
- Actual price ranges and response shape

**Implementation:**
- Route: `GET /api/admin/malfini-test` — admin-protected, returns raw JSON from `getProducts("hu")`
- Browse the response to extract unique `categoryCode` and `genderCode` values
- Can be kept as a permanent dev tool or deleted after discovery

**After inspection:**
1. Populate `lib/malfini/categoryConfig.ts` with real category codes for t-shirts and sweatshirts including print area config
2. Note the `genderCode` value for unisex products (e.g. `"U"`) — unisex appears under both Férfi and Női in the UI

**CORS check:**
- Pick one `variant.images[].link` URL from the response
- Attempt to load it on a Fabric.js canvas in a local test
- If CORS is blocked: add proxy route `GET /api/proxy/malfini-image?url=...` (fetches image server-side, streams bytes back with permissive headers)
- Either way: add the Malfini image hostname to `next.config.js` → `images.remotePatterns`

---

## Step 6.2 — DB Schema Migration

`Product` and `Variant` tables are unchanged. Only `Order` changes.

### Order model diff

```prisma
model Order {
  // Local products — null for Malfini orders
  variantId       String?                           // was: String (non-nullable)
  variant         Variant? @relation(...)           // was: Variant (non-nullable)

  // Malfini products — null for local orders
  productSizeCode String?   // 7-char SKU e.g. "M150XM0"
  productCode     String?   // 3-char product code e.g. "M150"

  // Always set for both sources (supports 8-year retention per Hungarian tax law)
  productName     String
  colorName       String
  sizeName        String

  // ... rest unchanged
}
```

Migration name: `make_variant_nullable_add_malfini_order_fields`

**Migration note for existing data:** The three new `String` fields are non-nullable. The migration must backfill them from the existing `variant` relation before dropping the `NOT NULL` default workaround. Use `DEFAULT ''` in the migration SQL, backfill via a data migration, then drop the default.

---

## Step 6.3 — Cart Store

`CartItem` gains a `source` discriminator and renamed shared fields for clarity. Bump Zustand persist `version` to auto-clear stale localStorage carts on deployment.

```typescript
interface CartItem {
  source: "local" | "malfini"

  // Local only:
  variantId?: string
  productSlug?: string

  // Malfini only:
  productSizeCode?: string   // 7-char SKU
  productCode?: string       // 3-char code — for navigating back to product detail

  // Shared (always set):
  productName: string
  colorName: string          // was: color
  sizeName: string           // was: size
  price: number              // HUF integer
  quantity: number
  imageUrl: string | null
  designId?: string
}
```

**Deduplication key:**
- With `designId`: always unique (each design is a distinct cart item)
- Without `designId`, local: keyed by `variantId`
- Without `designId`, Malfini: keyed by `productSizeCode`

---

## Step 6.4 — Stripe Checkout + Webhook

### Checkout session creation (`/api/stripe/checkout`)
- Reads `source` from each cart item
- Local: look up `Variant` in DB for authoritative price (existing behavior)
- Malfini: call `getRecommendedPrices([productSizeCode])` for authoritative price
- Embed in Stripe session metadata (top-level keys, not JSON — avoids 500-char limit per value):
  `source`, `productName`, `colorName`, `sizeName`, `designId`, and either `variantId` or `productSizeCode` + `productCode`

### Webhook handler (`/api/stripe/webhook`)
- Reads `source` from metadata (or infers from presence of `productSizeCode`)
- Creates `Order`:
  - Local: `variantId` set, Malfini fields null
  - Malfini: `productSizeCode` + `productCode` set, `variantId` null
  - Both: `productName`, `colorName`, `sizeName` always set from denormalized metadata

---

## Step 6.5 — Shop UI

### Unified Products Page (`app/(shop)/products/page.tsx`)

**Server-side data (ISR):**
```typescript
const [malfiniProducts, localProducts] = await Promise.all([
  getProducts("hu"),       // ISR 1h — returns full catalog
  getActiveProducts(),     // Prisma
])

// Keep only categories with a designer config (t-shirts + sweatshirts for Phase 6)
const clothingProducts = malfiniProducts.filter(
  p => getCategoryConfig(p.categoryCode) !== null
)

// Pre-compute min price per product for card display
const allSizeCodes = clothingProducts.flatMap(
  p => p.variants.flatMap(v => v.nomenclatures.map(n => n.productSizeCode))
)
const prices = await getRecommendedPrices(allSizeCodes)  // ISR 5min
const priceMap = buildPriceMap(prices, convertEurToHuf)

// Attach minPrice to each product before passing to client component
const clothingWithPrices = clothingProducts.map(p => ({
  ...p,
  minPrice: Math.min(
    ...p.variants.flatMap(v =>
      v.nomenclatures.map(n => priceMap[n.productSizeCode] ?? Infinity)
    )
  ),
}))
```

**Client component `ProductsPageClient`** manages filter + pagination state:

- **Gender filter** (Összes / Férfi / Női / Gyerek):
  - Uses `genderCode` field; exact values from step 6.1b
  - Unisex products (`genderCode === UNISEX_CODE`) appear under Férfi AND Női
  - Local products (mugs) always shown regardless of gender filter
- **Category tabs** (derived from data — not hardcoded): T-shirt | Pulóver | Bögre | Összes
- **Pagination:** 30 items per page, page index in component state
- **Grid:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` — 5 columns on desktop

**Cards:**
- Malfini clothing → `MalfiniProductCard` (new component)
  - Shows first variant's front image (`viewCode: "A"`)
  - Name + `tól {formatHuf(minPrice)}` price label
  - Links to `/products/malfini/[code]`
- Local products → existing `ProductCard` (no changes)

### Malfini Product Detail Page

**Route:** `app/(shop)/products/malfini/[code]/page.tsx`

```typescript
export async function generateStaticParams() {
  const products = await getProducts("hu")
  return products
    .filter(p => getCategoryConfig(p.categoryCode) !== null)
    .map(p => ({ code: p.code }))
}

export default async function MalfiniProductPage({ params }) {
  const product = await getProduct(params.code, "hu")
  if (!product) notFound()

  const allSizeCodes = product.variants.flatMap(
    v => v.nomenclatures.map(n => n.productSizeCode)
  )
  const [prices, availabilities] = await Promise.all([
    getRecommendedPrices(allSizeCodes),
    getAvailabilities(allSizeCodes),
  ])

  return <MalfiniProductDetails product={product} priceMap={...} availabilityMap={...} />
}
```

**`components/shop/MalfiniProductDetails.tsx`** (client component):
- Left column: product photo (front image of selected color variant)
- Right column:
  - Product name + description
  - Color swatches: `<img src={colorIconLink} className="rounded-full w-8 h-8">` buttons
  - Size buttons: from selected variant's `nomenclatures`; each shows in-stock / out-of-stock state
  - Price: `priceMap[selectedNomenclature.productSizeCode]` formatted in HUF
  - "Kosárba" button → `addItem({ source: "malfini", productSizeCode, productCode, ... })`
  - "Tervezőfelület megnyitása" → `/designer?code=...&colorCode=...&sizeCode=...`
    - Only shown if `getCategoryConfig(product.categoryCode) !== null`

---

## Step 6.6 — Designer Changes

### Key principle
`DesignerCanvas` no longer decides how to load a mockup image. It receives a single `imageUrl: string` prop. The parent (`DesignerLayout`) is responsible for computing the correct URL:
- Local mode: fetch SVG text → `buildColoredDataUrl(svgText, hex)` → data URL
- Malfini mode: `variant.images.find(i => i.viewCode === "A")?.link` (or `"B"` for back)

When `imageUrl` changes (color switch or side toggle in Malfini mode), `DesignerCanvas` swaps the background image while keeping all canvas objects (clipart, text) in place — no page reload, no canvas wipe.

### File changes

| File | Change |
|---|---|
| `lib/designer/colorUtils.ts` | **New** — extracted from `DesignerCanvas.tsx`: `darkenHex()`, `isNearWhite()`, `buildColoredDataUrl()` |
| `components/designer/DesignerCanvas.tsx` | Replace `shirtColor` + `mockupType` props with `imageUrl: string`; remove internal SVG fetching; add effect to swap background image on `imageUrl` change without clearing objects |
| `components/designer/DesignerLayout.tsx` | Accept `source: "local" \| "malfini"` prop; Malfini mode: compute `imageUrl` from selected variant's images, update on color/side change; right panel shows Malfini color swatches (img) + sizes + stock |
| `app/(shop)/designer/page.tsx` | Route `?code` params to Malfini mode; `?slug` params to local mode (unchanged) |
| `components/designer/ColorPicker.tsx` | New optional `iconUrl?: string` per `ColorEntry`; when set renders `<img src={iconUrl}>` swatch instead of hex div |

### Designer page routing

```typescript
export default async function DesignerPage({ searchParams }) {
  if (searchParams.code) {
    // Malfini mode
    const product = await getProduct(searchParams.code, "hu")
    if (!product) redirect("/products")
    const variant = product.variants.find(v => v.colorCode === searchParams.colorCode)
      ?? product.variants[0]
    const nomenclature = variant.nomenclatures.find(n => n.sizeCode === searchParams.sizeCode)
      ?? variant.nomenclatures[0]
    return (
      <DesignerLayout
        source="malfini"
        malfiniProduct={product}
        initialVariant={variant}
        initialNomenclature={nomenclature}
      />
    )
  } else {
    // Local mode (unchanged)
    const slug = searchParams.slug ?? "egyedi-polo"
    const product = await getProductBySlug(slug) ?? await getProductBySlug("egyedi-polo")
    // ... existing logic
  }
}
```

### Print area for Malfini products
- Driven by `getCategoryConfig(product.categoryCode).printArea`
- Populated in step 6.1b after discovering real category codes

---

## Step 6.7 — Admin Panel

### Order dashboard
- Show source badge per order: "Malfini" / "Helyi"
- For Malfini orders (`variantId` is null): display `productCode` + `productSizeCode`
- For local orders: display existing variant relation data

### Read-only Malfini catalog browser
- Route: `app/admin/products/malfini/page.tsx`
- Lists all Malfini products from `getProducts()` — code, name, category, color count
- Read-only: no create/edit/delete (catalog is managed by the supplier)
- Links to public product detail page for each product

---

## Step 6.8 — Supporting Files

### `next.config.js`
Add Malfini CDN hostname to `images.remotePatterns` (required for `<Image>` component and canvas loading):
```javascript
images: {
  remotePatterns: [
    { hostname: "api.malfini.com" },  // or the actual CDN hostname found in step 6.1b
  ],
},
```

### `app/sitemap.ts`
Include Malfini product URLs for configured categories:
```typescript
const malfiniProducts = await getProducts("hu")
const clothingUrls = malfiniProducts
  .filter(p => getCategoryConfig(p.categoryCode) !== null)
  .map(p => ({ url: `${baseUrl}/products/malfini/${p.code}` }))
```

### Order confirmation page
- Read `productName`, `colorName`, `sizeName` from `order` (always set, both sources)
- No source-specific branching needed for display

---

## Risks

| Risk | Mitigation |
|---|---|
| No per-product Malfini endpoint | `getProduct(code)` fetches full list + filters; 1h ISR cache makes this cheap |
| Malfini image CORS blocks canvas | Proxy via `/api/proxy/malfini-image?url=...` if confirmed blocked in step 6.1b |
| Stale localStorage cart after deployment | Bump Zustand persist `version` in step 6.3 |
| Stripe metadata 500-char limit | Store fields as top-level keys, not JSON |
| Malfini API downtime | ISR serves last-good data; `try/catch` returns `[]`; UI shows fallback |
| `variant.code` vs `variant.colorCode` ambiguity | Verified against real API in step 6.1b |
| Existing test orders missing new required fields | Use `DEFAULT ''` + data migration in step 6.2 |
| Gender filter unisex logic | Unisex `genderCode` value confirmed in step 6.1b; filter treats it as matching Férfi + Női |
