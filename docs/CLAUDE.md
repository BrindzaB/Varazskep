# CLAUDE.md — Varázskép Webshop

Hungarian custom-printed clothing and mugs webshop. Customers design products via a Fabric.js canvas, then check out as guests.

**Companion documents — read these for detail:**
- `docs/ARCHITECTURE.md` — project structure, schema, architectural decisions, designer system, Malfini API facts
- `docs/PLAN.md` — workflow rules, approval protocol, phase history, current status
- `public/swagger.json` — full Malfini REST API v4 OpenAPI spec (use this; docs site requires JS rendering)

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript strict mode |
| Database | PostgreSQL via Supabase | Prisma ORM; migrations only |
| Designer | Fabric.js v7 | Client-side canvas; serializes types as `"Image"` / `"IText"` (capital I) |
| Storage | Supabase Storage | `clipart` bucket (permanent) · `designs` bucket (45-day expiry) |
| Cache | Upstash Redis | Shared L2 for Malfini catalog (25h TTL); L1 = module-level per instance (1h) |
| Payments | Stripe | Checkout + Webhooks |
| Email | Resend + React Email | Hungarian templates |
| Hosting | Vercel | main branch; daily warmup cron at 05:00 UTC |
| Styling | Tailwind CSS | No inline styles except dynamic runtime values (hex color, fontFamily) |
| Brand colors | `tailwind.config.ts` | `brand-blue: #0fa0e4` · `brand-violet: #e5197f` · `charcoal: #4d4a48` (text) |

---

## Hard Constraints

- Guest-only checkout — no user accounts
- Orders created **only** in `stripe/webhook` handler, never before
- All customer-facing text in **Hungarian**
- No `any` type — TypeScript strict throughout
- No inline `style={{}}` — Tailwind only (exceptions: hex backgroundColor, fontFamily from data)
- All DB access via `lib/services/` — components never call Prisma directly
- Schema changes via `npx prisma migrate dev --name <name>` only — no raw SQL

---

## Product Sources

- **Clothing** (t-shirts, sweatshirts, polo shirts) — Malfini REST API, cached in Redis (L2) + module memory (L1)
- **Other** (mugs, etc.) — local Prisma `Product` + `Variant` tables

---

## Key File Locations

| File | Purpose |
|---|---|
| `lib/malfini/client.ts` | `getProducts()`, `getProduct()`, `warmupMalfiniCache()` |
| `lib/malfini/categoryConfig.ts` | categoryCode → designer print area config |
| `lib/malfini/types.ts` | TypeScript interfaces for Malfini API responses |
| `lib/redis.ts` | Upstash Redis singleton + key/TTL constants |
| `lib/services/design.ts` | Design serialization + SVG export |
| `lib/services/order.ts` | Order business logic |
| `lib/cart/cartStore.ts` | Zustand cart (`source: "local" \| "malfini"`) |
| `components/designer/DesignerLayout.tsx` | Designer state, toolbar, canvas, panels (both product modes) |
| `components/designer/DesignerCanvas.tsx` | Fabric.js canvas ref: `addClipart`, `addImage`, `addText`, `getCanvasJson` |
| `app/(shop)/designer/page.tsx` | Routes `?code` → Malfini, `?slug` → local, no params → product picker |
| `app/api/designs/upload/route.ts` | Customer image upload → `designs` bucket `uploads/` subfolder |
| `app/api/warmup/route.ts` | Malfini catalog warmup (called by cron + manually after first deploy) |
| `prisma/schema.prisma` | Database schema |
| `public/Fekvo-logo.svg` | Brand logo — used in Header and Footer |
| `public/images/hero-bg.jpg` | Homepage hero background photo (add file here) |
| `lib/designer/mockupConfig.ts` | Local product mockup SVG paths + print area config |
| `lib/designer/colorUtils.ts` | SVG color replacement for local mockups |

---

## Language Standard

| Context | Language |
|---|---|
| Customer-facing UI, error messages, emails | Hungarian |
| Admin panel UI | Hungarian |
| Code, comments, commit messages, this file | English |

---

## Development Rules

- **Folders**: designer components → `components/designer/`, shop → `components/shop/`, shared → `components/ui/`; one component per file
- **Testing**: Vitest required only for `stripe/webhook`, `lib/services/order.ts`, `lib/services/design.ts`
- **Migrations**: always `npx prisma migrate dev --name <descriptive-name>`
- **Fabric v7**: types serialize as `"Image"` / `"IText"` — normalize with `.toLowerCase()` before comparing

---

## GDPR Essentials

- Orders + customer PII: 8-year retention (Hungarian tax law)
- `Design.canvasJson`: nulled after 45 days; `designs` bucket (SVGs + customer uploads): 45-day lifecycle
- Admin GDPR erasure: nulls PII fields on demand, order row is kept

---

## Environment Variables

```
DATABASE_URL
STRIPE_SECRET_KEY  STRIPE_WEBHOOK_SECRET  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY  NEXT_PUBLIC_SUPABASE_URL
SUPABASE_STORAGE_BUCKET_CLIPART  SUPABASE_STORAGE_BUCKET_DESIGNS
RESEND_API_KEY  JWT_SECRET  NEXT_PUBLIC_APP_URL  CRON_SECRET
MALFINI_API_URL  MALFINI_USERNAME  MALFINI_PASSWORD  EUR_TO_HUF_RATE
UPSTASH_REDIS_REST_URL  UPSTASH_REDIS_REST_TOKEN
```
