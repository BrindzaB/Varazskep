"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Canvas, FabricImage, FabricObject, IText } from "fabric";
import { DEFAULT_TEXT_FONT, DEFAULT_TEXT_COLOR } from "./TextOptionsBar";
import type { PrintArea } from "@/lib/designer/mockupConfig";

// Canvas dimensions (fixed — responsive scaling is a future concern)
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 600;

// Mockup occupies 88% of the canvas in the tighter dimension
const MOCKUP_SCALE_FACTOR = 0.88;

// Fallback natural dimensions used if Fabric can't read the image dimensions
const MOCKUP_NATURAL_WIDTH = 300;
const MOCKUP_NATURAL_HEIGHT = 350;

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
  addText: () => Promise<void>;
  setTextFont: (font: string) => void;
  setTextColor: (color: string) => void;
  // Returns serialized user objects (no mockup layer) for both sides
  getCanvasJson: () => { front: object[]; back: object[] };
}

interface DesignerCanvasProps {
  // Pre-computed background image URL — can be a data URL (local SVG) or a remote URL (Malfini photo).
  // Computed by the parent (DesignerLayout). When this changes, the background is swapped in place.
  imageUrl: string;
  side?: "front" | "back";
  // Print area config — drives object constraints and the dashed boundary rect.
  // Comes from mockupConfig (local) or categoryConfig (Malfini).
  printArea: PrintArea;
  // Called when text selection changes — isText=true means an IText is selected
  onActiveTextChange?: (isText: boolean, font: string, color: string) => void;
}

