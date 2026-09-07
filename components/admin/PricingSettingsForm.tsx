"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatHuf } from "@/lib/utils/format";
import {
  computeGrossPrice,
  formatEndings,
  parseEndings,
  profitPerPieceHuf,
  realisedMarkupPct,
  roundToEndings,
} from "@/lib/pricing/compute";
import type { PricingSettings } from "@/lib/pricing/settings";
import { A4_WIDTH_CM, A4_HEIGHT_CM } from "@/lib/pricing/printFee";

interface Sample {
  name: string;
  sku: string;
  costNetHuf: number;
}

interface ShippingSample {
  label: string;
  netHuf: number;
}

interface Props {
  initial: PricingSettings;
  samples: Sample[];
  shippingSamples: ShippingSample[];
  shippingPreviewWeightGrams: number;
}

// Every field is edited as text so an input can be cleared while typing, and so the
// endings lists ("50,90") can be typed naturally.
type FormState = Record<keyof PricingSettings, string>;

function toFormState(s: PricingSettings): FormState {
  return {
    malfiniMarkupPct: String(s.malfiniMarkupPct),
    vatPct: String(s.vatPct),
    priceEndings: formatEndings(s.priceEndings),
    shippingPriceEndings: formatEndings(s.shippingPriceEndings),
    eurHufRate: String(s.eurHufRate),
    printFeeSmallHuf: String(s.printFeeSmallHuf),
    printFeeLargeHuf: String(s.printFeeLargeHuf),
  };
}

// Parsed form values. Null on a field the user has not typed validly yet, which keeps the
// live previews from rendering nonsense mid-edit.
interface ParsedForm {
  malfiniMarkupPct: number;
  vatPct: number;
  priceEndings: number[] | null;
  shippingPriceEndings: number[] | null;
  eurHufRate: number;
  printFeeSmallHuf: number;
  printFeeLargeHuf: number;
}

