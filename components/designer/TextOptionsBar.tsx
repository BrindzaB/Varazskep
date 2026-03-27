"use client";

export const FONT_OPTIONS = [
  { label: "Sans", family: "Inter, sans-serif" },
  { label: "Serif", family: "Georgia, serif" },
  { label: "Bold", family: "Impact, sans-serif" },
  { label: "Mono", family: "'Courier New', monospace" },
] as const;

export const DEFAULT_TEXT_FONT = FONT_OPTIONS[0].family;
export const DEFAULT_TEXT_COLOR = "#32373c";

const TEXT_COLORS = [
  { name: "Fekete", hex: "#32373c" },
  { name: "Fehér", hex: "#ffffff" },
  { name: "Piros", hex: "#cf2e2e" },
  { name: "Sötétkék", hex: "#1e3a5f" },
  { name: "Szürke", hex: "#9ca3af" },
];

interface TextOptionsBarProps {
  currentFont: string;
  currentColor: string;
  onFontChange: (font: string) => void;
  onColorChange: (color: string) => void;
}

export default function TextOptionsBar({
  currentFont,
  currentColor,
  onFontChange,
  onColorChange,
}: TextOptionsBarProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border-light bg-white px-4 py-2 shadow-card">
      {/* Font picker */}
      <div className="flex gap-1">
        {FONT_OPTIONS.map((font) => (
          <button
            key={font.family}
            onClick={() => onFontChange(font.family)}
            aria-pressed={currentFont === font.family}
            title={font.label}
            // Dynamic fontFamily — inline style is required for arbitrary runtime font values
            style={{ fontFamily: font.family }}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              currentFont === font.family
                ? "bg-charcoal text-white"
                : "text-muted hover:bg-off-white hover:text-charcoal"
            }`}
          >
            {font.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border-light" />

      {/* Color swatches */}
      <div className="flex gap-2">
        {TEXT_COLORS.map(({ name, hex }) => (
          <button
            key={hex}
            onClick={() => onColorChange(hex)}
            aria-label={name}
            aria-pressed={currentColor === hex}
            title={name}
            // Dynamic backgroundColor — inline style required for runtime hex values
            style={{ backgroundColor: hex }}
            className={`h-6 w-6 rounded-full border-2 transition-all ${
              currentColor === hex
                ? "border-charcoal ring-2 ring-charcoal ring-offset-1"
                : "border-border-light hover:border-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
