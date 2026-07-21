"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore, itemKey } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";
import KvikkMapWidget, {
  type KvikkPointOption,
} from "@/components/shop/KvikkMapWidget";
import type { KvikkMapPoint } from "@/lib/kvikk/types";

type DeliveryMode = "home" | "point";

interface HomeQuote {
  courier: string;
  label: string;
  grossHuf: number;
}

interface PointQuote {
  courier: string;
  mapType: string;
  deliveryPointType: string;
  label: string;
  grossHuf: number;
}

interface QuoteResponse {
  totalWeightGrams: number;
  home: HomeQuote[];
  points: PointQuote[];
}

interface SelectedPoint {
  point: KvikkMapPoint;
  deliveryPointType: string;
  grossHuf: number;
}

interface FormFields {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  gdprConsent: boolean;
}

const EMPTY_FORM: FormFields = {
  name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  gdprConsent: false,
};

interface FieldError {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  gdprConsent?: string;
  shipping?: string;
}

function validate(
  fields: FormFields,
  mode: DeliveryMode,
  selectedHomeCourier: string | null,
  selectedPoint: SelectedPoint | null
): FieldError {
  const errors: FieldError = {};
  if (!fields.name.trim()) errors.name = "A név megadása kötelező.";
  if (!fields.email.trim()) {
    errors.email = "Az e-mail cím megadása kötelező.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Érvénytelen e-mail cím.";
  }

  // Phone is required — Kvikk needs it to create the shipment.
  if (!fields.phone.trim()) {
    errors.phone = "A telefonszám megadása kötelező.";
  }

  if (mode === "home") {
    if (!selectedHomeCourier) errors.shipping = "Válasszon futárszolgálatot.";
    if (!fields.address.trim()) errors.address = "A cím megadása kötelező.";
    if (!fields.city.trim()) errors.city = "A város megadása kötelező.";
    if (!fields.postalCode.trim()) {
      errors.postalCode = "Az irányítószám megadása kötelező.";
    } else if (!/^\d{4}$/.test(fields.postalCode.trim())) {
      errors.postalCode = "Az irányítószám 4 számjegyből áll.";
    }
  } else if (!selectedPoint) {
    errors.shipping = "Válasszon átvételi pontot.";
  }

  if (!fields.gdprConsent) {
    errors.gdprConsent =
      "Az adatkezelési hozzájárulás elfogadása kötelező a rendelés leadásához.";
  }
  return errors;
}

