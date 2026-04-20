# ARCHITECTURE.md — Varázskép Technical Reference

Full technical reference. Read alongside `CLAUDE.md` (session rules) and `DESIGN.md` (visual system).

---

## Project Structure

```
varazskep/
├── app/
│   ├── (shop)/
│   │   ├── page.tsx                     # Homepage / product listing
│   │   ├── products/
│   │   │   ├── [slug]/                  # Local product detail (mugs, etc.)
│   │   │   └── malfini/[code]/          # Malfini product detail (clothing)
│   │   ├── designer/                    # Designer page (Fabric.js)
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── order/[id]/                  # Order confirmation
│   │   ├── contact/
│   │   └── privacy/                     # GDPR privacy policy
│   ├── admin/
│   │   ├── login/
│   │   ├── orders/                      # Order management + detail
│   │   └── products/                    # Local CRUD + read-only Malfini browser
│   ├── api/
│   │   ├── stripe/checkout/route.ts     # Create Stripe session
│   │   ├── stripe/webhook/route.ts      # Handle Stripe events → create order
│   │   ├── clipart/route.ts             # GET — active clipart items
│   │   ├── designs/route.ts             # POST — save canvas JSON before cart
│   │   ├── designs/upload/route.ts      # POST — customer image upload
│   │   ├── warmup/route.ts              # GET — Malfini catalog warmup (cron)
│   │   └── admin/                       # Admin-authenticated API routes
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── designer/
│   │   ├── DesignerCanvas.tsx           # Fabric.js canvas; ref API: addClipart, addImage, addText, getCanvasJson
│   │   ├── DesignerLayout.tsx           # Designer state, toolbar, panels (local + Malfini modes)
│   │   ├── ClipartPanel.tsx             # Clipart library modal
│   │   ├── ColorPicker.tsx              # Color swatches (hex or iconUrl image)
│   │   ├── TextOptionsBar.tsx           # Font + color bar shown when text selected
│   │   └── ProductPickerPanel.tsx       # Product picker overlay (no-param designer route)
│   ├── shop/
│   │   ├── ProductCard.tsx
│   │   ├── MalfiniProductDetails.tsx    # Client component for Malfini product detail
│   │   ├── ProductDetails.tsx           # Client component for local product detail
│   │   ├── CartItem.tsx
│   │   ├── CheckoutForm.tsx             # Shipping method selector + address fields + Foxpost widget
│   │   └── FoxpostWidget.tsx            # Foxpost APT Finder iframe embed + postMessage handler
│   ├── admin/
│   │   ├── OrderStatusUpdater.tsx
│   │   ├── GdprEraseButton.tsx
│   │   └── ClipartUploadForm.tsx
│   └── ui/                              # Shared primitives (Button, Input, etc.)
├── lib/
│   ├── db.ts                            # Prisma singleton
│   ├── supabase.ts                      # Supabase admin client + bucket constants
│   ├── redis.ts                         # Upstash Redis singleton + REDIS_KEY_CATALOG, REDIS_CATALOG_TTL_SECONDS
│   ├── malfini/
│   │   ├── types.ts                     # MalfiniProduct, MalfiniVariant, MalfiniNomenclature interfaces
│   │   ├── auth.ts                      # Bearer token fetch + module-level cache; clearCachedToken()
│   │   ├── client.ts                    # getProducts(), getProduct(), getAvailabilities(), getRecommendedPrices(),
│   │   │                                # buildPriceMap(), buildAvailabilityMap(), warmupMalfiniCache()
│   │   ├── pricing.ts                   # convertEurToHuf()
│   │   └── categoryConfig.ts            # categoryCode → { printArea, hasSides }
│   ├── shipping/
│   │   └── config.ts                    # SHIPPING_PRICES, SHIPPING_LABELS, ShippingMethodKey type
│   ├── services/
│   │   ├── order.ts                     # Order business logic
│   │   ├── product.ts                   # Local product queries
│   │   ├── design.ts                    # Design serialization + SVG export
│   │   ├── clipart.ts                   # getActiveClipart(), getClipartCategories(), createClipartRecord()
│   │   └── email.ts                     # Resend integration
│   ├── designer/
│   │   ├── mockupConfig.ts              # SVG mockup config for local products
│   │   └── colorUtils.ts               # buildColoredDataUrl(), darkenHex(), isNearWhite()
│   ├── auth/jwt.ts                      # JWT admin auth helpers
│   ├── cart/cartStore.ts               # Zustand cart state
│   └── utils/
│       ├── colors.ts                    # COLOR_MAP (color name → hex)
│       └── format.ts                    # formatHuf()
├── prisma/schema.prisma
├── emails/                              # React Email templates (Hungarian)
├── __tests__/                           # webhook.test.ts, order.test.ts
└── public/
    ├── tshirt_front.svg · tshirt_back.svg · mug-mockup.svg
    └── swagger.json                     # Malfini REST API v4 OpenAPI spec
```

