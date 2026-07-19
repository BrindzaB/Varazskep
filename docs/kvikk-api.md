# kvikk-api.md — Kvikk Shipping API Reference

Consolidated reference for the **Kvikk Shipping API**, captured from the official docs
(which are access-restricted and cannot be linked). This is the single source of truth
for the Kvikk integration — keep it in sync as the API evolves.

> Scope: this file documents *what the API offers*. For *how we integrate it into
> Varázskép*, see `docs/kvikk-migration-plan.md`.

---

## Hosts & Base URLs

| Purpose | Base URL | Auth header |
|---|---|---|
| Shipping API (server-side) | `https://api.kvikk.hu/v1` | `X-API-KEY` (secret — **server only**) |
| Map widget script | `https://cdn.kvikk.hu/map/kvikkMapWidget.js` | `apiKey` in JS config (client-exposed) |
| Map couriers + point validation | `https://points-api.kvikk.hu` | `X-API-KEY` / `x-api-key` |

✅ **Two separate keys, confirmed.** They live under different menus in the Kvikk app:
- **Kvikk API** — the secret shipping key. Sent in `X-API-KEY` on every `api.kvikk.hu`
  request. Server-only; must never reach the browser.
- **Kvikk Maps** — a separate key with different permissions, **scoped to a specific
  website route/domain**. This is what makes it safe to embed in client JS (a wrong
  domain can't use it). Register the correct domain(s) for it (production + any dev/preview
  origin needed for local testing).

---

## Authentication

Every request to `api.kvikk.hu` includes the API key as a header:

```
X-API-KEY: eyJraWQiOiI0...
```

Missing / invalid key → `401 Unauthorized`. Obtain a key in the Kvikk App under
Settings → API Key → "New Key" (shown once — store securely).

---

## Conventions

- **Dates:** ISO 8601, always UTC — e.g. `2024-08-01 10:18:42.697Z`.
- **Response envelope (JSON):** every response (success or error) has this shape:
  ```json
  { "status": "success", "code": "shipment_created", "message": "…", "data": { } }
  ```
  Success → `status: "success"`. Errors carry a descriptive `message` + `code`.
- **Strict input:** the API does **not** ignore unknown query params or extra JSON body
  fields — sending anything unexpected returns `400`. Send only the documented fields.
- **Case-sensitive** paths, query params, and JSON field names. Trailing slash is
  optional (`/shipment` == `/shipment/`).

### HTTP status codes

| Code | Meaning |
|---|---|
| 200 / 201 / 204 | OK / Created / No Content (deleted) |
| 400 | Bad Request — check params / required fields |
| 401 | Unauthorized — invalid or missing API key |
| 403 | Forbidden — permission or rate limit |
| 404 | Not Found |
| 409 | Conflict — resource already exists |
| 500 / 502 / 503 / 504 | Server-side — retry with backoff |

---

## Couriers

`courier` values (create shipment): `mpl`, `foxpost`, `packeta`, `famafutar`, `dpd`, `gls`.
(The prose also mentions `expressone`; the Map widget additionally lists `dhl` and
`sameday`. Confirm the authoritative list for the shipping API vs. the Map widget.)

A shipment can only be created for a courier that is present **and active** in the
user's account (see `GET /account-details` → `couriers[]`).

### Tracking-number prefixes

Kvikk tracking numbers are `{letter}{12 digits}`; the first letter is the courier:

| Letter | Courier |
|---|---|
| M | MPL |
| P | Packeta |
| F | FámaFutár |
| X | Foxpost |
| D | DPD |
| G | GLS |

---

## Endpoints

### `POST /shipment` — Create shipment

Creates a shipment for home delivery **or** a delivery point (same endpoint; fields
differ). Returns two tracking numbers (Kvikk + courier) and a base64 PDF label.

**Request body (common fields):**

