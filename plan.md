# plan.md — Varázskép Development Workflow

This document governs how development is conducted on this project. It is a binding rulebook — every session follows these rules.

---

## Workflow Philosophy

Development is **controlled and sequential**. Each phase is a gate: the next phase does not begin until the current one is fully reviewed and explicitly approved. Speed is secondary to correctness and mutual understanding.

The goal is that at every point in the project, the codebase is:

1. Working (no broken states between steps)
2. Understood (you have reviewed and approved every file)
3. Traceable (every decision connects back to the architecture)

---

## Review & Approval Protocol

This protocol applies to **every implementation step**, without exception.

### After each step, Claude must:

1. **List every file created or modified** in that step
2. **For each file, provide:**
   - Its purpose (what it is and what it does)
   - The core logic inside it (key decisions, patterns used)
   - How it connects to the rest of the system (what it depends on, what depends on it)
3. **Flag any deviation** from `CLAUDE.md`, `DESIGN.md`, or the architecture document, and explain why
4. **Wait for explicit approval** before proceeding

### You (the developer) must:

- Read the walkthrough and the actual code
- Ask any questions before approving
- Give one of three responses:
  - **"Approved"** — proceed to the next step
  - **"Change: [description]"** — Claude makes the change, then re-presents the walkthrough
  - **"Question: [question]"** — Claude answers before you decide

Claude must **never proceed to the next step without an explicit approval**.

---

## Git Workflow

### Branch structure

```
main                          # Always stable and deployable
├── phase-1/foundation        # Phase 1 main branch
│   ├── phase-1/project-init
│   ├── phase-1/prisma-schema
│   ├── phase-1/seed
│   ├── phase-1/product-listing
│   └── phase-1/product-detail
├── phase-2/storefront
│   ├── phase-2/cart
│   ├── phase-2/checkout-form
│   ├── phase-2/stripe-checkout
│   ├── phase-2/stripe-webhook
│   └── phase-2/order-confirmation
├── phase-3/designer
│   ├── phase-3/canvas-setup
│   ├── phase-3/color-picker
│   ├── phase-3/clipart-panel
│   ├── phase-3/text-tool
│   ├── phase-3/design-serialization
│   └── phase-3/svg-export
├── phase-4/admin
│   ├── phase-4/jwt-auth
│   ├── phase-4/order-dashboard
│   ├── phase-4/product-management
│   ├── phase-4/clipart-management
│   ├── phase-4/gdpr-erasure
│   ├── phase-4/seo
│   └── phase-4/deployment
└── phase-6/malfini-integration   # all Phase 6 steps committed here
```

### Rules

- Each **phase** gets its own branch (e.g. `phase-6/malfini-integration`)
- All steps within a phase are committed to that phase branch
- Phase branches are pushed to GitHub and merge into **`main`** at the end of each phase
- Individual steps do **not** get their own branches — one branch per phase only
- Commit messages use **Conventional Commits** format:
  - `feat: add product listing page`
  - `fix: correct price calculation in cart`
  - `chore: add prisma migration for order model`
  - `refactor: extract order creation to service layer`
  - `test: add webhook handler unit tests`
- Never force-push to `main`
- Never commit `.env.local` or any file containing secrets

---

## Development Phases

### Phase 1 — Foundation

**Goal:** A running Next.js app with a database, real product data, and a working product listing.

| Step | Description                                                                      | Branch                    |
| ---- | -------------------------------------------------------------------------------- | ------------------------- |
| 1.1  | Project init: Next.js 14, TypeScript, ESLint, Prettier, Tailwind                 | `phase-1/project-init`    |
| 1.2  | Prisma schema: Product, Variant, Design, Order models + migration                | `phase-1/prisma-schema`   |
| 1.3  | Seed script with sample products and variants                                    | `phase-1/seed`            |
| 1.4  | Global layout: header (logo + nav), footer, Tailwind config matching `DESIGN.md` | `phase-1/layout`          |
| 1.5  | Product listing page (`/`) — Hungarian UI, product grid per design spec          | `phase-1/product-listing` |
| 1.6  | Product detail page (`/products/[slug]`) — variant selection                     | `phase-1/product-detail`  |
| 1.7  | Contact page (`/contact`) — address, phone, opening hours                      | `phase-1/contact-page`    |

**Phase 1 complete when:** The app runs locally, products are visible from the database, the header/nav matches the design spec (including the Tervező menu item), and all steps are reviewed and approved.

---

### Phase 2 — Storefront & Checkout

**Goal:** A complete purchase flow from cart to paid order, with confirmation email.

| Step | Description                                                           | Branch                       |
| ---- | --------------------------------------------------------------------- | ---------------------------- |
| 2.1  | Cart: Zustand store, cart page (`/cart`), add/remove/update          | `phase-2/cart`               |
| 2.2  | Checkout form (`/checkout`): guest fields, GDPR consent checkbox       | `phase-2/checkout-form`      |
| 2.3  | Stripe Checkout session creation (API route)                          | `phase-2/stripe-checkout`    |
| 2.4  | Stripe webhook handler → order creation in DB (+ unit tests)          | `phase-2/stripe-webhook`     |
| 2.5  | Order confirmation page (`/orders/[id]`) + Resend email (Hungarian) | `phase-2/order-confirmation` |