---

## Database Schema

```prisma
model Product {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  imageUrl    String?
  active      Boolean   @default(true)
  mockupType  String?   // "tshirt" | "mug" | null (null = no designer)
  variants    Variant[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Variant {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  color     String
  size      String
  price     Int      // HUF integer
  stock     Int      @default(0)
  orders    Order[]
}

model Clipart {
  id        String   @id @default(cuid())
  name      String
  category  String
  svgUrl    String   // Supabase `clipart` bucket — permanent
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
}

model Design {
  id         String   @id @default(cuid())
  canvasJson Json     // { front: FabricJSON[], back: FabricJSON[], printAreaPx: {...} }
  svgUrl     String?  // Supabase `designs` bucket — nulled after 45 days
  createdAt  DateTime @default(now())
  expiresAt  DateTime // 45 days from createdAt
  order      Order?
}

model Order {
  id                 String         @id @default(cuid())
  stripeSessionId    String         @unique
  status             OrderStatus    @default(PENDING)
  variantId          String?        // local orders only
  variant            Variant?       @relation(fields: [variantId], references: [id])
  productSizeCode    String?        // Malfini orders only — 7-char SKU e.g. "M150XM0"
  productCode        String?        // Malfini orders only — 3-char e.g. "M150"
  productName        String         // always set (8-year retention)
  colorName          String
  sizeName           String
  designId           String?        @unique
  design             Design?        @relation(fields: [designId], references: [id])
  customerName       String
  customerEmail      String
  shippingAddress    Json           // { address, city, postalCode, country }
  totalAmount        Int            // HUF integer (includes shipping)
  gdprConsent        Boolean
  shippingMethod     ShippingMethod @default(MPL_HOME_DELIVERY)
  shippingCost       Int            @default(0)  // HUF integer
  pickupPointId      String?        // Foxpost operator_id (e.g. "hu1175")
  pickupPointName    String?        // Foxpost locker display name
  pickupPointAddress String?        // Foxpost locker formatted address
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
}

enum OrderStatus    { PENDING PAID IN_PRODUCTION SHIPPED COMPLETE CANCELLED }
enum ShippingMethod { FOXPOST_LOCKER MPL_HOME_DELIVERY }
```

**Key rules:** Prices in HUF integers. Design JSON stored as JSONB — never stringify manually. Orders only created in `stripe/webhook`.

---

## Supabase Storage Layout

| Bucket | Path | Written by | Expiry |
|--------|------|-----------|--------|
| `clipart` | `{uuid}.svg` | Admin upload form | Permanent |
| `designs` | `{designId}.svg` | Stripe webhook (SVG export) | 45 days |
| `designs` | `uploads/{uuid}.{ext}` | `POST /api/designs/upload` | 45 days |

Deleting an `Order` row does **not** cascade to `Design` or Storage — the FK is on `Order`.

---

## Redis Cache Architecture

Two-level cache for the Malfini product catalog (~10MB):

```
Request → L1: module-level cache (per instance, 1h TTL, ~0ms)
               ↓ MISS
           L2: Upstash Redis (shared across all instances, 25h TTL, ~5ms)
               ↓ MISS (first deploy or Redis flush)
           Malfini API (~25s) → writes to L1 + L2
```

- `lib/redis.ts`: `getRedisClient()` — lazy singleton, returns `null` if env vars missing (graceful fallback)
- `REDIS_KEY_CATALOG = "malfini:catalog:hu"`, `REDIS_CATALOG_TTL_SECONDS = 90000` (25h)
- `warmupMalfiniCache()` — always fetches fresh + writes both caches; called by `/api/warmup`
- Vercel cron at 05:00 UTC daily → keeps Redis warm with 1h overlap before expiry
- After first production deploy: visit `/api/warmup` once manually with `Authorization: Bearer {CRON_SECRET}`

