# MALFINI_REFACTOR.md — Phase 6 Architecture Reference

Detailed technical reference for the Malfini API integration (Phase 6). Read alongside `plan.md` which tracks step status and branches.

---

## Context

The webshop previously ran on two hand-seeded dummy products in a local PostgreSQL database. Phase 6 integrates the Malfini REST API so the clothing catalog is live and always up to date. Non-clothing products (mugs, etc.) continue to be managed locally via Prisma as before.

**Hybrid approach — two product sources, one unified UI:**

| | Malfini products (clothes) | Local products (mugs, etc.) |
|---|---|---|
| Data source | Malfini REST API | Prisma `Product` + `Variant` tables |
| URL pattern | `/products/malfini/[code]` | `/products/[slug]` (unchanged) |
| Color display | `<img src={colorIconLink}>` | CSS hex from `COLOR_MAP` (unchanged) |
| Designer mockup | Malfini per-color product photo | SVG + color replacement (unchanged) |
| Designer URL params | `?code&colorCode&sizeCode` | `?slug&color&size` (unchanged) |
| Cart item key | `productSizeCode` (Malfini 7-char SKU) | `variantId` (Prisma CUID, unchanged) |
| Admin management | Read-only Malfini catalog browser | Full CRUD as currently |

---

## Malfini API

- **Base URL:** `https://api.malfini.com`
- **Auth:** `POST /api-auth/login` → Bearer token (cached 50 min, auto-refreshed on 401)
- **Docs:** https://api.malfini.com/api-docs/index.html

### Key endpoints

| Endpoint | Cache | Purpose |
|---|---|---|
| `GET /api/v4/product?language=hu` | 1 hour | Full product catalog |
| `GET /api/v4/product/availabilities?productCodes=...` | 5 min | Stock per SKU |
| `GET /api/v4/product/recommended-prices?productCodes=...` | 5 min | Retail EUR prices |

### Key data shapes