| Field | Type | Req | Notes |
|---|---|---|---|
| `name` | string | ✔ | Recipient full name |
| `phone` | string | ✔ | Auto-normalized to `+36…` |
| `email` | email | ✔ | Recipient email |
| `courier` | string | ✔ | See courier list |
| `orderID` | string | ✔ | Your order reference |
| `parcels` | object[] | ✔ | See below |
| `cod` | number | ✔ | Cash-on-delivery amount in HUF; `0` if none |
| `senderID` | string | ✔ | A sender `_id` from `GET /account-details` |
| `note` | string | | Prints on the label (e.g. delivery preference) |
| `remark` | string | | For the courier person; **not** on the label |
| `referenceNumber` | string | | Your own extra reference (e.g. invoice no.) |

**Home delivery — additionally:**

| Field | Type | Notes |
|---|---|---|
| `address` | string | Street + number |
| `city` | string | |
| `postcode` | string | 1000–9999 |
| `country` | string | 2-letter (e.g. `HU`) |

**Delivery point — additionally:**

| Field | Type | Notes |
|---|---|---|
| `deliveryPointType` | string | See values below |
| `deliveryPointID` | string | Point ID (same ID as the courier's own DB / `GET /delivery-points`) |

`deliveryPointType` possible values (create shipment):
`mpl_posta`, `mpl_postapont`, `mpl_automata`, `foxost_foxpost` *(sic — likely
`foxpost_foxpost`)*, `foxpost_zbox`, `foxpost_zpont`, `packeta_zbox`, `packeta_zpont`,
`packeta_foxpost`, `gls_locker`, `gls_shop`, `dpd_alzabox`, `dpd_parcelshop`.

> ⚠️ These `{courier}_{type}` codes differ from the Map widget's `type` codes
> (which are bare, e.g. `zbox`, `locker`, `automata`). See **Integration notes**.

**`parcels[]` item:**

| Field | Type | Req | Notes |
|---|---|---|---|
| `weight` | number | ✔ | **Grams** |
| `value` | number | ✔ | Declared value in HUF (insurance/customs) |
| `length` | number | | cm — required by some couriers (MPL automata, DHL) for volumetric weight |
| `width` | number | | cm |
| `height` | number | | cm |
| `services` | string[] | | `insurance`, `oversized`, `amorf`, `fragile`, `nextday` |

Multiple parcels → multi-parcel shipment.

**Response `data` (201):**

| Field | Type | Notes |
|---|---|---|
| `trackingNumber` | string | Kvikk tracking number (e.g. `M123412341234`) |
| `label` | string | Base64-encoded PDF label |
| `labelDownloadLink` | uri | Temporary label URL — **valid 15 minutes** |
| `courierTrackingNumber` | string | Courier's own tracking number |
| `link` | uri | Kvikk app URL to manage the shipment |
| `accounting` | object | `weight` (g), `shipping` (net HUF), `codFee` (HUF), `codPercentage` |

**Shipment-specific error codes:**

`invalid_delivery_point_type`, `invalid_delivery_point_id`, `wrong_weight_value`,
`wrong_cod_value`, `missing_weight`, `label_not_generated`, `sender_not_found`,
`courier_not_found`, `courier_not_active`.

---

### `GET /shipment/:trackingNumber` — Get shipment

Returns full shipment detail + real-time tracking. `data` includes recipient fields
(`name`, `phone`, `email`), `courier`, `orderID`, `weight`, `cod`, `value`, `note`,
`trackingNumber`, `courierTrackingNumber`, `created`, `shippingAddress`
(`address`/`city`/`postcode`/`country`), links (`courierTrackingLink`, `trackingLink`,
`labelDownloadLink`, `appLink`), a `dispatchAddress` (sender), and a `tracking` object:

```jsonc
"tracking": {
  "shipped": true,
  "delivered": true,
  "returned": false,
  "updated": "2024-07-12T09:02:47.992Z",
  "events": [
    { "event": "delivered", "message": "Sikeresen kézbesítve háznál",
      "location": "Sellye posta, Sellye", "date": "2024-07-11T06:53:48.000Z" }
  ]
}
```

**Normalized tracking event IDs** (consistent across couriers):

| Event | Meaning |
|---|---|
| `booked` | Label generated, not yet dispatched |
| `sent` | Picked up / dropped off |
| `in_transit` | Travelling between locations |
| `out_for_delivery` | On the way to home / point |
| `ready_for_pickup` | Available at the delivery point |
| `delivered` | Delivered / picked up |
| `failed` | Delivery attempt failed (may retry) |
| `returned` | Returned to sender |

---

### `DELETE /shipment/:trackingNumber` — Delete shipment

Deletes a shipment **only if not yet shipped** (not on a delivery note / not
dispatched). Returns `204`/`200` with `code: shipment_deleted`.

---

### `GET /shipment/:trackingNumber/label` — Get label

Returns the label as `application/pdf` (binary) with `Content-Disposition`
`trackingNumber_label.pdf`. Use this to re-download a label anytime — no need to
persist the base64 from create.

---

### `POST /delivery-note` — Create delivery note (batch close-out / manifest)

Closes out a batch of shipments and generates courier pickup manifests / drop-off
forms. Returns base64 PDF documents per courier.

**Request body:**

| Field | Type | Req | Notes |
|---|---|---|---|
| `pickupDate` | date-time | ✔ | Must be a working day; timing rules below |
| `pickupFor` | string[] | ✔ | Courier slugs to request pickup for; empty = drop-off only |
| `shipments` | string[] | ✔ | Tracking numbers to include |

**Pickup rules:**
- Pickup date must be a working day (Mon–Fri).
- Requests after 15:00 → earliest pickup is 2 business days ahead.
- No pickup on blacklisted dates (holidays).
- Weekend requests must be for Tuesday or later.
- **MPL:** pickup or drop-off; pickup fee if fewer than 4 shipments.
- **Packeta:** drop-off only at Z-Points.
- **FámaFutár:** pickup required.
- **GLS, DPD:** pickup or just generate the note if pickup is handled separately.

Response reports each courier's document + marks processed shipments with the delivery
note ID; failed shipments come back with error details.

---

### `GET /delivery-points?courier=&type=` — List delivery points

Returns available pickup points. `type` may be empty (→ all points for the courier).
The `id` is the same as in the courier's own DB and is used directly as
`deliveryPointID` on create.

**`data[]` item:** `id`, `lat`, `lon`, `name`, `zip`, `addr`, `city`, `country`,
`type`, `courier`, `hours` (object), `imported` (date-time).

---

### `GET /account-details` — Account information

Returns `data` with:
- **`senders[]`** — available senders; pass a sender's `_id` as `senderID` on create.
- **`couriers[]`** — available couriers with `active` status. Only active couriers may
  be used to create shipments.
- **`pricing`** — current price list grouped by courier: shipping fee and COD fee, with
  net cost + fee by `min`/`max` range. Range unit is **grams** for shipping, **HUF** for
  COD. Use this to compute estimated shipping cost before creating a shipment.

---

## Webhooks

Real-time push on shipment status changes (preferred over polling `GET /shipment`).

- **Register** a URL + subscribed events in the Kvikk App → Settings. A **secret** is
  generated once — store it securely.
- On an event, Kvikk sends a `POST` to your URL with the full shipment JSON in the body
  (same shape as `GET /shipment` `data`, including `tracking.events`, `dispatchAddress`,
  `deliveryPointType`/`deliveryPointID`, `shippingAddress`, links).
- **Headers:**
  - `kvikk-webhook-event` — the event type
  - `kvikk-webhook-signature` — HMAC-SHA256 of the **raw** request body, keyed by the secret
- **Supported event types (only these 4):** `dispatched`, `shipped`, `delivered`,
  `returned`. Finer stages (`in_transit`, `out_for_delivery`, `ready_for_pickup`,
  `failed`) require polling `GET /shipment`.
- Make the endpoint **idempotent** (Kvikk may retry) and HTTPS-only.

**Signature verification (Node.js):**

```js
const crypto = require('crypto');
const payload = rawRequestBody;                        // the raw body string, not re-serialized
const received = req.headers['kvikk-webhook-signature'];
const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
if (computed !== received) { /* reject */ }
```

> Same verification pattern as our existing Stripe webhook (`app/api/stripe/webhook/route.ts`),
> which also needs the raw body — reuse that approach.

---

## Kvikk Map widget (BETA)

Embeddable, vectorized (Apple Maps) pickup-point picker. Replaces the Foxpost iframe;
multi-courier, multi-country.

**Include + open:**

```html
<script type="module" src="https://cdn.kvikk.hu/map/kvikkMapWidget.js"></script>
<script>
kvikkMapWidget.open({
  apiKey: "…",                 // required — Map key (public), from developer.kvikk.hu
  callback: (point) => { … },  // required — receives the selected point (see below)
  couriers: [                  // required — which couriers/types + price per country
    { courier: "gls",     type: "locker",  price: { hu: 1500 } },
    { courier: "foxpost", type: "foxpost", price: { hu: 1200 } },
  ],
  language: "hu",              // optional — "hu" (default) | "en"
  currency: "HUF",             // optional
  geolocation: true,           // optional — ask for geolocation on search focus
  defaultPosition: { country: "HU", postalCode: "1000", coordinates: { lat, lon } },
  color: { primary: "#0fa0e4", text: "#4d4a48" },   // optional — brand colors
  customPoints: [ /* own pickup locations */ ],       // optional
});
</script>
```

Points in countries with no configured price are not selectable. The map caches by
config — same config reopens instantly, changed config reloads.

**Callback — standard point:**

```json
{ "id": "0000516834", "lat": 46.19105, "lon": 18.94225, "name": "…", "zip": "6500",
  "addr": "Sirály utca 4.", "city": "Baja", "country": "HU",
  "type": "pick-pack-pont", "courier": "sameday",
  "hours": { "1": "05:30 - 19:00", "…": "…", "7": "05:30 - 11:00" } }
```

**Callback — fallback (map failed to load / manual entry):**

```json
{ "fallbackInfo": "User-entered pickup description" }
```

Always branch on `point.fallbackInfo` in the callback.

**Map courier list:** `GET https://points-api.kvikk.hu/map/couriers` (header
`x-api-key`) → couriers with `pointTypes[]` and per-country `items` counts.

Supported couriers/types (Map widget) include: DHL (`alzabox`/`shell`/`locker`/
`service-point`), DPD (`parcelshop`/`alzabox`), Express One (`alzabox`/`omv`/`exobox`),
Foxpost (`foxpost`), GLS (`locker`/`shop`), MPL (`posta`/`automata`/`postapont`),
Packeta (`zbox`/`zpont`), Sameday (`easybox`/`pick-pack-pont`).

**Server-side point validation (recommended before create):**

```
GET https://points-api.kvikk.hu/map/point?courier=&type=&id=
Header: X-API-KEY: …
```

Returns the same point object, confirming it exists and is active. Validate server-side
so a tampered client selection can't produce a bad shipment.

**Styling:** widget opens in a `<dialog id="kvikk-dialog">` (full-screen by default);
`body.kvikk-map-open` is toggled while open; iframe is `#kvikk-iframe`. Customize the
dialog via CSS on `#kvikk-dialog` / `::backdrop`. Do not try to style inside the iframe
(cross-origin).

---

## Integration notes / gotchas

1. **`deliveryPointType` mapping.** The Map widget (and webhook payload) use bare type
   codes (`zbox`, `locker`, `automata`, `foxpost`, …), while `POST /shipment` expects
   `{courier}_{type}` codes (`packeta_zbox`, `gls_locker`, `mpl_automata`, …). We need a
   `(courier, mapType) → deliveryPointType` lookup, and should verify it with a real test
   shipment (also confirm the `foxost_foxpost` spelling).
2. **Two hosts, two keys.** Keep the secret shipping key server-only; the Map key is
   public by design. Confirm they are separate keys with Kvikk.
3. **Weight is required (grams).** Malfini exposes per-size weight (`grossWeight` kg on
   `ProductSizeModel`) — convert to grams. Local products (mugs) have no weight in our
   schema — add a field with a sensible default.
4. **COD = 0 always.** Stripe collects payment up front, so `cod` is always `0`;
   `parcels[].value` = item price (for insurance).
5. **Webhook covers 4 events only** — enough to drive our order statuses
   (`shipped` → SHIPPED, `delivered` → COMPLETE, `returned` → handle as return). Poll
   `GET /shipment` only if finer granularity is needed.
6. **Sandbox / test env** — not documented; confirm with Kvikk whether a test key /
   sandbox exists so development doesn't create real courier pickups.
