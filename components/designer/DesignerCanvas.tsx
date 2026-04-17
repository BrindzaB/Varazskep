"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Canvas, FabricImage, FabricObject, IText } from "fabric";
import { DEFAULT_TEXT_FONT, DEFAULT_TEXT_COLOR } from "./TextOptionsBar";
import type { PrintArea } from "@/lib/designer/mockupConfig";

// Canvas dimensions — exported so DesignerLayout can compute the CSS scale factor.
export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 600;

// Physical print area dimensions (cm) — used for coordinate display and print fee calculation.
// The full printable area on a standard adult t-shirt is 38×48 cm.
const PRINT_AREA_CM_WIDTH  = 38;
const PRINT_AREA_CM_HEIGHT = 48;

// A4 dimension thresholds for print fee tier.
// An object is "large" if it exceeds A4 in either dimension (width > 21 cm OR height > 29.7 cm).
// Area-only comparison fails for text, which is wide but short and never reaches A4 area.
const A4_WIDTH_CM     = 21;
const A4_HEIGHT_CM    = 29.7;
const PRINT_FEE_SMALL = 3000; // Ft per object when both dimensions ≤ A4
const PRINT_FEE_LARGE = 3500; // Ft per object when either dimension exceeds A4

// Mockup occupies 95% of the canvas in the tighter dimension
const MOCKUP_SCALE_FACTOR = 0.95;

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
  addImage: (url: string) => Promise<void>;
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
  // Called whenever the total print fee changes (sum of per-object fees across both sides)
  onPrintFeeChange?: (fee: number) => void;
}

