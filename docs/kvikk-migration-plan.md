# kvikk-migration-plan.md — Phase 8: Kvikk Shipping Integration

**Status:** Proposed — for review. Not yet approved; no code written.
**Governed by:** `docs/PLAN.md` (controlled, sequential, step-by-step approval).
**API reference:** `docs/kvikk-api.md`.

---

## Goal

Fully replace the current shipping solution — the Foxpost APT-Finder iframe
(`components/shop/FoxpostWidget.tsx`), the MPL address form, and the hardcoded prices in
`lib/shipping/config.ts` (none of which talk to a carrier API) — with a **complete Kvikk
Shipping API integration**: real multi-courier pickup-point selection, automatic shipment
+ label creation on payment, real-time tracking via webhook, and batch courier pickup
(delivery notes) from the admin panel.

### End-to-end flow after migration

```
Checkout      → Kvikk Map widget: customer picks courier + point (or home address)
                 shipping cost computed from Kvikk pricing (by courier + weight)
Payment       → Stripe (unchanged; shipping still a line item)
Stripe webhook→ POST /shipment → store Kvikk + courier tracking numbers on the Order
Kvikk webhook → HMAC-verified status push → advance Order status (SHIPPED / COMPLETE / RETURNED)
Admin         → batch POST /delivery-note (courier pickup) + on-demand label download
```

---

## Decisions

**Resolved (from client):**
- **Weight** — use Malfini's per-size `grossWeight` (kg → g) where available; otherwise a
  fixed per-product estimate.
- **Pricing** — dynamic, taken from Kvikk (`GET /account-details` → `pricing`), which
  reflects each courier's rates.

- **Two keys (confirmed).** Two separate keys under different menus: **Kvikk API**
  (secret, server-only, `X-API-KEY` on every request) and **Kvikk Maps** (separate
  permissions, **scoped to a website route/domain**, safe to expose client-side). Env:
  `KVIKK_API_KEY` (secret) + `NEXT_PUBLIC_KVIKK_MAP_API_KEY` (client). Register the
  production domain (+ a dev/preview origin if local testing needs it) for the Maps key.

**Still open (need input before the affected step; do not block earlier steps):**
1. **Which couriers to enable** at checkout (mpl / foxpost / packeta / gls / dpd / …).
   Depends on which are active in the Kvikk account.
2. **Customer price model** — pass Kvikk's computed cost through 1:1, or keep simple flat
   customer-facing prices (e.g. one price for "home", one for "point") while Kvikk pricing
   is used internally as cost. *(Recommendation: simple flat customer price per delivery
   type initially — least friction — with Kvikk cost tracked internally. Revisit later.)*
3. **Sandbox / test key** — confirm whether Kvikk offers a test environment so
   development doesn't create real courier pickups. *(If none: gate `POST /shipment` and
   `POST /delivery-note` behind a `KVIKK_LIVE` flag during development.)*
4. **`deliveryPointType` mapping** — verify the `(courier, mapType) → deliveryPointType`
   table (e.g. `packeta` + `zbox` → `packeta_zbox`) with one real test shipment.

---

## New / changed surface area

| Area | Change |
|---|---|
| `lib/kvikk/` (new) | `types.ts`, `client.ts` (create/get/delete/label/delivery-note/delivery-points/account-details), `deliveryPointMap.ts`, `pricing.ts` |
| `lib/shipping/config.ts` | Repurposed or removed — prices now derive from Kvikk |
| `lib/malfini/types.ts` + `client.ts` | Capture `grossWeight` on nomenclatures |
| `prisma/schema.prisma` | Generalize `Order` shipping fields; extend `OrderStatus`; migration |
| `components/shop/KvikkMapWidget.tsx` (new) | Replaces `FoxpostWidget.tsx` |
| `components/shop/CheckoutForm.tsx` | Courier/delivery-type selection + Map widget wiring |
| `app/api/stripe/checkout/route.ts` | Server-side point validation + shipping cost from Kvikk |
| `app/api/stripe/webhook/route.ts` | Create Kvikk shipment after payment |
| `app/api/kvikk/webhook/route.ts` (new) | HMAC-verified status push → order status |
| `app/admin/orders/**` | Tracking numbers/events, label download, delivery-note batch UI |
| `emails/OrderConfirmation.tsx` | Courier + tracking link; optional "shipped" email |
| env | `KVIKK_API_KEY` (secret), `NEXT_PUBLIC_KVIKK_MAP_API_KEY` (client), `KVIKK_WEBHOOK_SECRET`, `KVIKK_SENDER_ID` |

