// SVG color-replacement utilities for the local product mockup system.
// Extracted from DesignerCanvas.tsx in Phase 6 so DesignerLayout can compute
// the colored data URL before passing it down to DesignerCanvas.

// Darkens a CSS hex color by subtracting `amount` from each RGB channel.
export function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Returns true if the hex color is near-white (avg channel > 240).
export function isNearWhite(hex: string): boolean {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return (r + g + b) / 3 > 240;
}

// Replaces the SVG fill colors and returns a data URL the browser can load.
// Three placeholder grays map to proportional shades of the selected body color:
//   #9ca3af — base body color
//   #8b9299 — medium shadow (~18 darker, same as body for near-white colors)
//   #737c85 — deep shadow (~36 darker)
export function buildColoredDataUrl(svgText: string, bodyColor: string): string {
  const mediumShadow = isNearWhite(bodyColor) ? bodyColor : darkenHex(bodyColor, 18);
  const colored = svgText
    .replace(/#9ca3af/g, bodyColor)
    .replace(/#8b9299/g, mediumShadow)
    .replace(/#737c85/g, darkenHex(bodyColor, 36));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colored)}`;
}