---

## Architectural Decisions

**Orders only via Stripe webhook:** Checkout can be abandoned or fraudulent. The webhook fires only after successful payment — single source of truth.

**Guest checkout:** Small local business; registration kills conversion. Email order tracking is sufficient.

**Single Next.js app:** No separate backend needed at this scale. Extract to a separate service if traffic warrants (v2 concern).

**Design record before payment:** Canvas JSON exceeds Stripe metadata limits (500 chars/value). A `Design` row is created when the customer clicks "Kosárba" — only the `Design`, never the `Order`. The `designId` travels through Stripe metadata and is linked to the `Order` by the webhook.

**Clipart catalog via database:** Admin manages clipart through the admin panel. SVG files live in Supabase `clipart` bucket (permanent). The `Clipart` table stores metadata + public URL.

---

## Designer System

### Two mockup modes

**Local products** (mugs): SVG mockup system. `Product.mockupType` → config in `lib/designer/mockupConfig.ts` → SVG path + print area. Color is applied via `buildColoredDataUrl()` (SVG fill replacement).

**Malfini products** (clothing): Photo mockup system. Per-color product photo from Malfini API used directly as canvas background. `viewCode "a"` = front, `"b"` = back. No SVG color replacement. Print area config in `lib/malfini/categoryConfig.ts`.

`DesignerCanvas` receives a single `imageUrl: string` prop — the parent (`DesignerLayout`) computes the correct URL regardless of source.

### URL params

| Mode | URL format |
|------|-----------|
| Malfini | `/designer?code=M150&colorCode=01&sizeCode=M` |
| Local | `/designer?slug=egyedi-bogre&color=Fehér&size=330ml` |
| No params | Product picker panel (blurred background + `ProductPickerPanel` overlay) |

"Termékek" toolbar button navigates to `/designer` (no params) to reopen the picker.

### Front/back design
`DesignerLayout` holds `side: "front" | "back"` state. Off-screen side objects stored in a ref — switching is instant. Canvas JSON saved as `{ front: [...], back: [...], printAreaPx: {...} }`.

### Canvas ref API (`DesignerCanvasRef`)
`addClipart(svgUrl)` · `addImage(url)` · `addText()` · `setTextFont(font)` · `setTextColor(color)` · `getCanvasJson()`

### "Open designer" button visibility
- Local: shown when `product.mockupType !== null`
- Malfini: shown when `getCategoryConfig(product.categoryCode) !== null`

---

## Customer Image Upload

Customers upload PNG/JPG/WebP (≤10MB) via the "Kép" toolbar button in the designer.

**Flow:** File selected → `POST /api/designs/upload` (no auth) → validated (MIME + size) → stored in `designs` Supabase bucket at `uploads/{uuid}.{ext}` → public URL returned → `canvasRef.current.addImage(url)` → URL embedded in Fabric canvas JSON.

**Admin order detail:** Parses `order.design.canvasJson` for image objects whose `src` contains `/uploads/`. Shows thumbnails + download links in "Feltöltött képek" section. Detection: `(o.type ?? "").toLowerCase() === "image"` — required because Fabric v7 serializes as `"Image"` (capital I).

---

## Malfini API

- **Base URL:** `https://api.malfini.com`
- **Auth:** `POST /api/v4/api-auth/login` → `{ access_token, expires_in }` — cached until `expires_in - 1min`, auto-refreshed on 401

### Endpoints

| Endpoint | Cache | Notes |
|---|---|---|
| `GET /api/v4/product?language=hu` | Redis 25h / module 1h | Full catalog ~10MB. No per-product endpoint — filter client-side. |
| `GET /api/v4/product/recommended-prices?productCodes=...` | ISR 5min | Use for pricing. `productCodes` = 3-char code (e.g. `"M150"`), NOT 7-char SKU. |
| `GET /api/v4/product/availabilities?productCodes=...&includeFuture=true` | ISR 5min | Stock per SKU. Same `productCodes` rule. |

### Pricing
This account returns prices in **HUF** (`currency: "HUF"`). `buildPriceMap()` checks currency before converting. Retail prices rounded to nearest 10 HUF. Do not apply a markup multiplier — recommended prices are the intended retail prices.

