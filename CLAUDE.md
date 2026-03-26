# CLAUDE.md — Varázskép Webshop

Technical reference for Claude Code. Every session must be grounded in this document.

**Companion documents:**

- `plan.md` — development phases, workflow rules, review protocol
- `DESIGN.md` — visual design system, colors, typography, component styles

---

## Project Overview

**Varázskép** is a webshop for a small Hungarian local business that sells custom-printed t-shirts and mugs. Customers can personalize products using an interactive browser-based designer tool (predefined clipart + text), then check out as a guest.

**Core constraints (non-negotiable):**

- Guest-only checkout — no user accounts
- Predefined clipart only — no customer photo uploads in v1
- Orders are created in the database **only after Stripe webhook confirmation**
- Single Next.js application — no separate backend server
- All customer-facing text is in **Hungarian**

---

## Tech Stack

| Layer        | Technology              | Notes                                  |
| ------------ | ----------------------- | -------------------------------------- |
| Framework    | Next.js 14 (App Router) | TypeScript, strict mode                |
| Database     | PostgreSQL via Supabase | Hosted on Supabase free tier           |
| ORM          | Prisma                  | All schema changes via migrations only |
| Designer     | Fabric.js               | Client-side canvas, serialized to JSON |
| File Storage | AWS S3                  | SVG exports, 45-day lifecycle rule     |
| Payments     | Stripe                  | Checkout + Webhooks                    |
| Email        | Resend + React Email    | Order confirmation, admin notification |
| Hosting      | Vercel                  | Connected to main branch               |
| Styling      | Tailwind CSS            | No inline styles                       |

---

## Project Structure

```
varazskep/
├── app/
│   ├── (shop)/                  # Public storefront routes
│   │   ├── page.tsx             # Homepage / product listing
│   │   ├── termekek/[slug]/     # Product detail page
│   │   ├── tervezo/             # T-shirt designer page (Fabric.js)
│   │   ├── kosar/               # Cart page
│   │   ├── fizetes/             # Checkout page
│   │   ├── rendeles/[id]/       # Order confirmation page
│   │   ├── kapcsolat/           # Contact page
│   │   └── adatvedelem/         # Privacy policy page (GDPR)
│   ├── admin/                   # Admin panel (JWT-protected)
│   │   ├── login/
│   │   ├── rendelesek/          # Order management
│   │   └── termekek/            # Product management
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts    # Create Stripe session
│   │   │   └── webhook/route.ts     # Handle Stripe events → create order
│   │   ├── orders/route.ts
│   │   └── admin/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── designer/                # Fabric.js canvas components
│   │   ├── DesignerCanvas.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── ClipartPanel.tsx
│   │   └── TextTool.tsx
│   ├── shop/                    # Storefront components
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── CartItem.tsx
│   │   └── CheckoutForm.tsx
│   └── ui/                      # Shared primitives (Button, Input, etc.)
├── lib/
│   ├── db.ts                    # Prisma client singleton
│   ├── services/
│   │   ├── order.ts             # Order business logic
│   │   ├── design.ts            # Design serialization + SVG export
│   │   └── email.ts             # Resend integration
│   ├── auth/
│   │   └── jwt.ts               # JWT admin auth helpers
│   └── cart/
│       └── cartStore.ts         # Client-side cart state (Zustand)
├── prisma/
│   └── schema.prisma
├── public/
│   └── clipart/                 # SVG clipart assets
├── emails/                      # React Email templates (Hungarian)
├── __tests__/                   # Tests (critical paths only)
│   ├── webhook.test.ts
│   └── order.test.ts
├── .env.local                   # Never commit this file
├── CLAUDE.md                    # This file
└── plan.md                      # Development workflow
```

---

## Database Schema

### Models

```prisma
model Product {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  imageUrl    String?
  active      Boolean   @default(true)
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
  price     Int      // price in HUF (forint), stored as integer
  stock     Int      @default(0)
  orders    Order[]
}

model Design {
  id          String   @id @default(cuid())
  canvasJson  Json     // Fabric.js serialized canvas state (JSONB)
  svgUrl      String?  // S3 URL, nulled after 45 days
  createdAt   DateTime @default(now())
  expiresAt   DateTime // 45 days from createdAt
  order       Order?
}

model Order {
  id              String      @id @default(cuid())
  stripeSessionId String      @unique
  status          OrderStatus @default(PENDING)
  variantId       String
  variant         Variant     @relation(fields: [variantId], references: [id])
  designId        String?     @unique
  design          Design?     @relation(fields: [designId], references: [id])
  // Customer info (retained 8 years per Hungarian tax law)
  customerName    String
  customerEmail   String
  shippingAddress Json
  totalAmount     Int         // in HUF
  gdprConsent     Boolean
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

enum OrderStatus {
  PENDING
  PAID
  IN_PRODUCTION
  SHIPPED
  COMPLETE
  CANCELLED
}
```

