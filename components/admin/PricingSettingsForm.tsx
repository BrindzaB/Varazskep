"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatHuf } from "@/lib/utils/format";
import {
  computeGrossPrice,
  profitPerPieceHuf,
  realisedMarkupPct,
} from "@/lib/pricing/compute";
import type { PricingSettings } from "@/lib/pricing/settings";
import { A4_WIDTH_CM, A4_HEIGHT_CM } from "@/lib/pricing/printFee";

interface Sample {
  name: string;
  sku: string;
  costNetHuf: number;
}

interface Props {
  initial: PricingSettings;
  samples: Sample[];
}

// Numbers are edited as strings so a field can be cleared while typing.
type FormState = Record<keyof PricingSettings, string>;

function toFormState(s: PricingSettings): FormState {
  return {
    malfiniMarkupPct: String(s.malfiniMarkupPct),
    vatPct: String(s.vatPct),
    roundGridHuf: String(s.roundGridHuf),
    eurHufRate: String(s.eurHufRate),
    printFeeSmallHuf: String(s.printFeeSmallHuf),
    printFeeLargeHuf: String(s.printFeeLargeHuf),
  };
}

function toNumbers(f: FormState): PricingSettings {
  return {
    malfiniMarkupPct: Number(f.malfiniMarkupPct),
    vatPct: Number(f.vatPct),
    roundGridHuf: Number(f.roundGridHuf),
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
}: {
  label: string;
  hint: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
        <span className="shrink-0 text-sm text-gray-500">{suffix}</span>
      </div>
      <span className="mt-1 block text-xs text-gray-500">{hint}</span>
    </label>
  );
}

export default function PricingSettingsForm({ initial, samples }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [saved, setSaved] = useState<FormState>(() => toFormState(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const values = toNumbers(form);
  const valid = Object.values(values).every((v) => Number.isFinite(v));
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
        body: JSON.stringify(values),
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

  const grid = values.roundGridHuf;

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Árrés"
            hint="A nettó eladási ár és a beszerzési ár különbsége, a beszerzési ár százalékában."
            suffix="%"
            value={form.malfiniMarkupPct}
            onChange={(v) => set("malfiniMarkupPct", v)}
          />
          <Field
            label="ÁFA"
            hint="A nettó eladási árra rakódó magyar ÁFA."
            suffix="%"
            value={form.vatPct}
            onChange={(v) => set("vatPct", v)}
          />
          <Field
            label="Árrács"
            hint="A bolti ár ennyivel osztható szám alatt 1 Ft-tal áll meg. 100 → …99-re végződő árak."
            suffix="Ft"
            value={form.roundGridHuf}
            onChange={(v) => set("roundGridHuf", v)}
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
              <strong>{grid > 1 ? `${grid - 1}-re végződő` : "egész"}</strong>{" "}
              árra kerekítve.
            </p>
            {grid >= 400 && (
              <p className="mt-1 text-xs text-amber-700">
                Figyelem: {grid} Ft-os rácsnál a kerekítés ±
                {Math.round(grid / 2)} Ft-ot mozdít, ami az olcsóbb termékeken
                jelentősen elviszi az árrést. 100 Ft javasolt.
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
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
      </section>

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
                  const gross = valid
                    ? computeGrossPrice(s.costNetHuf, {
                        markupPct: values.malfiniMarkupPct,
                        vatPct: values.vatPct,
                        roundGridHuf: values.roundGridHuf,
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
          rácsra kerekül. A beszerzési ár a Malfini legkisebb mennyiségi sávja
          (1 db) — nagyobb tételnél olcsóbb, tehát a valós árrés ennél csak jobb
          lehet. A nyomtatás díját külön szedjük a vásárlótól, a csomagolás és a
          fizetési díj viszont ebből a nyereségből megy.
        </p>
      </section>
    </div>
  );
}
