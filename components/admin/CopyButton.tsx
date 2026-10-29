"use client";

import { useState } from "react";

// Small "Másolás" button that puts `value` on the clipboard — used to paste order data
// into Billingo by hand.
export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context or denied) — the value stays selectable.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 rounded border border-gray-200 px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-900"
    >
      {copied ? "Másolva" : "Másolás"}
    </button>
  );
}
