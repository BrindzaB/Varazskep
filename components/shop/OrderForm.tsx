"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { isValidHungarianPhone } from "@/lib/utils/phone";
import {
  fileExtension,
  ORDER_FORM_FILE_TYPES,
  ORDER_FORM_LIMITS,
  type OrderFormProduct,
  type OrderFormSubmission,
} from "@/lib/orderForm/types";

interface Props {
  products: OrderFormProduct[];
}

interface LineState {
  id: number;
  productKey: string;
  colorName: string;
  ref: string; // selected size
  quantity: string;
}

interface FileState {
  id: number;
  fileName: string;
  status: "uploading" | "done" | "error";
  path?: string;
  error?: string;
}

const ACCEPT = Object.keys(ORDER_FORM_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(",");

let nextId = 1;
const emptyLine = (): LineState => ({
  id: nextId++,
  productKey: "",
  colorName: "",
  ref: "",
  quantity: "",
});

// Order form (megrendelő lap): a quick request for larger, typically corporate orders.
// No prices and no payment — the shop contacts the customer to agree the details.
export default function OrderForm({ products }: Props) {
  const [fields, setFields] = useState({
    name: "",
    email: "",
    phone: "",
    note: "",
    gdprConsent: false,
    website: "", // honeypot
  });
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [files, setFiles] = useState<FileState[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const groups = Array.from(new Set(products.map((p) => p.group)));
  const productOf = (key: string) => products.find((p) => p.key === key);

  // An edited field's error is cleared at once instead of lingering until the next submit.
  function clearError(key: string) {
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  function setField<K extends keyof typeof fields>(
    key: K,
    value: (typeof fields)[K]
  ) {
    setFields((f) => ({ ...f, [key]: value }));
    clearError(key);
  }

  function updateLine(id: number, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    clearError(`line-${id}`);
  }

  async function uploadFile(file: File, id: number) {
    const fail = (error: string) =>
      setFiles((fs) =>
        fs.map((f) => (f.id === id ? { ...f, status: "error", error } : f))
      );
    try {
      const res = await fetch("/api/order-form/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, size: file.size }),
      });
      const data = (await res.json()) as {
        path?: string;
        signedUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.path || !data.signedUrl) {
        fail(data.error ?? "A feltöltés nem sikerült.");
        return;
      }
      // Straight to storage — the file never passes through our server.
      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const put = await fetch(data.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body,
      });
      if (!put.ok) {
        fail("A feltöltés nem sikerült.");
        return;
      }
      setFiles((fs) =>
        fs.map((f) =>
          f.id === id ? { ...f, status: "done", path: data.path } : f
        )
      );
    } catch {
      fail("Hálózati hiba a feltöltés közben.");
    }
  }

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const room = ORDER_FORM_LIMITS.maxAttachments - files.length;
    const accepted = Array.from(selected).slice(0, Math.max(0, room));
    const added: FileState[] = [];
    for (const file of accepted) {
      const id = nextId++;
      let error: string | undefined;
      if (!(fileExtension(file.name) in ORDER_FORM_FILE_TYPES)) {
        error = "Nem támogatott fájltípus.";
      } else if (file.size > ORDER_FORM_LIMITS.maxFileBytes) {
        error = "A fájl nagyobb 20 MB-nál.";
      }
      added.push({
        id,
        fileName: file.name,
        status: error ? "error" : "uploading",
        error,
      });
      if (!error) void uploadFile(file, id);
    }
    setFiles((fs) => [...fs, ...added]);
    clearError("files");
    if (fileInput.current) fileInput.current.value = "";
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!fields.name.trim()) e.name = "Add meg a neved.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim()))
      e.email = "Adj meg egy érvényes e-mail címet.";
    if (!isValidHungarianPhone(fields.phone))
      e.phone = "Adj meg egy érvényes magyar telefonszámot.";
    if (!fields.note.trim()) e.note = "Írd le a megrendelés részleteit.";
    if (!fields.gdprConsent)
      e.gdprConsent = "Az adatkezelési hozzájárulás elfogadása kötelező.";
    for (const line of lines) {
      if (isBlank(line)) continue;
      const qty = Number(line.quantity);
      if (
        !line.ref ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > ORDER_FORM_LIMITS.maxQuantity
      ) {
        e[`line-${line.id}`] =
          "Válassz terméket, színt, méretet, és adj meg darabszámot.";
      }
    }
    if (files.some((f) => f.status === "uploading"))
      e.files = "Várd meg, amíg a fájlok feltöltése befejeződik.";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const payload: OrderFormSubmission = {
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      note: fields.note,
      gdprConsent: fields.gdprConsent,
      website: fields.website,
      lines: lines
        .filter((l) => !isBlank(l))
        .map((l) => ({
          productKey: l.productKey,
          ref: l.ref,
          quantity: Number(l.quantity),
        })),
      attachments: files
        .filter((f) => f.status === "done" && f.path)
        .map((f) => ({ path: f.path!, fileName: f.fileName })),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/order-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(data.error ?? "A beküldés nem sikerült.");
        return;
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError("Hálózati hiba. Kérjük, próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border border-border-light bg-white p-8 text-center">
        <div className="mb-4 text-5xl">✓</div>
        <h2 className="mb-2 text-2xl font-bold text-charcoal">
          Köszönjük a megrendelésed!
        </h2>
        <p className="mb-6 text-muted">
          A visszaigazolást elküldtük a megadott e-mail címre. Hamarosan
          felvesszük veled a kapcsolatot a részletek, a végösszeg és az átvétel
          egyeztetése miatt.
        </p>
        <Link
          href="/products"
          className="inline-block rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark"
        >
          Vissza a termékekhez
        </Link>
      </div>
    );
  }

  const inputClass = (error?: string) =>
    `w-full rounded border px-3 py-2 text-base text-charcoal placeholder:text-muted focus:outline-none focus:ring-1 ${
      error
        ? "border-error focus:border-error focus:ring-error"
        : "border-border-medium focus:border-charcoal focus:ring-charcoal"
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {/* Contact */}
      <fieldset className="rounded border border-border-light bg-white p-6">
        <legend className="px-1 text-base font-semibold text-charcoal">
          Kapcsolattartó
        </legend>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(
            [
              ["name", "Név", "text", "name"],
              ["email", "E-mail cím", "email", "email"],
              ["phone", "Telefonszám", "tel", "tel"],
            ] as const
          ).map(([key, label, type, autoComplete]) => (
            <div key={key}>
              <label
                htmlFor={key}
                className="mb-1 block text-sm font-medium text-charcoal"
              >
                {label}
              </label>
              <input
                id={key}
                type={type}
                autoComplete={autoComplete}
                value={fields[key]}
                onChange={(e) => setField(key, e.target.value)}
                aria-invalid={!!errors[key]}
                className={inputClass(errors[key])}
              />
              {errors[key] && (
                <p className="mt-1 text-sm text-error">{errors[key]}</p>
              )}
            </div>
          ))}
        </div>
        {/* Honeypot — hidden from people, filled by bots */}
        <div className="absolute -left-[10000px]" aria-hidden="true">
          <label htmlFor="website">Weboldal</label>
          <input
            id="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={fields.website}
            onChange={(e) => setField("website", e.target.value)}
          />
        </div>
      </fieldset>

      {/* Products */}
      <fieldset className="rounded border border-border-light bg-white p-6">
        <legend className="px-1 text-base font-semibold text-charcoal">
          Termékek
        </legend>
        <p className="mt-2 text-sm text-muted">
          Válaszd ki a termékeket színnel, mérettel és darabszámmal. Több méret
          vagy szín esetén adj hozzá új sort. Ha a kívánt termék nem szerepel a
          listában, írd le a megrendelés szövegében.
        </p>

        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const product = productOf(line.productKey);
            const color = product?.colors.find(
              (c) => c.name === line.colorName
            );
            const error = errors[`line-${line.id}`];
            return (
              <div
                key={line.id}
                className="rounded border border-border-light p-3"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[2fr_1.2fr_1fr_0.8fr_auto] sm:items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Termék
                    </label>
                    <select
                      value={line.productKey}
                      onChange={(e) => {
                        const next = productOf(e.target.value);
                        updateLine(line.id, {
                          productKey: e.target.value,
                          // Preselect when there is only one choice.
                          colorName:
                            next?.colors.length === 1 ? next.colors[0].name : "",
                          ref:
                            next?.colors.length === 1 &&
                            next.colors[0].sizes.length === 1
                              ? next.colors[0].sizes[0].ref
                              : "",
                        });
                      }}
                      className={inputClass(error)}
                    >
                      <option value="">Válassz…</option>
                      {groups.map((group) => (
                        <optgroup key={group} label={group}>
                          {products
                            .filter((p) => p.group === group)
                            .map((p) => (
                              <option key={p.key} value={p.key}>
                                {p.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Szín
                    </label>
                    <select
                      value={line.colorName}
                      disabled={!product}
                      onChange={(e) => {
                        const next = product?.colors.find(
                          (c) => c.name === e.target.value
                        );
                        updateLine(line.id, {
                          colorName: e.target.value,
                          ref: next?.sizes.length === 1 ? next.sizes[0].ref : "",
                        });
                      }}
                      className={inputClass(error)}
                    >
                      <option value="">Válassz…</option>
                      {product?.colors.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Méret
                    </label>
                    <select
                      value={line.ref}
                      disabled={!color}
                      onChange={(e) =>
                        updateLine(line.id, { ref: e.target.value })
                      }
                      className={inputClass(error)}
                    >
                      <option value="">Válassz…</option>
                      {color?.sizes.map((s) => (
                        <option key={s.ref} value={s.ref}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Darab
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={ORDER_FORM_LIMITS.maxQuantity}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(line.id, { quantity: e.target.value })
                      }
                      className={inputClass(error)}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((ls) =>
                          ls.length === 1
                            ? [emptyLine()]
                            : ls.filter((l) => l.id !== line.id)
                        )
                      }
                      className="rounded px-3 py-2 text-sm text-muted transition-colors hover:bg-gray-100 hover:text-charcoal"
                      aria-label="Sor törlése"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                {error && <p className="mt-2 text-sm text-error">{error}</p>}
              </div>
            );
          })}
        </div>

        {lines.length < ORDER_FORM_LIMITS.maxLines && (
          <button
            type="button"
            onClick={() => setLines((ls) => [...ls, emptyLine()])}
            className="mt-4 rounded-sm border border-charcoal px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-white"
          >
            + Új sor
          </button>
        )}
      </fieldset>

      {/* Note + files */}
      <fieldset className="rounded border border-border-light bg-white p-6">
        <legend className="px-1 text-base font-semibold text-charcoal">
          Megrendelés részletei
        </legend>
        <div className="mt-4">
          <label
            htmlFor="note"
            className="mb-1 block text-sm font-medium text-charcoal"
          >
            Megrendelés szövege
          </label>
          <textarea
            id="note"
            rows={6}
            maxLength={ORDER_FORM_LIMITS.maxNoteLength}
            value={fields.note}
            onChange={(e) => setField("note", e.target.value)}
            placeholder="Pl. a minta helye és mérete (elöl / hátul), a felirat szövege, határidő, átvétel módja…"
            aria-invalid={!!errors.note}
            className={inputClass(errors.note)}
          />
          {errors.note && (
            <p className="mt-1 text-sm text-error">{errors.note}</p>
          )}
        </div>

        <div className="mt-6">
          <p className="mb-1 text-sm font-medium text-charcoal">
            Minta, logó feltöltése
          </p>
          <p className="mb-3 text-sm text-muted">
            PNG, JPG, WebP, PDF, SVG, AI vagy EPS · fájlonként legfeljebb 20 MB ·
            legfeljebb {ORDER_FORM_LIMITS.maxAttachments} fájl
          </p>
          {files.length > 0 && (
            <ul className="mb-3 space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded border border-border-light px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-charcoal">
                    {f.fileName}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    {f.status === "uploading" && (
                      <span className="text-muted">Feltöltés…</span>
                    )}
                    {f.status === "done" && (
                      <span className="text-green-700">Feltöltve</span>
                    )}
                    {f.status === "error" && (
                      <span className="text-error">{f.error}</span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((fs) => fs.filter((x) => x.id !== f.id))
                      }
                      className="text-muted hover:text-charcoal"
                      aria-label={`${f.fileName} eltávolítása`}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {files.length < ORDER_FORM_LIMITS.maxAttachments && (
            <label className="inline-block cursor-pointer rounded-sm border border-charcoal px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-charcoal hover:text-white">
              Fájlok kiválasztása
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ACCEPT}
                onChange={(e) => handleFiles(e.target.files)}
                className="sr-only"
              />
            </label>
          )}
          {errors.files && (
            <p className="mt-2 text-sm text-error">{errors.files}</p>
          )}
        </div>
      </fieldset>

      {/* GDPR consent */}
      <div className="rounded border border-border-light bg-white p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={fields.gdprConsent}
            onChange={(e) => setField("gdprConsent", e.target.checked)}
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
            , és hozzájárulok személyes adataim megrendelés teljesítéséhez
            szükséges kezeléséhez.
          </span>
        </label>
        {errors.gdprConsent && (
          <p className="mt-2 text-sm text-error">{errors.gdprConsent}</p>
        )}
      </div>

      {submitError && (
        <p className="rounded border border-error bg-red-50 px-4 py-3 text-sm text-error">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-sm bg-brand-blue px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-violet disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {submitting ? "Küldés…" : "Megrendelés elküldése"}
      </button>
    </form>
  );
}

function isBlank(line: LineState): boolean {
  return !line.productKey && !line.quantity;
}
