"use client";

export interface ColorEntry {
  name: string; // Hungarian display name, e.g. "Piros"
  hex: string;  // CSS hex value, e.g. "#cf2e2e"
}

interface ColorPickerProps {
  colors: ColorEntry[];
  selectedColor: string; // hex of the currently selected color
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
      {colors.map(({ name, hex }) => (
        <button
          key={hex}
          onClick={() => onChange(name, hex)}
          aria-label={name}
          aria-pressed={selectedColor === hex}
          title={name}
          // Dynamic background cannot be expressed as a Tailwind class —
          // inline style is the only option for arbitrary runtime hex values.
          style={{ backgroundColor: hex }}
          className={`h-9 w-9 rounded-full border-2 transition-all ${
            selectedColor === hex
              ? "border-white ring-2 ring-white ring-offset-2 ring-offset-charcoal"
              : "border-white/30 hover:border-white/70"
          }`}
        />
      ))}
    </div>
  );
}
