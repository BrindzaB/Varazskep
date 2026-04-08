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
├── phase-6/malfini-integration   # all Phase 5 steps committed here (branch kept original name)
├── phase-7/customer-image-upload # Phase 6 step 6.1
└── phase-7/redis-cache           # Phase 6 step 6.2
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

### Phase 1 — Foundation ✅ Done

Next.js 14 init, Prisma schema (Product/Variant/Design/Order), seed script, global layout (header/nav/footer), product listing page, product detail page, contact page.

---

### Phase 2 — Storefront & Checkout ✅ Done

Zustand cart, guest checkout form with GDPR consent, Stripe Checkout session, Stripe webhook → order creation, order confirmation page + Resend email.

---

### Phase 3 — Designer Module ✅ Done

Fabric.js canvas with t-shirt/mug mockup, color picker, clipart panel (Prisma model + Supabase Storage), text tool, design serialization (front/back), canvas JSON → Stripe metadata → webhook linkage, server-side SVG export to `designs` bucket.

---

### Phase 4 — Admin Panel & Production ✅ Done

JWT admin auth (HTTP-only cookie), order dashboard with status management, local product CRUD, clipart management, GDPR erasure function, SEO (metadata/sitemap/robots), Vercel production deployment.

---

### Phase 5 — Malfini API Integration ✅ Done

**Goal:** Replace dummy products with live Malfini catalog data. Clothing products (t-shirts and sweatshirts for Phase 5) are fetched from the Malfini REST API; non-clothing products (mugs, etc.) continue to be managed locally. Full architecture documented in `ARCHITECTURE.md`.

| Step | Description | Branch |
| ---- | ----------- | ------ |
| 5.1  | Malfini API layer: `lib/malfini/` — types, auth, client, pricing, categoryConfig | `main` (done — committed directly, exception) |
| 5.1b | Test + discovery: temp `GET /api/admin/malfini-test` route, discover real `categoryCode` + `genderCode` values, CORS check on image URLs, populate `categoryConfig.ts` | `phase-6/malfini-integration` |
| 5.2  | DB schema: make `Order.variantId` nullable, add `productSizeCode`, `productCode`, `productName`, `colorName`, `sizeName`; migration `make_variant_nullable_add_malfini_order_fields` | `phase-6/malfini-integration` |
| 5.3  | Cart store: add `source` discriminator + Malfini fields, rename `color`→`colorName` / `size`→`sizeName`, bump Zustand persist version | `phase-6/malfini-integration` |
| 5.4  | API routes: update Stripe checkout + webhook for both sources | `phase-6/malfini-integration` |
| 5.5  | Shop UI: unified products page (5-col grid, 30/page, gender filter + category tabs, "tól X Ft" prices), `MalfiniProductCard`, Malfini product detail route + `MalfiniProductDetails` | `phase-6/malfini-integration` |
| 5.6  | Designer: extract `colorUtils.ts`, update `DesignerCanvas` (`imageUrl` prop), update `DesignerLayout` (Malfini mode + color-swap in-place), update designer page routing, update `ColorPicker` | `phase-6/malfini-integration` |
| 5.7  | Admin: update order display for both sources, add read-only Malfini catalog browser | `phase-6/malfini-integration` |
| 5.8  | Supporting files: next.config image domains, sitemap, order confirmation page | `phase-6/malfini-integration` |

**Phase 5 complete when:** Malfini t-shirts and sweatshirts appear in the unified shop with gender + category filtering, can be designed and ordered end-to-end, and local mug product continues to work unchanged. ✅ Done.

---

### Phase 6 — Feature Additions

**Goal:** Extend the designer and infrastructure with additional customer-facing features and performance improvements.

| Step | Description | Branch |
| ---- | ----------- | ------ |
| 6.1  | Customer image upload: new "Kép" toolbar button, `POST /api/designs/upload` endpoint, `addImage()` on canvas ref, admin order detail shows uploaded image download links | `phase-7/customer-image-upload` |
| 6.2  | Upstash Redis shared cache: L1 (module-level) + L2 (Redis, 25h TTL) for Malfini catalog; `warmupMalfiniCache()` export; warmup cron writes to Redis unconditionally | `phase-7/redis-cache` |

**Phase 6 complete when:** Customers can upload their own images in the designer, and the Malfini catalog cold start is eliminated across all serverless instances. ✅ Done.

---

### Phase 7 — Frontend UI Redesign (on hold)

**Goal:** Replace the current generic template UI with a visual design that matches the client's brand image.

**Status: On hold — awaiting client brand assets (logo, colors, reference images).**

Will be planned in detail once assets are available. Rough steps: brand audit → global elements → page-by-page redesign → visual QA.

---

### Future v2 (not in current scope)

These features are planned but must not be built during the current development cycle:

- SimplePay as a payment option (Hungarian local payment provider)
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

**Current phase:** Phase 6 — Feature Additions (complete)
**Last approved step:** 6.2 — Upstash Redis shared cache for Malfini catalog
**Next step:** Phase 7 (Frontend UI Redesign) — on hold, awaiting client brand assets

