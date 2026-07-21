// Kvikk Shipping API client (https://api.kvikk.hu/v1).
// Server-side only — reads the secret KVIKK_API_KEY and must never be imported into a
// client component. Reference: docs/kvikk-api.md.
//
// Design note: unlike lib/malfini/client.ts (which returns safe empty fallbacks for a
// cacheable catalog), these are transactional operations. Every function THROWS a
// KvikkApiError on failure so callers (API routes) can react — e.g. flag an order for a
// manual shipment retry. Callers own their own try/catch and any caching.

import type {
  AccountDetailsData,
  CreateDeliveryNoteData,
  CreateDeliveryNoteRequest,
  CreateShipmentData,
  CreateShipmentRequest,
  GetShipmentData,
  KvikkCourier,
  KvikkDeliveryPoint,
  KvikkEnvelope,
} from "./types";

const BASE = (): string =>
  process.env.KVIKK_API_URL ?? "https://api.kvikk.hu/v1";

// Thrown on any non-2xx response. `status` is the HTTP status; `code` is the envelope's
// machine-readable code (e.g. "courier_not_active") when the body was a JSON envelope.
export class KvikkApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "KvikkApiError";
    this.status = status;
    this.code = code;
  }
}

function apiKey(): string {
  const key = process.env.KVIKK_API_KEY;
  if (!key) {
    throw new Error(
      "Kvikk API key not configured. Set KVIKK_API_KEY in the environment."
    );
  }
  return key;
}

// Builds a KvikkApiError from a failed response, extracting the envelope code/message
// when present (the body may not be JSON for gateway-level 5xx errors).
async function toError(res: Response): Promise<KvikkApiError> {
  let message = `Kvikk API error ${res.status} ${res.statusText}`.trim();
  let code: string | undefined;
  try {
    const body = (await res.json()) as Partial<KvikkEnvelope<unknown>>;
    if (typeof body.message === "string" && body.message)
      message = body.message;
    if (typeof body.code === "string") code = body.code;
  } catch {
    // Non-JSON body — keep the status-based message.
  }
  return new KvikkApiError(message, res.status, code);
}

// Core request helper for JSON endpoints. Injects auth, enforces no-store (transactional),
// unwraps the envelope, and returns `data`. Throws KvikkApiError on non-2xx.
async function requestJson<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "X-API-KEY": apiKey(),
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw await toError(res);
  }

  const envelope = (await res.json()) as KvikkEnvelope<T>;
  return envelope.data;
}

// ─── Shipments ────────────────────────────────────────────────────────────────

// Creates a shipment (home delivery or delivery point). Returns tracking numbers +
// base64 label. Throws KvikkApiError on the documented error codes (e.g. wrong_weight_value,
// courier_not_active, sender_not_found).
export async function createShipment(
  req: CreateShipmentRequest
): Promise<CreateShipmentData> {
  return requestJson<CreateShipmentData>("/shipment", {
    method: "POST",
    body: req,
  });
}

// Retrieves full shipment detail + real-time tracking.
export async function getShipment(
  trackingNumber: string
): Promise<GetShipmentData> {
  return requestJson<GetShipmentData>(
    `/shipment/${encodeURIComponent(trackingNumber)}`
  );
}

// Deletes a shipment. Only permitted before dispatch / inclusion in a delivery note.
// Returns nothing on success (2xx/204).
export async function deleteShipment(trackingNumber: string): Promise<void> {
  const res = await fetch(
    `${BASE()}/shipment/${encodeURIComponent(trackingNumber)}`,
    {
      method: "DELETE",
      headers: { "X-API-KEY": apiKey() },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw await toError(res);
  }
}

// Downloads the label PDF. Returns the raw bytes plus the suggested filename from the
// Content-Disposition header. Callers stream this back to the browser or persist it.
export async function getLabel(
  trackingNumber: string
): Promise<{ data: ArrayBuffer; contentType: string; filename: string }> {
  const res = await fetch(
    `${BASE()}/shipment/${encodeURIComponent(trackingNumber)}/label`,
    {
      method: "GET",
      headers: { "X-API-KEY": apiKey() },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw await toError(res);
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `${trackingNumber}_label.pdf`;
  return {
    data: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "application/pdf",
    filename,
  };
}

// ─── Delivery notes ─────────────────────────────────────────────────────────

// Creates a delivery note (batch close-out / courier pickup manifest) for the given
// shipments. Returns per-courier documents (see CreateDeliveryNoteData note in types.ts).
export async function createDeliveryNote(
  req: CreateDeliveryNoteRequest
): Promise<CreateDeliveryNoteData> {
  return requestJson<CreateDeliveryNoteData>("/delivery-note", {
    method: "POST",
    body: req,
  });
}

// ─── Reference data ───────────────────────────────────────────────────────────

// Lists available delivery points, optionally filtered by courier and/or type.
// An empty `type` returns all point types for the courier.
export async function getDeliveryPoints(
  filter: { courier?: KvikkCourier; type?: string } = {}
): Promise<KvikkDeliveryPoint[]> {
  const params = new URLSearchParams();
  if (filter.courier) params.set("courier", filter.courier);
  if (filter.type) params.set("type", filter.type);
  const query = params.toString();
  return requestJson<KvikkDeliveryPoint[]>(
    `/delivery-points${query ? `?${query}` : ""}`
  );
}

// Returns account info: senders (senderID = sender._id), active couriers, and pricing.
export async function getAccountDetails(): Promise<AccountDetailsData> {
  return requestJson<AccountDetailsData>("/account-details");
}