function parseForm(f: FormState): ParsedForm {
  return {
    malfiniMarkupPct: Number(f.malfiniMarkupPct),
    vatPct: Number(f.vatPct),
    priceEndings: parseEndings(f.priceEndings),
    shippingPriceEndings: parseEndings(f.shippingPriceEndings),
    eurHufRate: Number(f.eurHufRate),
    printFeeSmallHuf: Number(f.printFeeSmallHuf),
    printFeeLargeHuf: Number(f.printFeeLargeHuf),
  };
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400";

function Field({
  label,
  hint,
  suffix,
  value,
  onChange,
  type = "number",
  invalid = false,
}: {
  label: string;
  hint: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  type?: "number" | "text";
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} ${invalid ? "border-red-500" : ""}`}
        />
        <span className="shrink-0 text-sm text-gray-500">{suffix}</span>
      </div>
      <span className="mt-1 block text-xs text-gray-500">{hint}</span>
    </label>
  );
}

// Human description of an endings list: [50, 90] → "…50 vagy …90".
function describeEndings(endings: number[]): string {
  return endings.map((e) => `…${String(e).padStart(2, "0")}`).join(" vagy ");
}

export default function PricingSettingsForm({
  initial,
  samples,
  shippingSamples,
  shippingPreviewWeightGrams,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [saved, setSaved] = useState<FormState>(() => toFormState(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const values = parseForm(form);
  const numbersValid = [
    values.malfiniMarkupPct,
    values.vatPct,
    values.eurHufRate,
    values.printFeeSmallHuf,
    values.printFeeLargeHuf,
  ].every((v) => Number.isFinite(v));
  const productEndings = values.priceEndings;
  const shippingEndings = values.shippingPriceEndings;
  const valid =
    numbersValid && productEndings !== null && shippingEndings !== null;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  function set(field: keyof PricingSettings, v: string) {
    setForm((f) => ({ ...f, [field]: v }));
    setDone(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // Endings go over as the typed string; the server parses and validates them.
        body: JSON.stringify({ ...values, ...pickEndings(form) }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Nem sikerült menteni.");
        return;
      }
      setSaved(toFormState(body));
      setDone(true);
      // Storefront pages are ISR-cached; refresh so the admin preview reflects the save.
      router.refresh();
    } catch {
      setError("Hálózati hiba — a mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  }

  function pickEndings(f: FormState) {
    return {
      priceEndings: f.priceEndings,
      shippingPriceEndings: f.shippingPriceEndings,
    };
  }

  return (
    <div className="mt-8 space-y-6">
      {/* ── Product pricing ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Termékárak</h2>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            label="Árrés"
            hint="A nettó eladási ár és a beszerzési ár különbsége, a beszerzési ár százalékában."
            suffix="%"
            value={form.malfiniMarkupPct}
            onChange={(v) => set("malfiniMarkupPct", v)}
          />
          <Field
            label="ÁFA"
            hint="A nettó árra rakódó magyar ÁFA. A szállítási díjra is ez érvényes."
            suffix="%"
            value={form.vatPct}
            onChange={(v) => set("vatPct", v)}
          />
          <Field
            label="Termékárak végződése"
            hint="Vesszővel elválasztva. A bolti ár a legközelebbi ilyen végződésű árra kerül."
            suffix={
              productEndings ? describeEndings(productEndings) : "érvénytelen"
            }
            value={form.priceEndings}
            onChange={(v) => set("priceEndings", v)}
            type="text"
            invalid={productEndings === null}
          />
          <Field
            label="EUR/HUF árfolyam"
            hint="Csak akkor él, ha a Malfini EUR árat küld — jelenleg HUF-ot küld."
            suffix="Ft"
            value={form.eurHufRate}
            onChange={(v) => set("eurHufRate", v)}
          />
        </div>

        {valid && (
          <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              <strong>
                beszerzési ár × {(1 + values.malfiniMarkupPct / 100).toFixed(2)}
              </strong>{" "}
              = nettó eladási ár,{" "}
              <strong>× {(1 + values.vatPct / 100).toFixed(2)}</strong> =
              bruttó, majd a legközelebbi{" "}
              <strong>{describeEndings(productEndings!)}</strong> árra
              kerekítve.
            </p>
          </div>
        )}
      </section>

      {/* ── Print fee ───────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Nyomtatási díj</h2>
        <p className="mt-1 text-xs text-gray-500">
          A tervezőbe helyezett minták díja darabonként. A besorolás A4-hez
          képest történik: ha a minta szélessége vagy magassága meghaladja az
          A4-et ({A4_WIDTH_CM}×{A4_HEIGHT_CM} cm), a nagyobb díj érvényes.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            label="A4-en belüli minta"
            hint="Mindkét mérete A4-en belül van."
            suffix="Ft / minta"
            value={form.printFeeSmallHuf}
            onChange={(v) => set("printFeeSmallHuf", v)}
          />
          <Field
            label="A4-nél nagyobb minta"
            hint="Legalább az egyik mérete meghaladja az A4-et."
            suffix="Ft / minta"
            value={form.printFeeLargeHuf}
            onChange={(v) => set("printFeeLargeHuf", v)}
          />
        </div>

        <p className="mt-4 text-xs text-gray-500">
          A díjat a rendszer a mentett terv geometriájából számolja újra a
          fizetéskor, nem a böngészőtől kapja — a tervezőben látott összeg csak
          tájékoztatás. Egy kétoldalas, oldalanként egy mintás terv két díjat
          jelent.
        </p>
      </section>

      {/* ── Shipping ────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">Szállítási díj</h2>
        <p className="mt-1 text-xs text-gray-500">
          A díj a Kvikk élő árlistájából jön (nettó), erre kerül az ÁFA. A Kvikk
          havonta frissíti az árlistát — ez automatikusan érvényesül, legkésőbb
          egy órán belül, nincs vele teendő.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Field
            label="Szállítási díj végződése"
            hint="Vesszővel elválasztva. Itt mindig FELFELÉ kerekítünk, hogy a díj ne menjen a Kvikk-költség alá."
            suffix={
              shippingEndings ? describeEndings(shippingEndings) : "érvénytelen"
            }
            value={form.shippingPriceEndings}
            onChange={(v) => set("shippingPriceEndings", v)}
            type="text"
            invalid={shippingEndings === null}
          />
        </div>

        {shippingSamples.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            A Kvikk árlista most nem érhető el, ezért nincs előnézet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 text-xs text-gray-500">
              Előnézet {shippingPreviewWeightGrams} g-os csomagra:
            </p>
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-500">
                    Szállítási mód
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Kvikk nettó
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Vásárlói díj
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Nálunk marad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shippingSamples.map((s) => {
                  const gross =
                    valid && shippingEndings
                      ? roundToEndings(
                          s.netHuf * (1 + values.vatPct / 100),
                          shippingEndings,
                          "up"
                        )
                      : 0;
                  const keep = valid
                    ? gross / (1 + values.vatPct / 100) - s.netHuf
                    : 0;
                  return (
                    <tr key={s.label}>
                      <td className="px-2 py-2 text-gray-900">{s.label}</td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {formatHuf(s.netHuf)}
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900">
                        {formatHuf(gross)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right ${
                          keep < 0 ? "text-red-600" : "text-gray-600"
                        }`}
                      >
                        {formatHuf(Math.round(keep))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Product preview ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Előnézet valós termékeken
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          A táblázat azonnal frissül, ahogy a fenti mezőket állítod — mentés
          előtt is.
        </p>

        {samples.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            Nem érhető el mintatermék (a Malfini katalógus vagy a beszerzési
            árak nem töltődtek be).
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="border-b border-gray-100">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-500">
                    Termék
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Beszerzés
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Nettó eladási
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Bolti ár
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Nyereség/db
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Árrés
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {samples.map((s) => {
                  const gross =
                    valid && productEndings
                      ? computeGrossPrice(s.costNetHuf, {
                          markupPct: values.malfiniMarkupPct,
                          vatPct: values.vatPct,
                          endings: productEndings,
                        })
                      : 0;
                  const profit = valid
                    ? profitPerPieceHuf(gross, s.costNetHuf, values.vatPct)
                    : 0;
                  const realised = valid
                    ? realisedMarkupPct(gross, s.costNetHuf, values.vatPct)
                    : 0;
                  return (
                    <tr key={s.sku}>
                      <td className="px-2 py-2 text-gray-900">
                        {s.name}
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {s.sku}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {formatHuf(s.costNetHuf)}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500">
                        {formatHuf(
                          Math.round(gross / (1 + values.vatPct / 100))
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-medium text-gray-900">
                        {formatHuf(gross)}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-600">
                        {formatHuf(Math.round(profit))}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium ${
                          realised < values.malfiniMarkupPct * 0.8
                            ? "text-red-600"
                            : "text-green-700"
                        }`}
                      >
                        {realised.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500">
          A tényleges árrés a beállítottól kicsit eltér, mert a bolti ár a
          megadott végződésre kerekül. A beszerzési ár a Malfini legkisebb
          mennyiségi sávja (1 db) — nagyobb tételnél olcsóbb, tehát a valós
          árrés ennél csak jobb lehet. A nyomtatás díját külön szedjük a
          vásárlótól, a csomagolás és a fizetési díj viszont ebből a nyereségből
          megy.
        </p>
      </section>

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gray-300 bg-white p-3 shadow-lg">
        <button
          onClick={handleSave}
          disabled={!valid || !dirty || saving}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Mentés…" : "Mentés"}
        </button>
        {dirty && !saving && (
          <button
            onClick={() => {
              setForm(saved);
              setError(null);
            }}
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Elvetés
          </button>
        )}
        {done && !dirty && (
          <span className="text-sm text-green-700">Mentve.</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
