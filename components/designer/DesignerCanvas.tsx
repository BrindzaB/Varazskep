"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Canvas, FabricImage, FabricObject } from "fabric";
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

// Clipart placed on the canvas is scaled to fit within the print area initially
const CLIPART_INITIAL_SIZE = 80;

// SVG paths for each side
const MOCKUP_SVG: Record<"front" | "back", string> = {
  front: "/tshirt-mockup.svg",
  back: "/tshirt-back-mockup.svg",
};

// Darkens a CSS hex color by subtracting `amount` from each RGB channel.
function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// Replaces the SVG fill colors and returns a data URL the browser can load.
function buildColoredDataUrl(svgText: string, bodyColor: string): string {
  const collarColor = darkenHex(bodyColor, 18);
  const colored = svgText
    .replace(/#9ca3af/g, bodyColor)
    .replace(/#8b9299/g, collarColor);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(colored)}`;
}

// Scales and centers a FabricImage on the canvas.
function applyMockupLayout(img: FabricImage, canvas: Canvas): void {
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

// Public API exposed to DesignerLayout via ref
export interface DesignerCanvasRef {
  addClipart: (svgUrl: string) => Promise<void>;
}

interface DesignerCanvasProps {
  shirtColor?: string;
  side?: "front" | "back";
}

const DesignerCanvas = forwardRef<DesignerCanvasRef, DesignerCanvasProps>(
  function DesignerCanvas({ shirtColor = DEFAULT_SHIRT_COLOR, side = "front" }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<Canvas | null>(null);
    const shirtImageRef = useRef<FabricImage | null>(null);
    const isInitializedRef = useRef(false);
    const keyDownHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

    // Cached SVG source text per side — fetched once, reused on color changes
    const svgSourceRef = useRef<Partial<Record<"front" | "back", string>>>({});

    // Tracks which side is currently rendered on the canvas
    const currentSideRef = useRef<"front" | "back">("front");

    // Stores live Fabric objects per side while that side is off-canvas.
    // Keeping live objects (not JSON) avoids a serialize/deserialize round-trip.
    const sideObjectsRef = useRef<Record<"front" | "back", FabricObject[]>>({
      front: [],
      back: [],
    });

    // Keeps the latest shirtColor accessible inside effects without adding it
    // to their dependency arrays (avoids re-running side-switch on color change).
    const shirtColorRef = useRef(shirtColor);
    useEffect(() => {
      shirtColorRef.current = shirtColor;
    }, [shirtColor]);

    // ── Expose addClipart to parent via ref ───────────────────────────────────
    useImperativeHandle(ref, () => ({
      async addClipart(svgUrl: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { FabricImage, Control } = await import("fabric");
        const img = await FabricImage.fromURL(svgUrl, { crossOrigin: "anonymous" });

        const longestSide = Math.max(img.width ?? 1, img.height ?? 1);
        const scale = CLIPART_INITIAL_SIZE / longestSide;

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: PRINT_AREA.centerX,
          top: PRINT_AREA.centerY,
          originX: "center",
          originY: "center",
        });

        // Delete control — rendered as a charcoal circle with a white × at the
        // top-right corner of the selected object.
        img.controls = {
          ...img.controls,
          deleteControl: new Control({
            x: 0.5,
            y: -0.5,
            cursorStyle: "pointer",
            sizeX: 24,
            sizeY: 24,
            mouseUpHandler: (_eventData, transform) => {
              const target = transform.target;
              const c = target.canvas;
              if (c) {
                c.remove(target);
                c.requestRenderAll();
              }
              return true;
            },
            render: (ctx, left, top) => {
              const radius = 11;
              const arm = 4;
              ctx.save();
              ctx.translate(left, top);
              // Circle background
              ctx.beginPath();
              ctx.arc(0, 0, radius, 0, 2 * Math.PI);
              ctx.fillStyle = "#32373c";
              ctx.fill();
              // White ×
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(-arm, -arm);
              ctx.lineTo(arm, arm);
              ctx.moveTo(arm, -arm);
              ctx.lineTo(-arm, arm);
              ctx.stroke();
              ctx.restore();
            },
          }),
        };

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      },
    }));

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

        // Delete selected object on Delete/Backspace
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            const active = canvas.getActiveObject();
            if (active) {
              canvas.remove(active);
              canvas.discardActiveObject();
              canvas.renderAll();
            }
          }
        };
        window.addEventListener("keydown", handleKeyDown);
        keyDownHandlerRef.current = handleKeyDown;

        // Constrain user-placed objects to stay within the print area
        const printLeft   = PRINT_AREA.centerX - PRINT_AREA.width  / 2;
        const printTop    = PRINT_AREA.centerY - PRINT_AREA.height / 2;
        const printRight  = PRINT_AREA.centerX + PRINT_AREA.width  / 2;
        const printBottom = PRINT_AREA.centerY + PRINT_AREA.height / 2;

        canvas.on("object:moving", (e) => {
          const obj = e.target;
          if (!obj) return;

          const center = obj.getCenterPoint();
          const halfW = obj.getScaledWidth() / 2;
          const halfH = obj.getScaledHeight() / 2;

          const clampedX = Math.min(Math.max(center.x, printLeft + halfW), printRight - halfW);
          const clampedY = Math.min(Math.max(center.y, printTop + halfH), printBottom - halfH);

          const dx = clampedX - center.x;
          const dy = clampedY - center.y;

          if (dx !== 0 || dy !== 0) {
            obj.set({ left: obj.left + dx, top: obj.top + dy });
            obj.setCoords();
          }
        });

        // Fetch and cache the front SVG
        const response = await fetch(MOCKUP_SVG.front);
        const svgText = await response.text();
        if (!isMounted) return;
        svgSourceRef.current.front = svgText;

        const dataUrl = buildColoredDataUrl(svgText, shirtColorRef.current);
        const img = await FabricImage.fromURL(dataUrl);
        if (!isMounted) return;

        applyMockupLayout(img, canvas);
        shirtImageRef.current = img;

        // Dashed print area boundary — visual guide, not interactive
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
        currentSideRef.current = "front";
        isInitializedRef.current = true;
      };

      init().catch(console.error);

      return () => {
        isMounted = false;
        if (keyDownHandlerRef.current) {
          window.removeEventListener("keydown", keyDownHandlerRef.current);
          keyDownHandlerRef.current = null;
        }
        fabricRef.current?.dispose();
        fabricRef.current = null;
        isInitializedRef.current = false;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Side switch effect: runs when `side` prop changes ────────────────────
    useEffect(() => {
      if (!isInitializedRef.current) return;
      const canvas = fabricRef.current;
      if (!canvas) return;

      const previousSide = currentSideRef.current;
      if (previousSide === side) return;

      let isMounted = true;

      const doSwitch = async () => {
        const { FabricImage } = await import("fabric");

        // Save the live Fabric objects currently on canvas for the outgoing side
        const userObjects = canvas.getObjects().filter((o) => o.selectable !== false);
        sideObjectsRef.current[previousSide] = userObjects;
        userObjects.forEach((o) => canvas.remove(o));

        // Fetch and cache the new side's SVG if not already loaded
        if (!svgSourceRef.current[side]) {
          const res = await fetch(MOCKUP_SVG[side]);
          svgSourceRef.current[side] = await res.text();
        }
        if (!isMounted) return;

        const svgText = svgSourceRef.current[side]!;
        const dataUrl = buildColoredDataUrl(svgText, shirtColorRef.current);
        const newImg = await FabricImage.fromURL(dataUrl);
        if (!isMounted) return;

        if (shirtImageRef.current) canvas.remove(shirtImageRef.current);
        applyMockupLayout(newImg, canvas);
        shirtImageRef.current = newImg;

        // Restore saved objects for the incoming side
        sideObjectsRef.current[side].forEach((o) => canvas.add(o));

        currentSideRef.current = side;
        canvas.renderAll();
      };

      doSwitch().catch(console.error);
      return () => {
        isMounted = false;
      };
    }, [side]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Color update effect: runs whenever shirtColor changes ─────────────────
    useEffect(() => {
      if (!isInitializedRef.current) return;
      const canvas = fabricRef.current;
      const svgText = svgSourceRef.current[currentSideRef.current];
      if (!canvas || !svgText) return;

      let isMounted = true;

      const update = async () => {
        const { FabricImage } = await import("fabric");
        const dataUrl = buildColoredDataUrl(svgText, shirtColor);
        const newImg = await FabricImage.fromURL(dataUrl);
        if (!isMounted) return;
        if (shirtImageRef.current) canvas.remove(shirtImageRef.current);
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
  },
);

export default DesignerCanvas;