const DesignerCanvas = forwardRef<DesignerCanvasRef, DesignerCanvasProps>(
  function DesignerCanvas(
    { imageUrl, side = "front", printArea, onActiveTextChange, onPrintFeeChange },
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

    // Red center guide line — shown while an object is snapped to horizontal center
    const [showCenterGuide, setShowCenterGuide] = useState(false);

    // Floating coordinate overlay state — shown above the selected object
    const [coordOverlay, setCoordOverlay] = useState<{
      xCm: number;
      yCm: number;
      left: number;
      top: number;
    } | null>(null);

    const onActiveTextChangeRef = useRef(onActiveTextChange);
    useEffect(() => { onActiveTextChangeRef.current = onActiveTextChange; }, [onActiveTextChange]);

    const onPrintFeeChangeRef = useRef(onPrintFeeChange);
    useEffect(() => { onPrintFeeChangeRef.current = onPrintFeeChange; }, [onPrintFeeChange]);

    // Stable ref to the recalc function — set once the canvas is initialised.
    const recalcPrintFeeRef = useRef<(() => void) | null>(null);

    // Computes X/Y position (in cm from print area top-left) and DOM position for the overlay.
    const computeCoordOverlay = useCallback((obj: FabricObject) => {
      obj.setCoords();
      const br = obj.getBoundingRect();
      const printLeft = printArea.centerX - printArea.width  / 2;
      const printTop  = printArea.centerY - printArea.height / 2;
      return {
        xCm:  Math.max(0, (br.left - printLeft) * (PRINT_AREA_CM_WIDTH  / printArea.width)),
        yCm:  Math.max(0, (br.top  - printTop)  * (PRINT_AREA_CM_HEIGHT / printArea.height)),
        left: br.left + br.width / 2,
        top:  br.top,
      };
    }, [printArea]);

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

      async addImage(url: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { FabricImage, Control } = await import("fabric");
        const img = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });

        const IMAGE_INITIAL_MAX_SIZE = 200;
        const longestSide = Math.max(img.width ?? 1, img.height ?? 1);
        const scale = Math.min(1, IMAGE_INITIAL_MAX_SIZE / longestSide);

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

        const printLeft = printArea.centerX - printArea.width  / 2;
        const printTop  = printArea.centerY - printArea.height / 2;

        const withCoords = (obj: FabricObject): object => {
          obj.setCoords();
          const br = obj.getBoundingRect();
          return {
            ...obj.toObject(),
            _xCm: Math.max(0, (br.left - printLeft) * (PRINT_AREA_CM_WIDTH  / printArea.width)),
            _yCm: Math.max(0, (br.top  - printTop)  * (PRINT_AREA_CM_HEIGHT / printArea.height)),
            _wCm: obj.getScaledWidth()  * (PRINT_AREA_CM_WIDTH  / printArea.width),
            _hCm: obj.getScaledHeight() * (PRINT_AREA_CM_HEIGHT / printArea.height),
          };
        };

        const currentObjects = canvas
          .getObjects()
          .filter((o) => o.selectable !== false)
          .map(withCoords);

        const otherObjects = sideObjectsRef.current[otherSide].map(withCoords);

        return {
          [currentSide]: currentObjects,
          [otherSide]: otherObjects,
          // Print area pixel boundaries — used by the SVG exporter to crop to the
          // printable zone instead of the full canvas.
          printAreaPx: {
            left:   printLeft,
            top:    printTop,
            width:  printArea.width,
            height: printArea.height,
          },
        } as unknown as { front: object[]; back: object[] };
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

        // How close (px) the object center must be to snap to the print area center
        const SNAP_THRESHOLD = 8;

        canvas.on("object:moving", (e) => {
          const obj = e.target;
          if (!obj) return;

          let center = obj.getCenterPoint();
          const halfW = obj.getScaledWidth() / 2;
          const halfH = obj.getScaledHeight() / 2;

          // Snap to horizontal center of the print area
          const nearCenter = Math.abs(center.x - printArea.centerX) < SNAP_THRESHOLD;
          if (nearCenter) {
            obj.set({ left: printArea.centerX });
            obj.setCoords();
            center = obj.getCenterPoint();
          }
          setShowCenterGuide(nearCenter);

          const clampedX = Math.min(Math.max(center.x, printLeft + halfW), printRight - halfW);
          const clampedY = Math.min(Math.max(center.y, printTop + halfH), printBottom - halfH);

          const dx = clampedX - center.x;
          const dy = clampedY - center.y;

          if (dx !== 0 || dy !== 0) {
            obj.set({ left: obj.left + dx, top: obj.top + dy });
            obj.setCoords();
          }
        });

        canvas.on("object:modified", () => setShowCenterGuide(false));

        // Recalculates total print fee across all objects on both sides and fires callback.
        const recalcPrintFee = () => {
          const c = fabricRef.current;
          if (!c) return;
          const currentObjs = c.getObjects().filter((o) => o.selectable !== false);
          const otherSide = currentSideRef.current === "front" ? "back" : "front";
          const otherObjs = sideObjectsRef.current[otherSide];
          const total = [...currentObjs, ...otherObjs].reduce((sum, obj) => {
            const wCm = obj.getScaledWidth()  * (PRINT_AREA_CM_WIDTH  / printArea.width);
            const hCm = obj.getScaledHeight() * (PRINT_AREA_CM_HEIGHT / printArea.height);
            const isLarge = wCm > A4_WIDTH_CM || hCm > A4_HEIGHT_CM;
            return sum + (isLarge ? PRINT_FEE_LARGE : PRINT_FEE_SMALL);
          }, 0);
          onPrintFeeChangeRef.current?.(total);
        };
        recalcPrintFeeRef.current = recalcPrintFee;

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
          recalcPrintFee();
        });

        canvas.on("object:removed", (e) => {
          if (e.target && e.target.selectable !== false) recalcPrintFee();
        });

        canvas.on("object:modified", (e) => {
          if (e.target && e.target.selectable !== false) recalcPrintFee();
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

        canvas.on("selection:created", (e) => {
          notifyTextSelection(e.selected?.[0]);
          const obj = e.selected?.[0];
          if (obj && obj.selectable !== false) setCoordOverlay(computeCoordOverlay(obj));
        });
        canvas.on("selection:updated", (e) => {
          notifyTextSelection(e.selected?.[0]);
          const obj = e.selected?.[0];
          if (obj && obj.selectable !== false) setCoordOverlay(computeCoordOverlay(obj));
          else setCoordOverlay(null);
        });
        canvas.on("selection:cleared", () => {
          onActiveTextChangeRef.current?.(false, "", "");
          setCoordOverlay(null);
          setShowCenterGuide(false);
        });
        canvas.on("object:moving", (e) => {
          if (e.target && e.target.selectable !== false) setCoordOverlay(computeCoordOverlay(e.target));
        });
        canvas.on("object:scaling", (e) => {
          if (e.target && e.target.selectable !== false) setCoordOverlay(computeCoordOverlay(e.target));
        });

        // Dashed print area boundary — visual guide, not interactive
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

        // No crossOrigin — we never call canvas.toDataURL() so the canvas taint
        // doesn't matter. Setting crossOrigin on Malfini URLs would cause the browser
        // to block images whose CDN responses lack Access-Control-Allow-Origin headers.
        const newImg = await FabricImage.fromURL(imageUrl);
        if (cancelled) return;

        if (shirtImageRef.current) canvas.remove(shirtImageRef.current);
        applyMockupLayout(newImg, canvas);
        shirtImageRef.current = newImg;

        if (sideChanged) {
          // Restore the incoming side's objects
          sideObjectsRef.current[side].forEach((o) => canvas.add(o));
          currentSideRef.current = side;
          // Update print fee after side switch (objects changed)
          recalcPrintFeeRef.current?.();
        }

        canvas.renderAll();
      };

      update().catch(console.error);
      return () => { cancelled = true; };
    }, [isReady, imageUrl, side]); // eslint-disable-line react-hooks/exhaustive-deps

    const printTop  = printArea.centerY - printArea.height / 2;

    return (
      <div className="relative bg-white">
        <canvas ref={canvasElRef} />
        {showCenterGuide && (
          <div
            className="pointer-events-none absolute"
            style={{
              left: printArea.centerX - 0.5,
              top: printTop,
              width: 1,
              height: printArea.height,
              backgroundColor: "#ef4444",
            }}
          />
        )}
        {coordOverlay && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded bg-charcoal/80 px-2 py-0.5 text-xs text-white"
            style={{ left: coordOverlay.left, top: coordOverlay.top - 28 }}
          >
            X:{coordOverlay.xCm.toFixed(2)}&nbsp;cm&nbsp;&nbsp;Y:{coordOverlay.yCm.toFixed(2)}&nbsp;cm
          </div>
        )}
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
