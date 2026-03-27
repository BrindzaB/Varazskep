"use client";

import { useEffect, useRef } from "react";
import type { Canvas, FabricImage } from "fabric";
import { DEFAULT_SHIRT_COLOR } from "./DesignerLayout";

// Canvas dimensions (fixed — responsive scaling is a future concern)
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 600;

// T-shirt occupies 88% of the canvas in the tighter dimension
const MOCKUP_SCALE_FACTOR = 0.88;

// Fallback natural dimensions — match the SVG viewBox (300×350)
const MOCKUP_NATURAL_WIDTH = 300;
const MOCKUP_NATURAL_HEIGHT = 350;

// Center of the canvas
const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;

// Print area: positioned in the upper-chest of the scaled t-shirt
const PRINT_AREA = {
  width: 185,
  height: 210,
  centerX: CX,
  centerY: CY - 15,
};

// Darkens a CSS hex color by subtracting `amount` from each RGB channel.
// Used to derive the collar color from the body color.
function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Replaces the SVG fill colors and returns a data URL the browser can load.
// The SVG source uses fixed hex values for body (#9ca3af) and collar (#8b9299);
// we do a literal string replacement so the loaded image reflects the chosen color.
function buildColoredDataUrl(svgText: string, bodyColor: string): string {
  const collarColor = darkenHex(bodyColor, 18);
  const colored = svgText
    .replace(/#9ca3af/g, bodyColor)
    .replace(/#8b9299/g, collarColor);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colored)}`;
}

// Scales and centers a FabricImage on the canvas.
function applyMockupLayout(
  img: FabricImage,
  canvas: Canvas,
): void {
  const naturalWidth = img.width || MOCKUP_NATURAL_WIDTH;
  const naturalHeight = img.height || MOCKUP_NATURAL_HEIGHT;
  const scale = Math.min(
    (CANVAS_WIDTH * MOCKUP_SCALE_FACTOR) / naturalWidth,
    (CANVAS_HEIGHT * MOCKUP_SCALE_FACTOR) / naturalHeight,
  );
  img.set({
    selectable: false,
    evented: false,
    hoverCursor: "default",
    scaleX: scale,
    scaleY: scale,
  });
  canvas.add(img);
  canvas.centerObject(img);
  canvas.sendObjectToBack(img);
}

interface DesignerCanvasProps {
  shirtColor?: string;
}

export default function DesignerCanvas({
  shirtColor = DEFAULT_SHIRT_COLOR,
}: DesignerCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const shirtImageRef = useRef<FabricImage | null>(null);
  // Cached SVG source text — fetched once, reused on every color change
  const svgSourceRef = useRef<string | null>(null);
  // Prevents the color-update effect from running before the init is complete
  const isInitializedRef = useRef(false);

  // ── Init effect: runs once on mount ──────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || fabricRef.current) return;

    let isMounted = true;

    const init = async () => {
      const { Canvas, FabricImage, Rect } = await import("fabric");

      if (!isMounted || !canvasElRef.current) return;

      const canvas = new Canvas(canvasElRef.current, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      fabricRef.current = canvas;

      // Fetch and cache the SVG source so color changes never re-fetch
      const response = await fetch("/tshirt-mockup.svg");
      const svgText = await response.text();
      if (!isMounted) return;
      svgSourceRef.current = svgText;

      // Load the t-shirt with the initial shirt color
      const dataUrl = buildColoredDataUrl(svgText, shirtColor);
      const img = await FabricImage.fromURL(dataUrl);
      if (!isMounted) return;

      applyMockupLayout(img, canvas);
      shirtImageRef.current = img;

      // Dashed print area boundary — visual guide only, not interactive
      const printArea = new Rect({
        left: PRINT_AREA.centerX,
        top: PRINT_AREA.centerY,
        width: PRINT_AREA.width,
        height: PRINT_AREA.height,
        fill: "transparent",
        stroke: "#abb8c3",
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
        hoverCursor: "default",
        originX: "center",
        originY: "center",
      });
      canvas.add(printArea);

      canvas.renderAll();
      isInitializedRef.current = true;
    };

    init().catch(console.error);

    return () => {
      isMounted = false;
      fabricRef.current?.dispose();
      fabricRef.current = null;
      isInitializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Color update effect: runs whenever shirtColor changes ─────────────────
  useEffect(() => {
    // Skip until the canvas and SVG source are ready (init runs async)
    if (!isInitializedRef.current) return;
    const canvas = fabricRef.current;
    const svgText = svgSourceRef.current;
    if (!canvas || !svgText) return;

    let isMounted = true;

    const update = async () => {
      const { FabricImage } = await import("fabric"); // module-level cache, no re-fetch

      const dataUrl = buildColoredDataUrl(svgText, shirtColor);
      const newImg = await FabricImage.fromURL(dataUrl);
      if (!isMounted) return;

      // Remove old shirt, insert new colored one at the back
      if (shirtImageRef.current) {
        canvas.remove(shirtImageRef.current);
      }
      applyMockupLayout(newImg, canvas);
      shirtImageRef.current = newImg;
      canvas.renderAll();
    };

    update().catch(console.error);
    return () => {
      isMounted = false;
    };
  }, [shirtColor]);

  return (
    <div className="rounded border border-border-light bg-white shadow-card">
      <canvas ref={canvasElRef} />
    </div>
  );
}