---

## Steps

Each step follows the `docs/PLAN.md` approval protocol (file-by-file walkthrough, then
explicit approval). Suggested branch: `phase-8/kvikk-shipping`.

### 8.1 — Kvikk API client layer (`lib/kvikk/`)
- `types.ts` — request/response types for all endpoints (from `docs/kvikk-api.md`).
- `client.ts` — thin fetch wrapper: `X-API-KEY` header, envelope unwrap, typed errors
  from the documented error codes. Functions: `createShipment`, `getShipment`,
  `deleteShipment`, `getLabel`, `createDeliveryNote`, `getDeliveryPoints`,
  `getAccountDetails`.
- `deliveryPointMap.ts` — `(courier, mapType) → deliveryPointType` lookup (§Decision 5).
- No UI yet. Unit-testable in isolation.

### 8.2 — Weight sourcing (no DB changes) ✅ Done
- Extend `MalfiniNomenclature` to surface `netWeight`/`grossWeight` (kg) — already present
  in the API response, just not typed. Add `getNomenclatureGrossWeightKg()` to the Malfini
  client to look weight up by SKU.
- `lib/kvikk/weight.ts` — pure helpers: `kgToGrams()`, `DEFAULT_PARCEL_WEIGHT_GRAMS`,
  `resolveWeightGrams({ storedGrams, grossWeightKg })` (priority: stored → Malfini kg → default).
- The local `Variant.weightGrams` column and the item-level `resolveParcelWeightGrams(item)`
  resolver moved to 8.3, consolidated with the schema migration (single DB touch).

### 8.3 — DB schema + migration (single migration for all schema changes)
- `Variant`: add `weightGrams Int?` (nulls fall back via `weight.ts`).
- Generalize `Order`: add `shippingCourier String?`, `deliveryType` enum
  (`HOME_DELIVERY | DELIVERY_POINT`), `deliveryPointType String?`, `deliveryPointId
  String?`; keep `pickupPointName`/`pickupPointAddress` for display; add
  `kvikkTrackingNumber String?`, `courierTrackingNumber String?`, `kvikkShipmentId
  String?`.
- Extend `OrderStatus` with `RETURNED`.
- `lib/services/shipping.ts` — `resolveParcelWeightGrams(item)` ties `Variant.weightGrams`
  + Malfini gross weight + `weight.ts` together (DB access lives in the service layer).
- **Retention:** existing orders must keep their historical shipping data — additive
  migration + backfill old `shippingMethod`/`pickupPoint*` into the new columns; do not
  drop columns destructively. Exact backfill mapping decided at this step.
- `npx prisma migrate dev --name kvikk_shipping_fields`.

### 8.4 — Pricing
- `lib/kvikk/pricing.ts` — given courier + parcel weight, compute shipping cost from
  cached `GET /account-details` pricing. Cache account-details (Redis, short TTL).
- Decide customer-facing price model per §Decision 2; expose a single
  `getShippingQuote({ courier, weight })` used by both the Map widget config and the
  server-side checkout validation (one source of truth).
- **VAT:** the official price list (`docs/kvikk-arlista-*.pdf`) is NET (ÁFA excluded);
  our customer prices are gross ("Az ár tartalmazza az ÁFÁ-t"). If Kvikk cost is passed to
  the customer, add 27% VAT. Confirm at this step whether `account-details` pricing is net
  or gross. COD fees are irrelevant (COD is always 0 — Stripe is prepaid).
