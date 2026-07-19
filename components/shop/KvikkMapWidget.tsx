"use client";

import { useCallback, useEffect, useState } from "react";
import type { KvikkMapCallbackResult, KvikkMapPoint } from "@/lib/kvikk/types";

// The Kvikk Map is an embeddable widget loaded as a module script from the CDN. It exposes
// a global `kvikkMapWidget.open(config)` that opens a full-screen map dialog; the selected
// pickup point (or a manual-entry fallback) comes back via the `callback`.
// Docs: docs/kvikk-api.md ("Kvikk map widget"). NOTE: the Maps key is domain-bound to
// varazskep.vercel.app, so on localhost the widget shows its text fallback instead of the map.
const WIDGET_SRC = "https://cdn.kvikk.hu/map/kvikkMapWidget.js";

// Brand colors (see tailwind.config.ts) passed to the widget's own theming.
const BRAND_PRIMARY = "#0fa0e4";
const BRAND_TEXT = "#4d4a48";

interface KvikkMapCourierConfig {
  courier: string;
  type: string;
  price: { hu: number };
}

interface KvikkMapOpenConfig {
  apiKey: string;
  language?: "hu" | "en";
  currency?: string;
  callback: (result: KvikkMapCallbackResult) => void;
  couriers: KvikkMapCourierConfig[];
  color?: { primary?: string; text?: string };
}

declare global {
  interface Window {
    kvikkMapWidget?: { open: (config: KvikkMapOpenConfig) => void };
  }
}

export interface KvikkPointOption {
  courier: string;
  mapType: string; // Kvikk Map widget short type code (widget `type`)
  priceHuf: number; // gross price shown on the map for this courier+type
}

interface KvikkMapWidgetProps {
  pointOptions: KvikkPointOption[];
  onSelect: (point: KvikkMapPoint) => void;
  // Called when the widget could not load the map and the user typed a manual description.
  onFallback?: (info: string) => void;
  hasSelection?: boolean;
}

export default function KvikkMapWidget({
  pointOptions,
  onSelect,
  onFallback,
  hasSelection = false,
}: KvikkMapWidgetProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_KVIKK_MAP_API_KEY;

  // Load the widget module script once (idempotent — reuse an existing tag if present).
  useEffect(() => {
    if (typeof window !== "undefined" && window.kvikkMapWidget) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${WIDGET_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true));
      if (window.kvikkMapWidget) setScriptReady(true);
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = WIDGET_SRC;
    script.addEventListener("load", () => setScriptReady(true));
    document.body.appendChild(script);
  }, []);

  const openMap = useCallback(() => {
    if (!apiKey || !window.kvikkMapWidget) return;
    window.kvikkMapWidget.open({
      apiKey,
      language: "hu",
      currency: "HUF",
      color: { primary: BRAND_PRIMARY, text: BRAND_TEXT },
      couriers: pointOptions.map((o) => ({
        courier: o.courier,
        type: o.mapType,
        price: { hu: o.priceHuf },
      })),
      callback: (result) => {
        if ("fallbackInfo" in result) {
          onFallback?.(result.fallbackInfo);
          return;
        }
        onSelect(result);
      },
    });
  }, [apiKey, pointOptions, onSelect, onFallback]);

  if (!apiKey) {
    return (
      <p className="mt-2 text-sm text-error">
        A térkép jelenleg nem elérhető. Kérjük, válasszon házhozszállítást.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={openMap}
      disabled={!scriptReady || pointOptions.length === 0}
      className="mt-3 rounded border border-charcoal px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {hasSelection
        ? "Átvételi pont módosítása"
        : "Átvételi pont kiválasztása →"}
    </button>
  );
}
