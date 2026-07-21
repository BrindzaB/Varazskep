// TypeScript types for the Kvikk Shipping API.
// Reference: docs/kvikk-api.md (the official docs are access-restricted and cannot be linked).
//
// Only the shipping API (https://api.kvikk.hu/v1) and its response shapes are modeled here,
// plus the Map widget's point shapes (used by the checkout widget + server-side validation).
// Some sub-shapes were not fully documented; those are modeled loosely and flagged with a
// NOTE + the migration-plan step where they get pinned down against a live response.

// ─── Shared ──────────────────────────────────────────────────────────────────

// Standard JSON envelope wrapping every api.kvikk.hu response (success or error).
export interface KvikkEnvelope<T> {
  status: string;
  code: string;
  message: string;
  data: T;
}

// Couriers supported by the shipping API's `courier` field.
// (The Map widget additionally lists dhl / expressone / sameday, which the shipping
// API does not accept — those are not modeled here.)
export type KvikkCourier =
  | "mpl"
  | "foxpost"
  | "packeta"
  | "famafutar"
  | "dpd"
  | "gls";

// Delivery-point type codes accepted by POST /shipment.
// These are the LONG ({courier}_{type}) form — distinct from the SHORT form the Map
// widget emits (e.g. "zbox") and that GET/webhook return. Convert with deliveryPointMap.ts.
// Verified against GET /account-details (couriers[].deliveryPointTypes[].slug), 2026-07.
export type KvikkDeliveryPointType =
  | "mpl_posta"
  | "mpl_postapont"
  | "mpl_automata"
  | "foxpost_foxpost"
  | "foxpost_zbox"
  | "foxpost_zpont"
  | "packeta_zbox"
  | "packeta_zpont"
  | "packeta_foxpost"
  | "gls_locker"
  | "gls_shop"
  | "dpd_alzabox"
  | "dpd_parcelshop";

// Normalized tracking stages, consistent across all couriers.
export type KvikkTrackingEventId =
  | "booked"
  | "sent"
  | "in_transit"
  | "out_for_delivery"
  | "ready_for_pickup"
  | "delivered"
  | "failed"
  | "returned";

// Optional per-parcel value-added services.
export type KvikkParcelService =
  | "insurance"
  | "oversized"
  | "amorf"
  | "fragile"
  | "nextday";

// Opening hours keyed by ISO weekday ("1" = Monday … "7" = Sunday), e.g. "05:30 - 19:00".
export type KvikkOpeningHours = Record<string, string>;

// ─── Create shipment ─────────────────────────────────────────────────────────

export interface KvikkParcel {
  weight: number; // grams — required
  value: number; // declared value in HUF — required (insurance/customs)
  length?: number; // cm — required by some couriers (MPL automata, DHL) for volumetric weight
  width?: number; // cm
  height?: number; // cm
  services?: KvikkParcelService[];
}

// Request body for POST /shipment.
// The API rejects unexpected fields, so callers must only set the fields relevant to the
// chosen delivery type. JSON.stringify drops `undefined` fields, so leave them unset
// (never null) for anything that does not apply.
export interface CreateShipmentRequest {
  name: string;
  phone: string;
  email: string;
  courier: KvikkCourier;
  orderID: string;
  parcels: KvikkParcel[];
  cod: number; // HUF; 0 when there is no cash-on-delivery
  senderID: string; // a sender `_id` from GET /account-details

  // Home delivery only:
  address?: string;
  city?: string;
  postcode?: string; // 1000–9999
  country?: string; // 2-letter, e.g. "HU"

  // Delivery point only:
  deliveryPointType?: KvikkDeliveryPointType;
  deliveryPointID?: string;

  // Optional extras:
  note?: string; // prints on the label
  remark?: string; // for the courier person; not on the label
  referenceNumber?: string; // your own reference (e.g. invoice no.)
}

// Cost/weight breakdown returned on create.
// NOTE: the docs are ambiguous about whether `courierTrackingNumber`/`link` sit inside
// `accounting` or alongside it. Modeled with the cost fields inside `accounting` and the
// identifiers at the top level (matching GET /shipment). Confirm against a live 201
// response (plan step 8.7) and adjust if needed.
export interface KvikkAccounting {
  weight: number; // grams
  shipping: number; // net shipping cost in HUF
  codFee: number; // fixed COD fee in HUF
  codPercentage: number; // percentage fee on the COD amount
}

export interface CreateShipmentData {
  trackingNumber: string; // Kvikk tracking number, e.g. "M123412341234"
  courierTrackingNumber: string; // courier's own tracking number
  label: string; // base64-encoded PDF label
  labelDownloadLink: string; // temporary label URL — valid 15 minutes
  link: string; // Kvikk app URL to manage the shipment
  accounting?: KvikkAccounting;
}

// ─── Get shipment ─────────────────────────────────────────────────────────────

export interface KvikkTrackingEvent {
  event: KvikkTrackingEventId;
  message: string; // description in the local language
  location: string;
  date: string; // ISO 8601 UTC
  _id?: string;
  id?: string;
}

export interface KvikkTracking {
  shipped: boolean;
  delivered: boolean;
  returned: boolean;
  dispatched?: string; // present in the webhook payload
  updated: string; // ISO 8601 UTC
  events: KvikkTrackingEvent[];
}

// Sender/recipient address block. `dispatchAddress` (sender) carries name/phone/email too.
export interface KvikkAddress {
  address: string;
  city: string;
  postcode: string;
  country: string;
  name?: string;
  phone?: string;
  email?: string;
  coordinates?: { lat: number; lon: number };
  _id?: string;
}

