"use client";

// Predefined shirt colors — match the product variants seeded in the database.
// In step 3.5 this list will be filtered to the selected product's available colors.
const SHIRT_COLORS = [
  { name: "Szürke", hex: "#9ca3af" },
  { name: "Fehér", hex: "#ffffff" },
  { name: "Fekete", hex: "#32373c" },
  { name: "Sötétkék", hex: "#1e3a5f" },
  { name: "Piros", hex: "#cf2e2e" },
];

interface ColorPickerProps {
  selectedColor: string;
  onChange: (hex: string) => void;
}

export default function ColorPicker({
  selectedColor,
  onChange,
}: ColorPickerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-medium text-white/60">Szín</span>
      {SHIRT_COLORS.map(({ name, hex }) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          aria-label={name}
          aria-pressed={selectedColor === hex}
          title={name}
          // Dynamic background cannot be expressed as a Tailwind class —
          // inline style is the only option for arbitrary runtime hex values.
          // The same pattern is used in ProductDetails.tsx for color swatches.
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