**Phase 2 complete when:** A real Stripe test payment creates an order in the database and triggers a confirmation email.

---

### Phase 3 — Designer Module

**Goal:** Customers can design their product on a Fabric.js canvas, save the design, and include it in their order.

| Step | Description                                                                                                                                                                                                          | Branch                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 3.1  | Fabric.js canvas setup, t-shirt mockup background layer                                                                                                                                                              | `phase-3/canvas-setup`         |
| 3.2  | Color picker: swatches in left toolbar update the t-shirt SVG fill color on the canvas                                                                                                                               | `phase-3/color-picker`         |
| 3.3  | Clipart panel: `Clipart` Prisma model + migration; seed sample SVGs; API route to fetch figures; modal overlay catalog (customer clicks figure → modal closes → figure placed on canvas inside print area, movable/resizable) | `phase-3/clipart-panel`        |
| 3.4  | Text tool: add/edit text on canvas, font and color options                                                                                                                                                           | `phase-3/text-tool`            |
| 3.5  | Design serialization + product wiring: add `mockupType` to Product schema (migration); add `mug-mockup.svg`; designer loads correct mockup per product type; pass product/color/size via URL params from product page; default to "egyedi-polo" on direct `/designer` access; product icon button in toolbar navigates to `/products`; pre-create Design record on "add to cart"; pass `designId` in Stripe metadata; hide designer button on products with no `mockupType` | `phase-3/design-serialization` |
| 3.6  | Server-side SVG export: triggered after webhook, uploaded to Supabase Storage `designs` bucket (45-day retention)                                                                                                    | `phase-3/svg-export`           |

**Phase 3 complete when:** A designed product can be ordered end-to-end and the resulting SVG is visible in Supabase Storage after payment.

---

### Phase 4 — Admin Panel & Production

**Goal:** The business can manage orders and products, the app meets legal requirements, and it is deployed to production.

| Step | Description                                                                                                                              | Branch                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 4.1  | JWT admin auth: login page, middleware, HTTP-only cookie                                                                                 | `phase-4/jwt-auth`           |
| 4.2  | Order dashboard: list all orders, update status, view design                                                                             | `phase-4/order-dashboard`    |
| 4.3  | Product management: create, edit, toggle active/inactive                                                                                 | `phase-4/product-management` |
| 4.4  | Clipart management: upload SVG to Supabase Storage `clipart` bucket, save metadata to `Clipart` table, toggle active/inactive            | `phase-4/clipart-management` |
| 4.5  | GDPR erasure function: null PII fields on demand                                                                                         | `phase-4/gdpr-erasure`       |
| 4.6  | SEO: metadata per page, sitemap.xml, robots.txt                                                                                          | `phase-4/seo`                |
| 4.7  | Production deployment: Vercel setup, env vars, custom domain                                                                             | `phase-4/deployment`         |
| 4.8  | Supabase Storage lifecycle: verify 45-day auto-delete on `designs` bucket, post-launch verification                                      | `phase-4/deployment`         |

**Phase 4 complete when:** The app is live on Vercel, a real order can be placed end-to-end, and the admin panel is functional.

---

### Phase 5 — Frontend UI Redesign

**Goal:** Replace the current generic template UI with a visual design that matches the client's brand image. Every customer-facing page should feel cohesive, polished, and on-brand.

| Step | Description | Branch |
| ---- | ----------- | ------ |
| 5.1  | Brand audit: collect client assets (logo, colors, fonts, reference images), update `DESIGN.md` with the final design system | `phase-5/brand-audit` |
| 5.2  | Global elements: header, footer, typography, color tokens, button styles | `phase-5/global-elements` |
| 5.3  | Homepage & product listing: hero section, product grid, product cards | `phase-5/homepage` |
| 5.4  | Product detail page: image, variant selector, CTA | `phase-5/product-detail` |
| 5.5  | Designer page: toolbar, canvas area, panel styling | `phase-5/designer` |
| 5.6  | Cart & checkout pages | `phase-5/cart-checkout` |
| 5.7  | Order confirmation & contact pages | `phase-5/remaining-pages` |
| 5.8  | Visual QA: cross-browser, mobile responsiveness, final polish | `phase-5/visual-qa` |

**Phase 5 complete when:** All customer-facing pages match the agreed brand design, look consistent on mobile and desktop, and have been reviewed and approved page by page.

**Prerequisites before starting:**
- Client provides logo (SVG preferred), brand colors, and any reference images or inspiration
- Design decisions are documented in `DESIGN.md` before any code is written

---

### Phase 6 — Malfini API Integration

