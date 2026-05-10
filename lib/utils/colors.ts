// Maps Hungarian color names (as stored in the database) to CSS hex values.
// Used in the designer's ColorPicker and on the product detail page.
export const COLOR_MAP: Record<string, string> = {
  Fehér: "#ffffff",
  Fekete: "#32373c",
  Sötétkék: "#1e3a5f",
  Piros: "#cf2e2e",
  Szürke: "#9ca3af",
  Kék: "#3b82f6",
  Zöld: "#16a34a",
  Sárga: "#facc15",
  // Mug colors
  Bordó: "#800020",
  Középkék: "#2563eb",
  Lila: "#7c3aed",
  Menta: "#6ee7b7",
  Napsárga: "#fbbf24",
  Narancs: "#f97316",
  Rózsaszín: "#f9a8d4",
  Sötétzöld: "#166534",
  Türkiz: "#06b6d4",
  "Világos zöld": "#86efac",
  Világoskék: "#93c5fd",
  Barna: "#92400e",
};

// Returns true when the hex color is perceptually dark (brightness < 128).
// Uses the W3C perceived brightness formula: (R×299 + G×587 + B×114) / 1000.
export function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
