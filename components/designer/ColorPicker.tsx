"use client";

export interface ColorEntry {
  name: string;      // Hungarian display name, e.g. "Piros"
  hex: string;       // CSS hex for local products; variant code for Malfini (used as unique key)
  iconUrl?: string;  // When set, renders <img> instead of a colored circle (used for Malfini swatches)
}

interface ColorPickerProps {
  colors: ColorEntry[];
  selectedColor: string; // hex (local) or variant code (Malfini) of the currently selected color
  onChange: (name: string, hex: string) => void;
}

export default function ColorPicker({
  colors,
  selectedColor,
  onChange,
}: ColorPickerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-medium text-white/60">Szín</span>
      {colors.map(({ name, hex, iconUrl }) => (
        <button
          key={hex}
          onClick={() => onChange(name, hex)}
          aria-label={name}
          aria-pressed={selectedColor === hex}
          title={name}
          className={`h-9 w-9 overflow-hidden rounded-full border-2 transition-all ${
            selectedColor === hex
              ? "border-white ring-2 ring-white ring-offset-2 ring-offset-charcoal"
              : "border-white/30 hover:border-white/70"
          }`}
          // Dynamic background only for local (hex) swatches without an iconUrl.
          // Malfini swatches use <img> instead — no inline style needed.
          style={iconUrl ? undefined : { backgroundColor: hex }}
        >
          {iconUrl && (
            <img
              src={iconUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          )}
        </button>
      ))}
    </div>
  );
}