### Images
`viewCode` lowercase: `"a"` = front, `"b"` = back, `"c"` = detail. **Always filter** products/variants to those with at least one `viewCode === "a"` image.

### Data shapes

```typescript
MalfiniProduct {
  code: string          // 3-char — URL identifier, productCodes filter param
  name: string
  categoryCode: string  // determines designer eligibility
  categoryName: string
  genderCode?: string   // GENTS | LADIES | KIDS | UNISEX | GENTS/KIDS | UNISEX/KIDS
  variants: MalfiniVariant[]
}

MalfiniVariant {
  code: string          // variant identifier = colorCode in URL params
  colorCode: string
  colorIconLink: string // color swatch image URL — use <img>, not backgroundColor
  name: string          // color display name
  images: { viewCode: string; link: string }[]
  nomenclatures: MalfiniNomenclature[]
}

MalfiniNomenclature {
  productSizeCode: string  // 7-char SKU — key for price/availability maps
  sizeCode: string         // for sorting (XS, S, M, L, XL...)
  sizeName: string         // display name e.g. "M", "110 cm/4 éves"
}
```

### Confirmed field values (from live API — 382 products)

**genderCode → UI filter:**
`GENTS` → Férfi · `LADIES` → Női · `KIDS` → Gyerek · `UNISEX` → Férfi + Női · `GENTS/KIDS` → Férfi + Gyerek · `UNISEX/KIDS` → Férfi + Női + Gyerek

**All categoryCode values:** `accessories`, `additional-assortment`, `bags`, `caps`, `fleece`, `jackets-vests`, `outlet`, `polo-shirts`, `promotional-materials`, `safety-footwear`, `shirts`, `sweatshirts`, `t-shirts`, `terry`, `trousers-shorts`

**Designer-enabled categories:** `t-shirts`, `sweatshirts`, `polo-shirts`

### Size ordering
Sort nomenclatures using `SIZE_ORDER`: `3XS → XXS → XS → S → M → L → XL → XXL → 3XL → 4XL → 5XL → 6XL → 86–170`. Unknown codes fall to end.

---

## Admin Panel

- Single admin user — credentials in env vars; no self-registration
- Auth: JWT in HTTP-only cookie (24h expiry) — all `/admin/*` routes protected by middleware
- **Orders:** list + detail with status updater, design SVG preview, coordinate table, customer upload download links, GDPR erasure button
- **Products:** local product CRUD + read-only Malfini catalog browser
- **Clipart:** upload SVG to `clipart` bucket, save metadata to `Clipart` table, toggle active/inactive
- **GDPR erasure:** nulls `customerName`, `customerEmail`, `shippingAddress` — order row retained 8 years

---

## Shipping

Two shipping methods, configured in `lib/shipping/config.ts`:

| Key | Label | Price |
|-----|-------|-------|
| `FOXPOST_LOCKER` | Foxpost csomagautomata | 990 HUF |
| `MPL_HOME_DELIVERY` | MPL házhozszállítás | 1 490 HUF |

Shipping cost is validated server-side in the checkout route — the client-supplied cost is compared against `SHIPPING_PRICES[method]` to prevent tampering. Shipping is added as a separate Stripe line item.

### Foxpost APT Finder widget

- `components/shop/FoxpostWidget.tsx` embeds `https://cdn.foxpost.hu/apt-finder/v1/app/` as an `<iframe>` — no registration or API key required for the map widget
- The iframe is loaded lazily on first modal open (so the container is visible when the widget initialises)
- Locker selection is communicated via `postMessage` from origin `https://cdn.foxpost.hu` as a **JSON string**
- Relevant fields from the payload: `operator_id` (stored as `pickupPointId`), `name`, `street`, `city`, `zip`
- For Foxpost orders, `shippingAddress` in the DB uses the locker's address so all orders have the same `shippingAddress` shape regardless of method

### Order confirmation email

`emails/OrderConfirmation.tsx` shows shipping method and:
- **MPL:** delivery address
- **Foxpost:** locker name + formatted address

---

## Future v2

- SimplePay payment option (Hungarian local payment provider)
- User accounts with saved designs
- Separate backend service extraction
- Frontend UI Redesign (Phase 7 — on hold, awaiting client brand assets)