- **Do NOT hardcode the PDF numbers.** `account-details` is the authoritative, account-
  specific source; the PDF is a dated reference/sanity-check snapshot only. Note the
  net 300 Ft admin fee for wrong weight/oversize — reinforces accurate weight (8.2).

### 8.5 — Checkout UI (`KvikkMapWidget.tsx` + `CheckoutForm.tsx`)
- New `KvikkMapWidget.tsx`: load the widget script, `open()` with configured couriers +
  prices + brand colors + `hu`; handle both standard point and `fallbackInfo`.
- `CheckoutForm`: delivery-type + courier selection; show selected point; keep the home
  address branch; validate as today. Remove Foxpost widget usage.

### 8.6 — Checkout API (`stripe/checkout`)
- Server-side validate the selected point via `GET points-api…/map/point`.
- Recompute shipping cost server-side via `getShippingQuote` (never trust client).
- Embed courier / deliveryType / deliveryPointType / deliveryPointID (+ display name)
  in Stripe session metadata.

### 8.7 — Create shipment on payment (`stripe/webhook`)
- After the order is created, call `POST /shipment` (single parcel; `cod: 0`; `value` =
  item price; weight from 8.2; `senderID` from env/account-details).
- Persist `kvikkTrackingNumber`, `courierTrackingNumber`, `kvikkShipmentId`.
- Failure handling: shipment-creation errors must **not** cause Stripe retries/duplicate
  orders — log, mark the order for manual retry, and surface it in admin. (Order already
  exists; shipment is a follow-up side effect, like the current email/SVG export.)
- Behind `KVIKK_LIVE` during development (§Decision 4).

### 8.8 — Kvikk status webhook (`app/api/kvikk/webhook/route.ts`)
- Verify `kvikk-webhook-signature` (HMAC-SHA256 over raw body) — mirror the Stripe
  webhook's raw-body handling.
- Map events → status: `shipped` → `SHIPPED`, `delivered` → `COMPLETE`, `returned` →
  `RETURNED`. Idempotent; respect the allowed-transition rules in `lib/services/order.ts`.

### 8.9 — Admin: tracking + labels + delivery notes
- Order detail: show courier, both tracking numbers, `tracking.events` timeline, and a
  label download (via `GET /shipment/:tn/label`).
- New batch action: select paid/in-production orders → `POST /delivery-note` (choose
  `pickupFor` couriers + `pickupDate` honoring the working-day rules) → download the
  returned per-courier PDFs.
- Note (from price list): MPL charges a 480 Ft pickup fee for 1–3 parcels, free for 4+;
  other couriers' pickup is free. Surface this so MPL pickups can be batched to 4+.

### 8.10 — Emails
- Update `OrderConfirmation.tsx`: courier + Kvikk `trackingLink`.
- Optional: a "shipped" email triggered from the Kvikk webhook on `shipped`.

### 8.11 — Cleanup
- Remove `FoxpostWidget.tsx`, dead code in `lib/shipping/config.ts`, and the old
  `ShippingMethod` enum usages (keep historical order data per 8.3).
- Update `docs/ARCHITECTURE.md`, `docs/CLAUDE.md`, `docs/PLAN.md` (mark Phase 8; retire
  the Foxpost/MPL "Shipping" section).

---

## Testing

- Unit: `lib/kvikk/client.ts` (envelope + error mapping), `deliveryPointMap`, pricing,
  weight resolution.
- Webhook: Kvikk signature verification + event→status mapping (Vitest, like the Stripe
  webhook tests).
- Manual E2E on a test/sandbox key (or `KVIKK_LIVE=false`): pick a point → pay →
  shipment created → label downloads → webhook advances status → delivery note generates.

## Rollout / rollback

- Ship behind config: keep the old flow available until 8.5–8.8 are verified end-to-end.
- `KVIKK_LIVE` flag prevents accidental real pickups during development.
- Historical orders keep their original shipping fields (additive migration) — no data
  loss, GDPR/8-year retention intact.
