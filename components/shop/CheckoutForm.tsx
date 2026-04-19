"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore, itemKey } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";
import { SHIPPING_PRICES, SHIPPING_LABELS, type ShippingMethodKey } from "@/lib/shipping/config";
import FoxpostWidget, { type FoxpostLocker } from "@/components/shop/FoxpostWidget";

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
  address?: string;
  city?: string;
  postalCode?: string;
  gdprConsent?: string;
  locker?: string;
}

function validate(
  fields: FormFields,
  shippingMethod: ShippingMethodKey,
  selectedLocker: FoxpostLocker | null,
): FieldError {
  const errors: FieldError = {};
  if (!fields.name.trim()) errors.name = "A név megadása kötelező.";
  if (!fields.email.trim()) {
    errors.email = "Az e-mail cím megadása kötelező.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Érvénytelen e-mail cím.";
  }

  if (shippingMethod === "MPL_HOME_DELIVERY") {
    if (!fields.address.trim()) errors.address = "A cím megadása kötelező.";
    if (!fields.city.trim()) errors.city = "A város megadása kötelező.";
    if (!fields.postalCode.trim()) {
      errors.postalCode = "Az irányítószám megadása kötelező.";
    } else if (!/^\d{4}$/.test(fields.postalCode.trim())) {
      errors.postalCode = "Az irányítószám 4 számjegyből áll.";
    }
  }

  if (shippingMethod === "FOXPOST_LOCKER" && !selectedLocker) {
    errors.locker = "Válasszon csomagautomatát.";
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
    state.items.reduce((sum, i) => sum + (i.price + (i.printFee ?? 0)) * i.quantity, 0),
  );

  const [fields, setFields] = useState<FormFields>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldError>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodKey>("MPL_HOME_DELIVERY");
  const [selectedLocker, setSelectedLocker] = useState<FoxpostLocker | null>(null);

  const shippingCost = SHIPPING_PRICES[shippingMethod];
  const grandTotal = itemsTotal + shippingCost;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, type, checked } = e.target;
    setFields((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function handleShippingMethodChange(method: ShippingMethodKey) {
    setShippingMethod(method);
    setErrors((prev) => ({ ...prev, address: undefined, city: undefined, postalCode: undefined, locker: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(fields, shippingMethod, selectedLocker);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    // Build the shipping address payload.
    // For Foxpost, use the locker's address fields so the DB shippingAddress
    // column has the same structure regardless of shipping method.
    const shippingAddress =
      shippingMethod === "FOXPOST_LOCKER" && selectedLocker
        ? {
            address: selectedLocker.streetAddress,
            city: selectedLocker.city,
            postalCode: selectedLocker.zip,
            country: "HU",
          }
        : {
            address: fields.address.trim(),
            city: fields.city.trim(),
            postalCode: fields.postalCode.trim(),
            country: "HU",
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
          shipping: {
            method: shippingMethod,
            cost: shippingCost,
            ...(shippingMethod === "FOXPOST_LOCKER" && selectedLocker
              ? {
                  pickupPointId: selectedLocker.id,
                  pickupPointName: selectedLocker.name,
                  pickupPointAddress: `${selectedLocker.zip} ${selectedLocker.city}, ${selectedLocker.streetAddress}`,
                }
              : {}),
          },
          gdprConsent: fields.gdprConsent,
        }),
      });

      if (!res.ok) {
        setServerError("Hiba történt a fizetés elindításakor. Kérjük, próbálja újra.");
        return;
      }

      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch {
      setServerError("Hiba történt a fizetés elindításakor. Kérjük, próbálja újra.");
    } finally {
      setSubmitting(false);
    }
  }

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
                label="Telefonszám (nem kötelező)"
                name="phone"
                type="tel"
                value={fields.phone}
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

            <div className="mt-4 space-y-3">
              {(["MPL_HOME_DELIVERY", "FOXPOST_LOCKER"] as const).map((method) => (
                <label
                  key={method}
                  className={`flex cursor-pointer items-center justify-between rounded border p-4 transition-colors ${
                    shippingMethod === method
                      ? "border-charcoal bg-gray-50"
                      : "border-border-medium hover:border-charcoal"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={method}
                      checked={shippingMethod === method}
                      onChange={() => handleShippingMethodChange(method)}
                      className="accent-charcoal"
                    />
                    <span className="text-sm font-medium text-charcoal">
                      {SHIPPING_LABELS[method]}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-charcoal">
                    {formatHuf(SHIPPING_PRICES[method])}
                  </span>
                </label>
              ))}
            </div>

            {/* Foxpost locker selector */}
            {shippingMethod === "FOXPOST_LOCKER" && (
              <div className="mt-4">
                <FoxpostWidget selected={selectedLocker} onSelect={setSelectedLocker} />
                {errors.locker && (
                  <p className="mt-2 text-sm text-error">{errors.locker}</p>
                )}
              </div>
            )}
          </fieldset>

          {/* Shipping address — only for home delivery */}
          {shippingMethod === "MPL_HOME_DELIVERY" && (
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
                  {formatHuf((item.price + (item.printFee ?? 0)) * item.quantity)}
                </span>
              </div>
            ))}

            <div className="flex justify-between text-sm">
              <span className="text-muted">{SHIPPING_LABELS[shippingMethod]}</span>
              <span className="text-charcoal">{formatHuf(shippingCost)}</span>
            </div>
          </div>

          <div className="mt-4 border-t border-border-light pt-4">
            <div className="flex justify-between text-base font-semibold text-charcoal">
              <span>Összesen</span>
              <span>{formatHuf(grandTotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Az ár tartalmazza az ÁFÁ-t</p>
          </div>

          {serverError && (
            <p className="mt-4 text-sm text-error">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || items.length === 0}
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

function Field({ label, name, type, value, error, autoComplete, onChange }: FieldProps) {
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