export default function CheckoutForm() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const itemsTotal = useCartStore((state) =>
    state.items.reduce(
      (sum, i) => sum + (i.price + (i.printFee ?? 0)) * i.quantity,
      0
    )
  );

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<QuoteResponse | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [mode, setMode] = useState<DeliveryMode>("home");
  const [selectedHomeCourier, setSelectedHomeCourier] = useState<string | null>(
    null
  );
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(
    null
  );

  // Fetch shipping quotes for the current cart (weights + prices resolved server-side).
  useEffect(() => {
    if (items.length === 0) {
      setQuotesLoading(false);
      return;
    }
    let cancelled = false;
    setQuotesLoading(true);
    setQuoteError(null);
    fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("quote failed");
        return (await res.json()) as QuoteResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setQuotes(data);
        // Preselect the first home courier for convenience.
        setSelectedHomeCourier((prev) => prev ?? data.home[0]?.courier ?? null);
      })
      .catch(() => {
        if (!cancelled)
          setQuoteError("Nem sikerült lekérni a szállítási díjakat.");
      })
      .finally(() => {
        if (!cancelled) setQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const shippingCost =
    mode === "home"
      ? (quotes?.home.find((h) => h.courier === selectedHomeCourier)
          ?.grossHuf ?? 0)
      : (selectedPoint?.grossHuf ?? 0);
  const grandTotal = itemsTotal + shippingCost;

  const pointOptions: KvikkPointOption[] = (quotes?.points ?? []).map((p) => ({
    courier: p.courier,
    mapType: p.mapType,
    priceHuf: p.grossHuf,
  }));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setFields((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleModeChange(next: DeliveryMode) {
    setMode(next);
    setErrors((prev) => ({
      ...prev,
      shipping: undefined,
      address: undefined,
      city: undefined,
      postalCode: undefined,
    }));
  }

  // Map widget selection → resolve its price + deliveryPointType from our quotes.
  function handlePointSelect(point: KvikkMapPoint) {
    const match = quotes?.points.find(
      (p) => p.courier === point.courier && p.mapType === point.type
    );
    if (!match) {
      setErrors((prev) => ({
        ...prev,
        shipping: "Ez az átvételi pont jelenleg nem választható.",
      }));
      return;
    }
    setSelectedPoint({
      point,
      deliveryPointType: match.deliveryPointType,
      grossHuf: match.grossHuf,
    });
    setErrors((prev) => ({ ...prev, shipping: undefined }));
  }

  function handlePointFallback() {
    setErrors((prev) => ({
      ...prev,
      shipping:
        "A térkép jelenleg nem elérhető. Kérjük, válasszon házhozszállítást.",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(
      fields,
      mode,
      selectedHomeCourier,
      selectedPoint
    );
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    const shippingAddress =
      mode === "point" && selectedPoint
        ? {
            address: selectedPoint.point.addr,
            city: selectedPoint.point.city,
            postalCode: selectedPoint.point.zip,
            country: selectedPoint.point.country || "HU",
          }
        : {
            address: fields.address.trim(),
            city: fields.city.trim(),
            postalCode: fields.postalCode.trim(),
            country: "HU",
          };

    const shipping =
      mode === "point" && selectedPoint
        ? {
            deliveryType: "DELIVERY_POINT" as const,
            courier: selectedPoint.point.courier,
            cost: selectedPoint.grossHuf,
            deliveryPointType: selectedPoint.deliveryPointType,
            deliveryPointId: selectedPoint.point.id,
            pointName: selectedPoint.point.name,
            pointAddress: `${selectedPoint.point.zip} ${selectedPoint.point.city}, ${selectedPoint.point.addr}`,
          }
        : {
            deliveryType: "HOME_DELIVERY" as const,
            courier: selectedHomeCourier,
            cost: shippingCost,
          };

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customer: {
            name: fields.name.trim(),
            email: fields.email.trim(),
            phone: fields.phone.trim(),
            shippingAddress,
          },
          shipping,
          gdprConsent: fields.gdprConsent,
        }),
      });

      if (!res.ok) {
        setServerError(
          "Hiba történt a fizetés elindításakor. Kérjük, próbálja újra."
        );
        return;
      }

      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setServerError(
        "Hiba történt a fizetés elindításakor. Kérjük, próbálja újra."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const selectedMethodLabel =
    mode === "home"
      ? (quotes?.home.find((h) => h.courier === selectedHomeCourier)?.label ??
        "Házhozszállítás")
      : selectedPoint
        ? (quotes?.points.find(
            (p) =>
              p.courier === selectedPoint.point.courier &&
              p.mapType === selectedPoint.point.type
          )?.label ?? "Átvételi pont")
        : "Átvételi pont";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left: form fields */}
        <div className="space-y-6 lg:col-span-2">
          {/* Personal info */}
          <fieldset className="rounded border border-border-light bg-white p-6">
            <legend className="px-1 text-base font-semibold text-charcoal">
              Személyes adatok
            </legend>

            <div className="mt-4 space-y-4">
              <Field
                label="Teljes név"
                name="name"
                type="text"
                value={fields.name}
                error={errors.name}
                autoComplete="name"
                onChange={handleChange}
              />
              <Field
                label="E-mail cím"
                name="email"
                type="email"
                value={fields.email}
                error={errors.email}
                autoComplete="email"
                onChange={handleChange}
              />
              <Field
                label="Telefonszám"
                name="phone"
                type="tel"
                value={fields.phone}
                error={errors.phone}
                autoComplete="tel"
                onChange={handleChange}
              />
            </div>
          </fieldset>

          {/* Shipping method */}
          <fieldset className="rounded border border-border-light bg-white p-6">
            <legend className="px-1 text-base font-semibold text-charcoal">
              Szállítási mód
            </legend>

            {quotesLoading ? (
              <p className="mt-4 text-sm text-muted">
                Szállítási díjak betöltése...
              </p>
            ) : quoteError ? (
              <p className="mt-4 text-sm text-error">{quoteError}</p>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(["home", "point"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleModeChange(m)}
                      className={`rounded border p-3 text-sm font-medium transition-colors ${
                        mode === m
                          ? "border-charcoal bg-gray-50 text-charcoal"
                          : "border-border-medium text-muted hover:border-charcoal"
                      }`}
                    >
                      {m === "home" ? "Házhozszállítás" : "Átvételi pont"}
                    </button>
                  ))}
                </div>

                {/* Home: courier radios */}
                {mode === "home" && (
                  <div className="mt-4 space-y-3">
                    {quotes?.home.length === 0 && (
                      <p className="text-sm text-error">
                        Ehhez a csomaghoz nincs elérhető házhozszállítás.
                      </p>
                    )}
                    {quotes?.home.map((h) => (
                      <label
                        key={h.courier}
                        className={`flex cursor-pointer items-center justify-between rounded border p-4 transition-colors ${
                          selectedHomeCourier === h.courier
                            ? "border-charcoal bg-gray-50"
                            : "border-border-medium hover:border-charcoal"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="homeCourier"
                            value={h.courier}
                            checked={selectedHomeCourier === h.courier}
                            onChange={() => setSelectedHomeCourier(h.courier)}
                            className="accent-charcoal"
                          />
                          <span className="text-sm font-medium text-charcoal">
                            {h.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-charcoal">
                          {formatHuf(h.grossHuf)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Point: map widget */}
                {mode === "point" && (
                  <div className="mt-4">
                    <KvikkMapWidget
                      pointOptions={pointOptions}
                      onSelect={handlePointSelect}
                      onFallback={handlePointFallback}
                      hasSelection={selectedPoint !== null}
                    />
                    {selectedPoint && (
                      <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-sm">
                        <p className="font-medium text-charcoal">
                          {selectedPoint.point.name} —{" "}
                          {formatHuf(selectedPoint.grossHuf)}
                        </p>
                        <p className="text-muted">
                          {selectedPoint.point.zip} {selectedPoint.point.city},{" "}
                          {selectedPoint.point.addr}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {errors.shipping && (
                  <p className="mt-2 text-sm text-error">{errors.shipping}</p>
                )}
              </>
            )}
          </fieldset>

          {/* Shipping address — only for home delivery */}
          {mode === "home" && (
            <fieldset className="rounded border border-border-light bg-white p-6">
              <legend className="px-1 text-base font-semibold text-charcoal">
                Szállítási cím
              </legend>

              <div className="mt-4 space-y-4">
                <Field
                  label="Utca, házszám"
                  name="address"
                  type="text"
                  value={fields.address}
                  error={errors.address}
                  autoComplete="street-address"
                  onChange={handleChange}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="Irányítószám"
                    name="postalCode"
                    type="text"
                    value={fields.postalCode}
                    error={errors.postalCode}
                    autoComplete="postal-code"
                    onChange={handleChange}
                  />
                  <Field
                    label="Város"
                    name="city"
                    type="text"
                    value={fields.city}
                    error={errors.city}
                    autoComplete="address-level2"
                    onChange={handleChange}
                  />
                </div>
                <p className="text-sm text-muted">Ország: Magyarország</p>
              </div>
            </fieldset>
          )}

          {/* GDPR consent */}
          <div className="rounded border border-border-light bg-white p-6">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="gdprConsent"
                checked={fields.gdprConsent}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-charcoal"
              />
              <span className="text-sm leading-relaxed text-charcoal">
                Elfogadom az{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  adatkezelési tájékoztatót
                </a>
                , és hozzájárulok személyes adataim rendelés teljesítéséhez
                szükséges kezeléséhez.
              </span>
            </label>
            {errors.gdprConsent && (
              <p className="mt-2 text-sm text-error">{errors.gdprConsent}</p>
            )}
          </div>
        </div>

        {/* Right: order summary */}
        <div className="h-fit rounded border border-border-light bg-white p-6">
          <h2 className="text-base font-semibold text-charcoal">
            Rendelés összesítő
          </h2>

          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <div key={itemKey(item)} className="flex justify-between text-sm">
                <span className="text-muted">
                  {item.productName} × {item.quantity}
                </span>
                <span className="text-charcoal">
                  {formatHuf(
                    (item.price + (item.printFee ?? 0)) * item.quantity
                  )}
                </span>
              </div>
            ))}

            <div className="flex justify-between text-sm">
              <span className="text-muted">{selectedMethodLabel}</span>
              <span className="text-charcoal">
                {shippingCost > 0 ? formatHuf(shippingCost) : "—"}
              </span>
            </div>
          </div>

          <div className="mt-4 border-t border-border-light pt-4">
            <div className="flex justify-between text-base font-semibold text-charcoal">
              <span>Összesen</span>
              <span>{formatHuf(grandTotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Az ár tartalmazza az ÁFÁ-t
            </p>
          </div>

          {serverError && (
            <p className="mt-4 text-sm text-error">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || items.length === 0 || quotesLoading}
            className="mt-6 w-full rounded-sm bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Átirányítás..." : "Fizetés Stripe-on keresztül"}
          </button>
        </div>
      </div>
    </form>
  );
}

interface FieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  error?: string;
  autoComplete?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function Field({
  label,
  name,
  type,
  value,
  error,
  autoComplete,
  onChange,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-charcoal"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={onChange}
        aria-describedby={error ? `${name}-error` : undefined}
        aria-invalid={!!error}
        className={`w-full rounded border px-3 py-2 text-base text-charcoal placeholder:text-muted focus:outline-none focus:ring-1 ${
          error
            ? "border-error focus:border-error focus:ring-error"
            : "border-border-medium focus:border-charcoal focus:ring-charcoal"
        }`}
      />
      {error && (
        <p id={`${name}-error`} className="mt-1 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
