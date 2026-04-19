"use client";

import { useEffect, useCallback, useRef, useState } from "react";

export interface FoxpostLocker {
  id: string;           // OperatorCode from Foxpost
  name: string;         // machine name
  streetAddress: string;
  city: string;
  zip: string;
}

interface FoxpostWidgetProps {
  selected: FoxpostLocker | null;
  onSelect: (locker: FoxpostLocker) => void;
}

// Foxpost APT Finder widget — no API key required for the public map embed.
// After registering as a business partner you receive credentials for order
// submission (label generation), but the map widget itself is freely embeddable.
// Widget docs: https://webapi.foxpost.hu/swagger-ui/index.html
const WIDGET_SCRIPT_URL = "https://cdn.foxpost.hu/apt-finder/v1/app/";
const CONTAINER_ID = "foxpost-apt-finder";

export default function FoxpostWidget({ selected, onSelect }: FoxpostWidgetProps) {
  const [open, setOpen] = useState(false);
  const scriptLoaded = useRef(false);

  // Load the Foxpost widget script once per page
  useEffect(() => {
    if (scriptLoaded.current || document.getElementById("foxpost-widget-script")) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.id = "foxpost-widget-script";
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    document.head.appendChild(script);
    scriptLoaded.current = true;
  }, []);

  const handleMachineSelected = useCallback(
    (e: Event) => {
      const detail = (e as CustomEvent<{
        OperatorCode: string;
        Name: string;
        Address: string;
        City: string;
        Zip: string;
      }>).detail;

      onSelect({
        id: detail.OperatorCode,
        name: detail.Name,
        streetAddress: detail.Address,
        city: detail.City,
        zip: detail.Zip,
      });
      setOpen(false);
    },
    [onSelect],
  );

  useEffect(() => {
    document.addEventListener("fp.aptFinder.machine.selected", handleMachineSelected);
    return () => {
      document.removeEventListener("fp.aptFinder.machine.selected", handleMachineSelected);
    };
  }, [handleMachineSelected]);

  const displayAddress = selected
    ? `${selected.zip} ${selected.city}, ${selected.streetAddress}`
    : null;

  return (
    <>
      {/* Widget container — kept in DOM so the widget script can always find it */}
      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center bg-black/60" : "hidden"}>
        <div className="relative flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="font-semibold text-charcoal">Foxpost csomagautomata kiválasztása</h3>
            <button
              type="button"
              aria-label="Bezárás"
              onClick={() => setOpen(false)}
              className="text-xl leading-none text-gray-400 hover:text-charcoal"
            >
              ✕
            </button>
          </div>
          <div id={CONTAINER_ID} className="flex-1 overflow-auto" />
        </div>
      </div>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-charcoal px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-charcoal hover:text-white"
      >
        {selected ? "Automata módosítása" : "Csomagautomata kiválasztása →"}
      </button>

      {/* Selected locker summary */}
      {selected && (
        <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-sm">
          <p className="font-medium text-charcoal">{selected.name}</p>
          <p className="text-muted">{displayAddress}</p>
        </div>
      )}
    </>
  );
}