**Key rules:**

- Prices are stored in **HUF as integers** (no decimals)
- Design JSON is stored as JSONB — never stringify it manually
- SVG URL is nulled after 45 days (S3 lifecycle + scheduled job or manual admin action)
- `Order` is only created in the `stripe/webhook` handler, never before

---

## Architectural Decisions

### Why orders are only created via webhook

Stripe Checkout can fail, be abandoned, or be fraudulent. Creating an order before payment confirmation leads to unpaid order spam. The webhook fires only after successful payment, making it the single source of truth.

### Why no user accounts

The business is small and local. Forcing registration kills conversion. Guest checkout with email order tracking is sufficient for v1.

### Why predefined clipart only

Personal photo uploads require content moderation, abuse prevention, larger storage, and GDPR complexity (photos are personal data). Predefined SVG clipart sidesteps all of this cleanly.

### Why a single Next.js app

The complexity of a separate API server is unnecessary at this scale. Next.js API routes handle all backend logic. If traffic warrants it, extraction to a separate service is a v3 concern.

---

## Language Standard

| Context                                    | Language  |
| ------------------------------------------ | --------- |
| Customer-facing UI (labels, buttons, text) | Hungarian |
| Error messages shown to customers          | Hungarian |
| Email templates                            | Hungarian |
| Admin panel UI                             | Hungarian |
| Code (variable names, function names)      | English   |
| Code comments                              | English   |
| Git commit messages                        | English   |
| This file and plan.md                      | English   |

---

## Environment Variables

Required in `.env.local` (never commit):

```env
# Database
DATABASE_URL="postgresql://..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."

# AWS S3
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="eu-central-1"
AWS_S3_BUCKET_NAME=""

# Email
RESEND_API_KEY="re_..."

# Admin Auth
JWT_SECRET=""         # min 32 chars, random string

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Development Rules

### TypeScript

- `strict: true` in `tsconfig.json` — no exceptions
- No `any` type — use `unknown` and narrow it, or define a proper type
- All API route handlers must be typed with `NextRequest` / `NextResponse`
- All Prisma results typed via generated types — do not redefine model types manually

### Architecture

- Components **never** call Prisma directly — all DB access goes through `lib/services/`
- Client components only access the database via API routes — never via server-only imports
- `lib/db.ts` exports a singleton Prisma client — do not instantiate Prisma anywhere else

### Styling

- Tailwind CSS classes only — no inline `style={{}}` props
- No CSS modules unless Tailwind is genuinely insufficient
- Mobile-first responsive design
- All visual decisions (colors, typography, spacing, components) are defined in `DESIGN.md` — follow it strictly

### Schema Changes

- Always create a Prisma migration (`npx prisma migrate dev --name <name>`)
- Never edit the database directly with raw SQL
- Migration names must be descriptive: `add_gdpr_consent_to_order`, not `update1`

### File & Component Rules

- Designer components live in `components/designer/` only
- Shop-facing components live in `components/shop/` only
- Shared/generic primitives (Button, Input, Modal) live in `components/ui/` only
- One component per file — no barrel exports from `components/`

### Testing

Tests are required **only** for:

- `app/api/stripe/webhook/route.ts` — order creation logic
- `lib/services/order.ts` — order status transitions
- `lib/services/design.ts` — SVG export logic

Use **Vitest** for unit/integration tests. No end-to-end testing framework in v1.

---

## GDPR & Legal Requirements

This is a legal obligation, not optional:

| Data                                | Retention                                   | Rule                                   |
| ----------------------------------- | ------------------------------------------- | -------------------------------------- |
| Order metadata (amounts, items)     | 8 years                                     | Hungarian tax law (Számviteli törvény) |
| Customer PII (name, email, address) | 8 years for accounting, erasable on request | GDPR Art. 17                           |
| Design JSON (canvasJson)            | Nulled after 45 days                        | Internal policy                        |
| SVG files on S3                     | Deleted after 45 days                       | S3 Lifecycle Rule                      |

**Required features:**

1. GDPR consent checkbox at checkout (unchecked by default, must be checked to submit)
2. Privacy policy page at `/adatvedelem`
3. Admin panel GDPR erasure function (nulls PII fields, does not delete the order row)

---

## Admin Panel

- Single admin user — credentials stored as environment variables
- Authentication via JWT (HTTP-only cookie, 24h expiry)
- All `/admin/*` routes protected by Next.js middleware
- No self-registration — admin account is seeded once

---

## Future v2 (out of scope for current development)

- Cloudinary integration for customer photo uploads
- SimplePay as a payment option (Hungarian local payment provider)
- User accounts with saved designs
- Multi-product designer
- Separate backend service extraction
