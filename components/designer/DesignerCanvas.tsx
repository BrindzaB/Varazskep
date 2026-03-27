"use client";

import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";

// Canvas dimensions (fixed — responsive scaling is a future concern)
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 600;

// T-shirt occupies 88% of the canvas in the tighter dimension
const MOCKUP_SCALE_FACTOR = 0.88;

// Fallback natural dimensions — match the SVG viewBox (300×350)
// Used only if the browser reports 0 for the loaded image (happens with dimensionless SVGs)
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

export default function DesignerCanvas() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);

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

      // Load the t-shirt mockup SVG as a non-interactive background layer
      const img = await FabricImage.fromURL("/tshirt-mockup.svg");

      if (!isMounted) return;

      // Use the actual loaded dimensions; fall back to viewBox values if the
      // browser reports 0 (can happen with dimensionless SVGs in some engines)
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
    };

    init().catch(console.error);

    return () => {
      isMounted = false;
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, []);

  return (
    <div className="rounded border border-border-light bg-white shadow-card">
      <canvas ref={canvasElRef} />
    </div>
  );
}