export interface GetShipmentData {
  name: string;
  phone: string;
  email: string;
  courier: string;
  orderID: string;
  weight: number; // grams
  cod: number; // HUF
  value: number; // HUF
  note?: string;
  trackingNumber: string;
  courierTrackingNumber: string;
  created: string; // ISO 8601 UTC
  tracking: KvikkTracking;
  dispatchAddress: KvikkAddress;
  shippingAddress: KvikkAddress;
  deliveryPointType?: string; // SHORT form here (e.g. "zbox"), unlike the create request
  deliveryPointID?: string;
  courierTrackingLink: string; // courier's own tracking page
  trackingLink: string; // Kvikk tracking page
  labelDownloadLink: string;
  appLink: string;
}

// Webhook payload = the full shipment object (same shape as GET /shipment `data`).
export type KvikkWebhookPayload = GetShipmentData & { id?: string };

// ─── Delivery note ────────────────────────────────────────────────────────────

export interface CreateDeliveryNoteRequest {
  pickupDate: string; // ISO 8601 UTC; must be a working day (see docs for timing rules)
  pickupFor: KvikkCourier[]; // couriers to request pickup for; empty array = drop-off only
  shipments: string[]; // tracking numbers to include
}

// A per-courier document generated for the delivery note (pickup manifest / drop-off form).
export interface KvikkDeliveryNoteDocument {
  courier: string;
  id: string;
  document: string; // filename of the generated PDF
  pdf: string; // base64-encoded PDF
  labelDownloadLink: string; // public URL to download the PDF
}

export interface KvikkDeliveryNotePickupFee {
  courier: string;
  fee: number; // pickup fee in HUF (net)
}

export interface KvikkDeliveryNote {
  _id: string;
  user: string;
  shipments: string[]; // internal Kvikk shipment ids
  pickup: { date: string; for: string[] };
  documents: KvikkDeliveryNoteDocument[];
  accounting: { fees: KvikkDeliveryNotePickupFee[] };
  created: string;
}

export interface CreateDeliveryNoteData {
  deliveryNote: KvikkDeliveryNote;
  successfulShipments: string[]; // tracking numbers added successfully
  failedShipments: string[]; // tracking numbers that failed
  errors: string[]; // error messages for failed shipments
}

// ─── Delivery points (GET /delivery-points) ───────────────────────────────────

// NOTE: this endpoint returns lat/lon as STRINGS, unlike the Map widget point (numbers).
export interface KvikkDeliveryPoint {
  id: string;
  lat: string;
  lon: string;
  name: string;
  zip: string;
  addr: string;
  city: string;
  country: string;
  type: string;
  courier: string;
  hours: KvikkOpeningHours;
  imported: string; // ISO 8601 UTC
}

// ─── Account details (GET /account-details) ───────────────────────────────────
//
// Shapes verified against a live GET /account-details response (2026-07).

export interface KvikkSender {
  _id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
}

// A delivery-point type offered by a courier. `slug` is the LONG deliveryPointType code
// used on POST /shipment (e.g. "mpl_automata").
export interface KvikkCourierPointType {
  slug: string;
  name: string; // display name, e.g. "Automata"
  db: string; // points-api URL for this point type
  supportedCountries: string[];
}

export interface KvikkAccountCourier {
  slug: KvikkCourier;
  name: string;
  status: "active" | "inactive"; // only `active` couriers can be used to create shipments
  note: string;
  pickupLimit: number;
  supportLink: string;
  supportedCountries: string[];
  deliveryPointTypes: KvikkCourierPointType[];
}

// One weight-range row of a shipping price table. min/max in GRAMS, cost is NET HUF.
export interface KvikkPriceRange {
  min: number;
  max: number;
  cost: number;
}

// A shipping price table for one price key + country. `courier` here is the PRICE KEY:
// the bare courier slug for home delivery (e.g. "mpl"), or a deliveryPointType slug for a
// delivery point (e.g. "mpl_automata").
export interface KvikkShippingPrice {
  courier: string;
  country: string;
  prices: KvikkPriceRange[];
}

// One COD fee row. min/max in HUF. Informational only — we always send cod: 0 (prepaid).
export interface KvikkCodPrice {
  min: number;
  max: number;
  fee: number;
  percentage: number;
}

export interface KvikkPricing {
  from: string; // ISO — validity period start
  to: string; // ISO — validity period end
  shipping: KvikkShippingPrice[];
  cod: KvikkCodPrice[];
}

export interface AccountDetailsData {
  couriers: KvikkAccountCourier[];
  senders: KvikkSender[];
  pricing: KvikkPricing;
}

// ─── Map widget / points-api point ────────────────────────────────────────────
//
// Returned by the Map widget callback and by the server-side validation endpoint
// (GET https://points-api.kvikk.hu/map/point). lat/lon are NUMBERS here.

export interface KvikkMapPoint {
  id: string;
  lat: number;
  lon: number;
  name: string;
  zip: string;
  addr: string;
  city: string;
  country: string;
  type: string; // SHORT form (e.g. "zbox", "locker") — convert via deliveryPointMap.ts
  courier: string;
  hours: KvikkOpeningHours;
}

// The Map widget falls back to manual text entry when it cannot load.
export interface KvikkMapFallback {
  fallbackInfo: string;
}

export type KvikkMapCallbackResult = KvikkMapPoint | KvikkMapFallback;