**Goal:** Replace dummy products with live Malfini catalog data. Clothing products (t-shirts and sweatshirts for Phase 6) are fetched from the Malfini REST API; non-clothing products (mugs, etc.) continue to be managed locally. Full architecture documented in `MALFINI_REFACTOR.md`.

| Step | Description | Branch |
| ---- | ----------- | ------ |
| 6.1  | Malfini API layer: `lib/malfini/` — types, auth, client, pricing, categoryConfig | `main` (done — committed directly, exception) |
| 6.1b | Test + discovery: temp `GET /api/admin/malfini-test` route, discover real `categoryCode` + `genderCode` values, CORS check on image URLs, populate `categoryConfig.ts` | `phase-6/malfini-integration` |
| 6.2  | DB schema: make `Order.variantId` nullable, add `productSizeCode`, `productCode`, `productName`, `colorName`, `sizeName`; migration `make_variant_nullable_add_malfini_order_fields` | `phase-6/malfini-integration` |
| 6.3  | Cart store: add `source` discriminator + Malfini fields, rename `color`→`colorName` / `size`→`sizeName`, bump Zustand persist version | `phase-6/malfini-integration` |
| 6.4  | API routes: update Stripe checkout + webhook for both sources | `phase-6/malfini-integration` |
| 6.5  | Shop UI: unified products page (5-col grid, 30/page, gender filter + category tabs, "tól X Ft" prices), `MalfiniProductCard`, Malfini product detail route + `MalfiniProductDetails` | `phase-6/malfini-integration` |
| 6.6  | Designer: extract `colorUtils.ts`, update `DesignerCanvas` (`imageUrl` prop), update `DesignerLayout` (Malfini mode + color-swap in-place), update designer page routing, update `ColorPicker` | `phase-6/malfini-integration` |
| 6.7  | Admin: update order display for both sources, add read-only Malfini catalog browser | `phase-6/malfini-integration` |
| 6.8  | Supporting files: next.config image domains, sitemap, order confirmation page | `phase-6/malfini-integration` |

**Phase 6 complete when:** Malfini t-shirts and sweatshirts appear in the unified shop with gender + category filtering, can be designed and ordered end-to-end, and local mug product continues to work unchanged.

**Prerequisites before starting step 6.1b:**
- Add `MALFINI_API_URL`, `MALFINI_USERNAME`, `MALFINI_PASSWORD`, `EUR_TO_HUF_RATE` to `.env.local`

---

### Phase 7 — Future v2 (not in current scope)

These features are planned but must not be built during the current development cycle:

- Cloudinary integration for customer photo uploads
- SimplePay payment option (Hungarian local payment provider)
- User accounts with saved designs
- Separate backend service extraction

Do not design current code around these — build what is needed now, keep it simple.

---

## Definition of Done

A **step** is done when:

- [ ] The code is implemented and runs without errors
- [ ] Claude has delivered the file-by-file walkthrough
- [ ] You have reviewed the code and the walkthrough
- [ ] You have given explicit approval
- [ ] The step is committed to the phase branch

A **phase** is done when:

- [ ] All steps in the phase are done
- [ ] The app demonstrates the phase's goal end-to-end (see phase description)
- [ ] The phase branch is merged to `main`
- [ ] `main` runs without errors

---

## What Claude Must Always Do

1. **Read before writing.** Never modify a file without reading it first.
2. **Follow the folder structure** defined in `CLAUDE.md`. No new top-level directories without discussion.
3. **No direct DB calls in components.** All database access goes through `lib/services/`.
4. **Hungarian UI text.** Every string shown to a customer must be in Hungarian.
5. **Strict TypeScript.** No `any`. No type assertions without justification.
6. **No inline styles.** Tailwind classes only.
7. **Flag deviations.** If something in `CLAUDE.md` or the architecture doesn't fit, flag it and discuss before proceeding.
8. **Follow `DESIGN.md` for all UI.** Colors, fonts, spacing, component styles — always from the design system. No improvising.
9. **Never proceed without approval.** This is the most important rule.

---

## What Claude Must Never Do

- Start the next step before the current step is approved
- Create files outside the structure defined in `CLAUDE.md`
- Write customer-facing text in English
- Use `any` types without explicit justification and approval
- Commit `.env.local` or any secrets
- Push to `main` directly (always use a branch)
- Make architectural decisions (new libraries, new patterns) without flagging them first
- Skip the file-by-file walkthrough, even for "simple" steps

---

## Quick Reference: Current Status

> Update this section at the start of each session to reflect where we are.

**Current phase:** Phase 6 — Malfini API Integration (in progress)
**Current step:** Step 6.4 — Stripe checkout + webhook
**Last approved step:** Step 6.3 — Cart store
**Next step:** Step 6.4 — Stripe checkout + webhook (branch: `phase-6/malfini-integration`)

**Note:** Phase 5 (Frontend UI Redesign) is on hold — awaiting client brand assets. It will run after Phase 6.