```typescript
MalfiniProduct {
  code: string           // 3-char product code — URL identifier
  name: string
  description: string
  categoryName: string
  categoryCode: string   // used to determine designer eligibility
  variants: MalfiniVariant[]
}

MalfiniVariant {
  code: string           // variant identifier — used as colorCode in URLs
  colorCode: string
  colorIconLink: string  // URL to color swatch icon image
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

## New Environment Variables

Add to `.env.local` and Vercel project settings:

```env
MALFINI_API_URL=https://api.malfini.com
MALFINI_USERNAME=...
MALFINI_PASSWORD=...
EUR_TO_HUF_RATE=400
```

---

## New Files (Phase 6.1 — completed)

| File | Purpose |
|---|---|
| `lib/malfini/types.ts` | TypeScript interfaces for all Malfini API response shapes |
| `lib/malfini/auth.ts` | Token fetch + module-level cache with expiry, `clearCachedToken()` for 401 retry |
| `lib/malfini/client.ts` | `getProducts()`, `getProduct(code)`, `getAvailabilities()`, `getRecommendedPrices()`, `buildPriceMap()`, `buildAvailabilityMap()` |
| `lib/malfini/pricing.ts` | `convertEurToHuf(eurPrice)` — reads `EUR_TO_HUF_RATE` from env at call time |
| `lib/malfini/categoryConfig.ts` | Maps Malfini `categoryCode` → designer print area config; `getCategoryConfig()` returns `null` for categories without a designer |

---

## Database Schema Changes (Step 6.2)

`Product` and `Variant` tables are **kept** for local products. Only `Order` changes.

### Order model — before

```prisma
model Order {
  variantId  String
  variant    Variant @relation(fields: [variantId], references: [id])
  // ... no product name / color / size fields
}
```

### Order model — after

```prisma
model Order {
  // Local products — null for Malfini orders
  variantId       String?
  variant         Variant? @relation(fields: [variantId], references: [id])

  // Malfini products — null for local orders
  productSizeCode String?   // 7-char SKU
  productCode     String?   // 3-char product code

  // Always set regardless of source (supports 8-year retention per Hungarian tax law)
  productName     String
  colorName       String
  sizeName        String
  // ... rest unchanged
}
```

Migration name: `add_malfini_fields_to_order`

---

## Cart Changes (Step 6.3)

`CartItem` gains a `source` discriminator. The dedup key switches from `variantId` to `productSizeCode` for Malfini items.

```typescript
interface CartItem {
  source: "malfini" | "local"
  // Local only:
  variantId?: string
  productSlug?: string
  // Malfini only:
  productSizeCode?: string
  productCode?: string
  // Common (always set):
  productName: string
  color: string
  size: string
  price: number
  quantity: number
  imageUrl: string | null
  designId?: string
}
```

**Important:** bump the Zustand persist `version` to auto-clear stale localStorage carts after deployment.

---

## Stripe / Webhook Changes (Step 6.4)

### Checkout route
- Local items: existing behavior (look up `Variant` in DB for authoritative price)
- Malfini items: call `getRecommendedPrices()` for authoritative price
- Embed `source` + all denormalized fields in Stripe session metadata

### Webhook
- Read `source` from metadata
- Local: create `Order` with `variantId`
- Malfini: create `Order` with `productSizeCode` + `productCode`
- Both: always set `productName`, `colorName`, `sizeName`

---

## New Shop UI Files (Step 6.5)

### `app/(shop)/products/malfini/[code]/page.tsx`
- `generateStaticParams`: calls `getProducts()`, returns `[{ code }]`
- Fetches product + availability + prices in parallel
- 2-column layout matching existing product detail page
- Passes `priceMap` and `availabilityMap` to `MalfiniProductDetails`

### `components/shop/MalfiniProductDetails.tsx`
- Client component (separate from `ProductDetails.tsx` — avoids union type complexity)
- Color swatches: `<img src={colorIconLink} className="rounded-full">` buttons
- Sizes from `nomenclatures` for selected variant
- Designer button: shown only when `getCategoryConfig(product.categoryCode) !== null`
- Designer link: `/designer?code=...&colorCode=...&sizeCode=...`
- On color change: updates displayed product image from Malfini variant images

### Products page (`app/(shop)/products/page.tsx`)
- Fetches both sources in parallel: `getActiveProducts()` + `getProducts()` + `getRecommendedPrices()`
- Category tabs built from both sources
- Passes unified list to `ProductGrid`

---

## Designer Changes (Step 6.6)

### Key architectural change
`DesignerCanvas` no longer fetches SVGs or does color replacement. It accepts a single `imageUrl: string` prop. The **parent (`DesignerLayout`) is responsible for producing `imageUrl`**:
- Local products: fetch SVG text, run `buildColoredDataUrl(svgText, hex)` → data URL
- Malfini products: `variant.images.find(i => i.viewCode === 'A')?.link`

`buildColoredDataUrl`, `darkenHex`, `isNearWhite` move to `lib/designer/colorUtils.ts`.

### New/modified files

| File | Change |
|---|---|
| `lib/designer/colorUtils.ts` | New — extracted SVG color utilities |
| `components/designer/DesignerCanvas.tsx` | Accepts `imageUrl` + `categoryCode` instead of `shirtColor` + `mockupType` |
| `components/designer/DesignerLayout.tsx` | Handles both local (SVG data URL) and Malfini (photo URL) modes |
| `app/(shop)/designer/page.tsx` | Routes `?slug` params to local flow, `?code` params to Malfini flow |
| `components/designer/ColorPicker.tsx` | Accepts `{ name, hex }[]` (local) or `{ name, colorCode, iconUrl }[]` (Malfini) |

---

## Category Config

Designer eligibility for Malfini products is controlled by `lib/malfini/categoryConfig.ts`.

**Business rule:**
- ✅ Enabled: t-shirts (all types), polo shirts, sweatshirts, hoodies, and other wearable tops
- ❌ Disabled: caps, bags, jackets, footwear, accessories

**To populate:** make one API call to `GET /api/v4/product?language=hu`, extract unique `categoryCode` values, fill in `CATEGORY_CONFIG` accordingly.

---

## Prerequisites Before Step 6.2

1. Add the four new env vars to `.env.local` and Vercel
2. Make a test API call — confirm response shape matches `MalfiniProduct` types, log unique `categoryCode` values
3. Populate `lib/malfini/categoryConfig.ts` with real category codes
4. Confirm Malfini image CORS policy — if `api.malfini.com` does not send `Access-Control-Allow-Origin` headers, proxy images through `/api/malfini-image?url=...`
5. Confirm Malfini auth token field name (`token` vs `access_token`) and actual TTL
6. Confirm price rounding preference (whole HUF vs nearest 10/90 Ft)

---

## Risks

| Risk | Mitigation |
|---|---|
| No per-product Malfini endpoint | `getProduct(code)` fetches full list + filters; 1h ISR cache makes this cheap |
| Malfini image CORS blocks designer canvas | Proxy via `/api/malfini-image?url=...` |
| Stale localStorage cart after deployment | Bump Zustand persist `version` |
| Stripe metadata 500-char limit | Store denormalized fields as top-level keys, not JSON array |
| Malfini API downtime | ISR serves last-good data; `try/catch` returns `[]`; UI shows fallback message |
| `variant.code` vs `variant.colorCode` ambiguity | Verify with real API response before using as URL param |
| Existing test orders missing new required fields | Use `DEFAULT ''` in migration SQL, backfill from variant relation, drop default |
