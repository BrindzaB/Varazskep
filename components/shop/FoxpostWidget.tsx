"use client";

import { useEffect, useCallback, useState } from "react";

export interface FoxpostLocker {
  id: string;
  name: string;
  streetAddress: string;
  city: string;
  zip: string;
}

interface FoxpostWidgetProps {
  selected: FoxpostLocker | null;
  onSelect: (locker: FoxpostLocker) => void;
}

// The APT Finder is a standalone web app embedded as an iframe.
// It communicates via postMessage when the user picks a locker.
const APT_FINDER_URL = "https://cdn.foxpost.hu/apt-finder/v1/app/";

export default function FoxpostWidget({ selected, onSelect }: FoxpostWidgetProps) {
  const [open, setOpen] = useState(false);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!e.origin.includes("foxpost.hu")) return;

      // Foxpost sends the payload as a JSON string.
      let d: { operator_id?: string; name?: string; street?: string; city?: string; zip?: string };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }

      if (!d?.operator_id) return;

      onSelect({
        id: d.operator_id,
        name: d.name ?? "",
        streetAddress: d.street ?? "",
        city: d.city ?? "",
        zip: d.zip ?? "",
      });
      setOpen(false);
    },
    [onSelect],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const displayAddress = selected
    ? `${selected.zip} ${selected.city}, ${selected.streetAddress}`
    : null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="font-semibold text-charcoal">
                Foxpost csomagautomata kiválasztása
              </h3>
              <button
                type="button"
                aria-label="Bezárás"
                onClick={() => setOpen(false)}
                className="text-xl leading-none text-gray-400 hover:text-charcoal"
              >
                ✕
              </button>
            </div>
            <iframe
              src={APT_FINDER_URL}
              className="flex-1 border-0"
              style={{ minHeight: "600px" }}
              title="Foxpost csomagautomata kereső"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-charcoal px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
      >
        {selected ? "Automata módosítása" : "Csomagautomata kiválasztása →"}
      </button>

      {selected && (
        <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-sm">
          <p className="font-medium text-charcoal">{selected.name}</p>
          <p className="text-muted">{displayAddress}</p>
        </div>
      )}
    </>
  );
}