const DesignerCanvas = forwardRef<DesignerCanvasRef, DesignerCanvasProps>(
  function DesignerCanvas(
    { imageUrl, side = "front", printArea, onActiveTextChange },
    ref,
  ) {
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<Canvas | null>(null);
    const shirtImageRef = useRef<FabricImage | null>(null);
    const isInitializedRef = useRef(false);
    const keyDownHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

    // Tracks which side is currently rendered on the canvas
    const currentSideRef = useRef<"front" | "back">("front");

    // Stores live Fabric objects per side while that side is off-canvas
    const sideObjectsRef = useRef<Record<"front" | "back", FabricObject[]>>({
      front: [],
      back: [],
    });

    // Signals that canvas mechanics are ready — triggers the image loading effect.
    const [isReady, setIsReady] = useState(false);

    const onActiveTextChangeRef = useRef(onActiveTextChange);
    useEffect(() => { onActiveTextChangeRef.current = onActiveTextChange; }, [onActiveTextChange]);

    // ── Expose canvas API to DesignerLayout ───────────────────────────────────
    useImperativeHandle(ref, () => ({
      async addClipart(svgUrl: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { FabricImage, Control } = await import("fabric");
        const img = await FabricImage.fromURL(svgUrl, { crossOrigin: "anonymous" });

        const CLIPART_INITIAL_SIZE = 80;
        const longestSide = Math.max(img.width ?? 1, img.height ?? 1);
        const scale = CLIPART_INITIAL_SIZE / longestSide;

        img.set({
          scaleX: scale,
          scaleY: scale,
          left: printArea.centerX,
          top: printArea.centerY,
          originX: "center",
          originY: "center",
        });

        img.controls = {
          ...img.controls,
          deleteControl: buildDeleteControl(Control),
        };

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      },

      async addText() {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { IText, Control } = await import("fabric");

        const text = new IText("Szöveg", {
          left: printArea.centerX,
          top: printArea.centerY,
          originX: "center",
          originY: "center",
          fontSize: 36,
          fontFamily: DEFAULT_TEXT_FONT,
          fill: DEFAULT_TEXT_COLOR,
          textAlign: "center",
        });

        text.controls = {
          ...text.controls,
          deleteControl: buildDeleteControl(Control),
        };

        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        canvas.requestRenderAll();
      },

      setTextFont(font: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject() as IText | null;
        if (!active || active.type !== "i-text") return;
        active.set({ fontFamily: font });
        canvas.requestRenderAll();
      },

      setTextColor(color: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObject() as IText | null;
        if (!active || active.type !== "i-text") return;
        active.set({ fill: color });
        canvas.requestRenderAll();
      },

      getCanvasJson() {
        const canvas = fabricRef.current;
        if (!canvas) return { front: [], back: [] };

        const currentSide = currentSideRef.current;
        const otherSide: "front" | "back" = currentSide === "front" ? "back" : "front";

        const currentObjects = canvas
          .getObjects()
          .filter((o) => o.selectable !== false)
          .map((o) => o.toObject());

        const otherObjects = sideObjectsRef.current[otherSide].map((o) =>
          o.toObject(),
        );

        return {
          [currentSide]: currentObjects,
          [otherSide]: otherObjects,
        } as { front: object[]; back: object[] };
      },
    }));

    // ── Init effect: sets up canvas mechanics only — no image loading ─────────
    // Image loading is handled by the effect below, triggered once isReady is true.
    useEffect(() => {
      if (!canvasElRef.current || fabricRef.current) return;

      let isMounted = true;

      const init = async () => {
        const { Canvas, IText, Rect } = await import("fabric");

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
          const active = canvas.getActiveObject();
          if (active instanceof IText && active.isEditing) return;

          if (e.key === "Delete" || e.key === "Backspace") {
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
        const printLeft   = printArea.centerX - printArea.width  / 2;
        const printTop    = printArea.centerY - printArea.height / 2;
        const printRight  = printArea.centerX + printArea.width  / 2;
        const printBottom = printArea.centerY + printArea.height / 2;

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

        const lastGoodState = new WeakMap<FabricObject, {
          scaleX: number; scaleY: number; left: number; top: number;
        }>();

        canvas.on("object:added", (e) => {
          const obj = e.target;
          if (!obj || obj.selectable === false) return;
          lastGoodState.set(obj, {
            scaleX: obj.scaleX ?? 1,
            scaleY: obj.scaleY ?? 1,
            left: obj.left ?? 0,
            top: obj.top ?? 0,
          });
        });

        canvas.on("object:scaling", (e) => {
          const obj = e.target;
          if (!obj) return;

          obj.setCoords();
          const br = obj.getBoundingRect();

          if (
            br.left < printLeft ||
            br.top < printTop ||
            br.left + br.width > printRight ||
            br.top + br.height > printBottom
          ) {
            const good = lastGoodState.get(obj);
            if (good) {
              obj.set({
                scaleX: good.scaleX,
                scaleY: good.scaleY,
                left: good.left,
                top: good.top,
              });
              obj.setCoords();
            }
          } else {
            lastGoodState.set(obj, {
              scaleX: obj.scaleX ?? 1,
              scaleY: obj.scaleY ?? 1,
              left: obj.left ?? 0,
              top: obj.top ?? 0,
            });
          }
        });

        const notifyTextSelection = (selected: FabricObject | undefined) => {
          if (selected instanceof IText) {
            const font = typeof selected.fontFamily === "string"
              ? selected.fontFamily
              : DEFAULT_TEXT_FONT;
            const color = typeof selected.fill === "string"
              ? selected.fill
              : DEFAULT_TEXT_COLOR;
            onActiveTextChangeRef.current?.(true, font, color);
          } else {
            onActiveTextChangeRef.current?.(false, "", "");
          }
        };

        canvas.on("selection:created", (e) => notifyTextSelection(e.selected?.[0]));
        canvas.on("selection:updated", (e) => notifyTextSelection(e.selected?.[0]));
        canvas.on("selection:cleared", () => onActiveTextChangeRef.current?.(false, "", ""));

        // Dashed print area boundary — visual guide only, not interactive
        const printAreaRect = new Rect({
          left: printArea.centerX,
          top: printArea.centerY,
          width: printArea.width,
          height: printArea.height,
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
        canvas.add(printAreaRect);
        canvas.renderAll();

        currentSideRef.current = "front";
        isInitializedRef.current = true;
        if (isMounted) setIsReady(true);
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

    // ── Background image + side switch effect ────────────────────────────────
    // Runs when the canvas is ready, when imageUrl changes (color or Malfini variant),
    // or when side changes. A single effect handles both cases:
    //   - side changed: save current objects, restore incoming side's objects, load new image
    //   - only imageUrl changed: swap background in place, objects stay
    useEffect(() => {
      if (!isReady || !imageUrl) return;
      const canvas = fabricRef.current;
      if (!canvas) return;

      const previousSide = currentSideRef.current;
      const sideChanged = previousSide !== side;

      let cancelled = false;

      const update = async () => {
        const { FabricImage } = await import("fabric");

        if (sideChanged) {
          // Stash current side's user objects off-canvas
          const userObjects = canvas.getObjects().filter((o) => o.selectable !== false);
          sideObjectsRef.current[previousSide] = userObjects;
          userObjects.forEach((o) => canvas.remove(o));
        }

        const newImg = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });
        if (cancelled) return;

        if (shirtImageRef.current) canvas.remove(shirtImageRef.current);
        applyMockupLayout(newImg, canvas);
        shirtImageRef.current = newImg;

        if (sideChanged) {
          // Restore the incoming side's objects
          sideObjectsRef.current[side].forEach((o) => canvas.add(o));
          currentSideRef.current = side;
        }

        canvas.renderAll();
      };

      update().catch(console.error);
      return () => { cancelled = true; };
    }, [isReady, imageUrl, side]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="rounded border border-border-light bg-white shadow-card">
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);

export default DesignerCanvas;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Builds a delete control (charcoal circle with white ×) for any Fabric object.
function buildDeleteControl(Control: typeof import("fabric").Control) {
  return new Control({
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
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#32373c";
      ctx.fill();
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
  });
}
