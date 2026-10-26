"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Canvas, FabricImage, FabricObject, IText } from "fabric";
import { DEFAULT_TEXT_FONT, DEFAULT_TEXT_COLOR } from "./TextOptionsBar";
import type { PrintArea, PrintSizeCm } from "@/lib/designer/mockupConfig";
import {
  feeForTier,
  printTierOf,
  scaleToFitA3,
  type PrintFees,
} from "@/lib/pricing/printFee";

// Canvas dimensions — exported so DesignerLayout can compute the CSS scale factor.
export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 600;

// The print tiers (10×10 cm / A4 / A3), the A3 cap and the per-object fees live in
// lib/pricing/printFee.ts, shared with the server. The fee computed here is display-only —
// the checkout recomputes it from the stored design geometry, so both sides must use the
// same rule and the same admin-configured fees.

// Mockup occupies 95% of the canvas in the tighter dimension
const MOCKUP_SCALE_FACTOR = 0.95;

// Fallback natural dimensions used if Fabric can't read the image dimensions
const MOCKUP_NATURAL_WIDTH = 300;
const MOCKUP_NATURAL_HEIGHT = 350;

interface ClipartFabricImage extends FabricImage {
  _clipartLight: string;
  _clipartDark: string | null;
}

// Scales and centers a FabricImage on the canvas.
function applyMockupLayout(
  img: FabricImage,
  canvas: Canvas,
  canvasWidth: number,
  canvasHeight: number
): void {
  const naturalWidth = img.width || MOCKUP_NATURAL_WIDTH;
  const naturalHeight = img.height || MOCKUP_NATURAL_HEIGHT;
  const scale = Math.min(
    (canvasWidth * MOCKUP_SCALE_FACTOR) / naturalWidth,
    (canvasHeight * MOCKUP_SCALE_FACTOR) / naturalHeight
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
  addClipart: (
    url: string,
    lightUrl: string,
    darkUrl: string | null
  ) => Promise<void>;
  swapClipartVariants: (useDark: boolean) => Promise<void>;
  addImage: (url: string) => Promise<void>;
  addText: () => Promise<void>;
  setTextFont: (font: string) => void;
  setTextColor: (color: string) => void;
  // Returns serialized user objects (no mockup layer) for both sides
  getCanvasJson: () => { front: object[]; back: object[] };
  // PNG data URL of the current canvas (mockup + design) for the order preview.
  // Returns null if the canvas is tainted (e.g. a cross-origin mockup) or absent.
  getPreviewDataUrl: () => string | null;
}

interface DesignerCanvasProps {
  // Pre-computed background image URL — can be a data URL (local SVG) or a remote URL (Malfini photo).
  // Computed by the parent (DesignerLayout). When this changes, the background is swapped in place.
  imageUrl: string;
  side?: "front" | "back";
  // Print area config — drives object constraints and the dashed boundary rect.
  // Comes from mockupConfig (local) or categoryConfig (Malfini).
  printArea: PrintArea;
  // Real print area size (cm) — converts the on-canvas pixel design to cm for the saved
  // production coordinates, the print-fee tier and the A3 size cap.
  printAreaCm: PrintSizeCm;
  // Per-object print fees from the admin pricing settings (lib/pricing/settings.ts).
  // Display only — the authoritative charge is recomputed server-side at checkout.
  printFees: PrintFees;
  // Called when text selection changes — isText=true means an IText is selected
  onActiveTextChange?: (isText: boolean, font: string, color: string) => void;
  // Called whenever the total print fee changes (sum of per-object fees across both sides)
  onPrintFeeChange?: (fee: number) => void;
  // Called when the presence of dark-variant-capable cliparts on canvas changes
  onDarkClipartChange?: (hasDark: boolean) => void;
  // Override canvas height for landscape products (e.g. mugs). Defaults to CANVAS_HEIGHT.
  canvasHeight?: number;
}

const DesignerCanvas = forwardRef<DesignerCanvasRef, DesignerCanvasProps>(
  function DesignerCanvas(
    {
      imageUrl,
      side = "front",
      printArea,
      printAreaCm,
      printFees,
      onActiveTextChange,
      onPrintFeeChange,
      onDarkClipartChange,
      canvasHeight,
    },
    ref
  ) {
    const actualCanvasHeight = canvasHeight ?? CANVAS_HEIGHT;
    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<Canvas | null>(null);
    const shirtImageRef = useRef<FabricImage | null>(null);
    const printAreaRectRef = useRef<FabricObject | null>(null);
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

    const onActiveTextChangeRef = useRef(onActiveTextChange);
    useEffect(() => {
      onActiveTextChangeRef.current = onActiveTextChange;
    }, [onActiveTextChange]);

    const onPrintFeeChangeRef = useRef(onPrintFeeChange);
    useEffect(() => {
      onPrintFeeChangeRef.current = onPrintFeeChange;
    }, [onPrintFeeChange]);

    const onDarkClipartChangeRef = useRef(onDarkClipartChange);
    useEffect(() => {
      onDarkClipartChangeRef.current = onDarkClipartChange;
    }, [onDarkClipartChange]);

    // Stable ref to the recalc function — set once the canvas is initialised.
    const recalcPrintFeeRef = useRef<(() => void) | null>(null);

    // Read through a ref: the fee recalc closure is created once at canvas init, so it
    // must not capture the fees by value. Recalculate when the fees change.
    const printFeesRef = useRef(printFees);
    useEffect(() => {
      printFeesRef.current = printFees;
      recalcPrintFeeRef.current?.();
    }, [printFees]);

    // The customer's design objects: everything except the mockup and the dashed print
    // area guide. Not `selectable !== false` — Fabric clears `selectable` on a text object
    // while it is being edited, which would drop that text from the fee and the design.
    const isDesignObject = (o: FabricObject) =>
      o !== shirtImageRef.current && o !== printAreaRectRef.current;

    // Real-world size of an object in cm — the basis of the print tier and the A3 cap.
    const sizeCmOf = (obj: FabricObject) => ({
      wCm: obj.getScaledWidth() * (printAreaCm.width / printArea.width),
      hCm: obj.getScaledHeight() * (printAreaCm.height / printArea.height),
    });

    // Shrinks an object (uniformly, about its centre) so it fits on A3. No-op if it fits.
    const capToA3 = (obj: FabricObject) => {
      const factor = scaleToFitA3(sizeCmOf(obj));
      if (factor >= 1) return;
      const center = obj.getCenterPoint();
      obj.set({
        scaleX: (obj.scaleX ?? 1) * factor,
        scaleY: (obj.scaleY ?? 1) * factor,
      });
      obj.setPositionByOrigin(center, "center", "center");
      obj.setCoords();
    };

    // Brings an object that grew without a drag — a new upload, or text being typed —
    // back within the limits a drag enforces: at most A3, and inside the print area.
    const fitIntoPrintArea = (obj: FabricObject) => {
      capToA3(obj);

      obj.setCoords();
      const br = obj.getBoundingRect();
      const factor = Math.min(
        1,
        printArea.width / br.width,
        printArea.height / br.height
      );
      const center = obj.getCenterPoint();
      if (factor < 1) {
        obj.set({
          scaleX: (obj.scaleX ?? 1) * factor,
          scaleY: (obj.scaleY ?? 1) * factor,
        });
      }

      // Re-centre within the print area if the object now overhangs an edge.
      obj.setPositionByOrigin(center, "center", "center");
      obj.setCoords();
      const fitted = obj.getBoundingRect();
      const halfW = fitted.width / 2;
      const halfH = fitted.height / 2;
      const left = printArea.centerX - printArea.width / 2;
      const top = printArea.centerY - printArea.height / 2;
      const clampedX = Math.min(
        Math.max(center.x, left + halfW),
        left + printArea.width - halfW
      );
      const clampedY = Math.min(
        Math.max(center.y, top + halfH),
        top + printArea.height - halfH
      );
      const dx = clampedX - center.x;
      const dy = clampedY - center.y;
      if (dx !== 0 || dy !== 0) {
        obj.set({ left: obj.left + dx, top: obj.top + dy });
        obj.setCoords();
      }
    };

    // ── Expose canvas API to DesignerLayout ───────────────────────────────────
    useImperativeHandle(ref, () => ({
      async addClipart(url: string, lightUrl: string, darkUrl: string | null) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { FabricImage, Control } = await import("fabric");
        const img = await FabricImage.fromURL(url, {
          crossOrigin: "anonymous",
        });

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
        // Store both variants so swapClipartVariants can replace the image later
        (img as ClipartFabricImage)._clipartLight = lightUrl;
        (img as ClipartFabricImage)._clipartDark = darkUrl;

        img.controls = buildObjectControls(img.controls, Control);

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      },

      async swapClipartVariants(useDark: boolean) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const { FabricImage, Control } = await import("fabric");

        const replaceObj = async (obj: FabricObject, onCanvas: boolean) => {
          const light = (obj as ClipartFabricImage)._clipartLight as string;
          const dark = (obj as ClipartFabricImage)._clipartDark as
            | string
            | null;
          if (!dark) return obj;
          const targetUrl = useDark ? dark : light;
          const newImg = await FabricImage.fromURL(targetUrl, {
            crossOrigin: "anonymous",
          });
          newImg.set({
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: (obj as FabricObject & { angle?: number }).angle ?? 0,
            originX: obj.originX,
            originY: obj.originY,
          });
          (newImg as ClipartFabricImage)._clipartLight = light;
          (newImg as ClipartFabricImage)._clipartDark = dark;
          newImg.controls = buildObjectControls(obj.controls, Control);
          if (onCanvas) {
            canvas.remove(obj);
            canvas.add(newImg);
          }
          return newImg;
        };

        // Swap objects currently on the canvas
        const canvasCliparts = canvas
          .getObjects()
          .filter(
            (o) =>
              o.selectable !== false && (o as ClipartFabricImage)._clipartDark
          );
        for (const obj of [...canvasCliparts]) {
          await replaceObj(obj, true);
        }

        // Swap objects stored off-canvas (other side)
        const otherSide = currentSideRef.current === "front" ? "back" : "front";
        const newOther: FabricObject[] = [];
        for (const obj of sideObjectsRef.current[otherSide]) {
          if ((obj as ClipartFabricImage)._clipartDark) {
            newOther.push(await replaceObj(obj, false));
          } else {
            newOther.push(obj);
          }
        }
        sideObjectsRef.current[otherSide] = newOther;

        canvas.renderAll();
      },

      async addImage(url: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const { FabricImage, Control } = await import("fabric");
        const img = await FabricImage.fromURL(url, {
          crossOrigin: "anonymous",
        });

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

        img.controls = buildObjectControls(img.controls, Control);

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

        text.controls = buildObjectControls(text.controls, Control);

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
        const otherSide: "front" | "back" =
          currentSide === "front" ? "back" : "front";

        const printLeft = printArea.centerX - printArea.width / 2;
        const printTop = printArea.centerY - printArea.height / 2;

        const withCoords = (obj: FabricObject): object => {
          obj.setCoords();
          const br = obj.getBoundingRect();
          return {
            ...obj.toObject(),
            _xCm: Math.max(
              0,
              (br.left - printLeft) * (printAreaCm.width / printArea.width)
            ),
            _yCm: Math.max(
              0,
              (br.top - printTop) * (printAreaCm.height / printArea.height)
            ),
            _wCm: obj.getScaledWidth() * (printAreaCm.width / printArea.width),
            _hCm:
              obj.getScaledHeight() * (printAreaCm.height / printArea.height),
          };
        };

        const currentObjects = canvas
          .getObjects()
          .filter(isDesignObject)
          .map(withCoords);

        const otherObjects = sideObjectsRef.current[otherSide].map(withCoords);

        return {
          [currentSide]: currentObjects,
          [otherSide]: otherObjects,
          // Print area pixel boundaries — used by the SVG exporter to crop to the
          // printable zone instead of the full canvas.
          printAreaPx: {
            left: printLeft,
            top: printTop,
            width: printArea.width,
            height: printArea.height,
          },
        } as unknown as { front: object[]; back: object[] };
      },

      getPreviewDataUrl() {
        const canvas = fabricRef.current;
        if (!canvas) return null;
        const rect = printAreaRectRef.current;
        try {
          // Clean snapshot: drop any selection handles + hide the dashed guide.
          canvas.discardActiveObject();
          if (rect) rect.set({ visible: false });
          canvas.renderAll();
          return canvas.toDataURL({ format: "png", multiplier: 2 });
        } catch {
          // Tainted canvas (cross-origin mockup without CORS) — no preview.
          return null;
        } finally {
          if (rect) rect.set({ visible: true });
          canvas.renderAll();
        }
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
          height: actualCanvasHeight,
          backgroundColor: "#ffffff",
          preserveObjectStacking: true,
          // Corner handles always keep the aspect ratio; null disables the Shift key
          // that would otherwise switch to free (distorting) scaling.
          uniformScaling: true,
          uniScaleKey: null,
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
        const printLeft = printArea.centerX - printArea.width / 2;
        const printTop = printArea.centerY - printArea.height / 2;
        const printRight = printArea.centerX + printArea.width / 2;
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
          const nearCenter =
            Math.abs(center.x - printArea.centerX) < SNAP_THRESHOLD;
          if (nearCenter) {
            obj.set({ left: printArea.centerX });
            obj.setCoords();
            center = obj.getCenterPoint();
          }
          setShowCenterGuide(nearCenter);

          const clampedX = Math.min(
            Math.max(center.x, printLeft + halfW),
            printRight - halfW
          );
          const clampedY = Math.min(
            Math.max(center.y, printTop + halfH),
            printBottom - halfH
          );

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
          const currentObjs = c
            .getObjects()
            .filter(isDesignObject);
          const otherSide =
            currentSideRef.current === "front" ? "back" : "front";
          const otherObjs = sideObjectsRef.current[otherSide];
          const total = [...currentObjs, ...otherObjs].reduce((sum, obj) => {
            // Objects are capped at A3, so null (over A3) cannot occur; price it as A3
            // rather than drop it if it ever does.
            const tier = printTierOf(sizeCmOf(obj)) ?? "a3";
            return sum + feeForTier(tier, printFeesRef.current);
          }, 0);
          onPrintFeeChangeRef.current?.(total);
        };
        recalcPrintFeeRef.current = recalcPrintFee;

        const recalcDarkClipart = () => {
          const c = fabricRef.current;
          if (!c) return;
          const currentHas = c
            .getObjects()
            .some(
              (o) =>
                o.selectable !== false && (o as ClipartFabricImage)._clipartDark
            );
          const otherSide =
            currentSideRef.current === "front" ? "back" : "front";
          const otherHas = sideObjectsRef.current[otherSide].some(
            (o) => (o as ClipartFabricImage)._clipartDark
          );
          onDarkClipartChangeRef.current?.(currentHas || otherHas);
        };

        const lastGoodState = new WeakMap<
          FabricObject,
          {
            scaleX: number;
            scaleY: number;
            left: number;
            top: number;
          }
        >();

        canvas.on("object:added", (e) => {
          const obj = e.target;
          if (!obj || obj.selectable === false) return;
          // A large uploaded image can start out bigger than A3 or the print area.
          fitIntoPrintArea(obj);
          lastGoodState.set(obj, {
            scaleX: obj.scaleX ?? 1,
            scaleY: obj.scaleY ?? 1,
            left: obj.left ?? 0,
            top: obj.top ?? 0,
          });
          recalcPrintFee();
          recalcDarkClipart();
        });

        canvas.on("object:removed", (e) => {
          if (e.target && e.target.selectable !== false) {
            recalcPrintFee();
            recalcDarkClipart();
          }
        });

        canvas.on("object:modified", (e) => {
          if (e.target && e.target.selectable !== false) recalcPrintFee();
        });

        canvas.on("object:scaling", (e) => {
          const obj = e.target;
          if (!obj) return;

          // Nothing may be printed larger than A3: stop growing at that size.
          capToA3(obj);
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
            const font =
              typeof selected.fontFamily === "string"
                ? selected.fontFamily
                : DEFAULT_TEXT_FONT;
            const color =
              typeof selected.fill === "string"
                ? selected.fill
                : DEFAULT_TEXT_COLOR;
            onActiveTextChangeRef.current?.(true, font, color);
          } else {
            onActiveTextChangeRef.current?.(false, "", "");
          }
        };

        canvas.on("selection:created", (e) => {
          notifyTextSelection(e.selected?.[0]);
        });
        canvas.on("selection:updated", (e) => {
          notifyTextSelection(e.selected?.[0]);
        });
        canvas.on("selection:cleared", () => {
          onActiveTextChangeRef.current?.(false, "", "");
          setShowCenterGuide(false);
        });

        // Typing makes a text object wider without any scaling — keep it within A3 and
        // the print area too, shrinking the text as the line grows.
        canvas.on("text:changed", (e) => {
          const obj = e.target;
          if (!obj) return;
          fitIntoPrintArea(obj);
          recalcPrintFee();
          canvas.requestRenderAll();
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
        printAreaRectRef.current = printAreaRect;
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
          const userObjects = canvas
            .getObjects()
            .filter(isDesignObject);
          sideObjectsRef.current[previousSide] = userObjects;
          userObjects.forEach((o) => canvas.remove(o));
        }

        // Load the mockup so the canvas stays CORS-clean, which lets us export a
        // PNG preview (canvas.toDataURL) for the order detail. Remote mockups
        // (Malfini CDN, which sends no CORS headers) go through our same-origin
        // image proxy with crossOrigin set; data-URL/local mockups load directly.
        // On any proxy failure we fall back to a direct load, so the designer
        // keeps working exactly as before (only the composite preview is skipped).
        const isRemote = /^https?:\/\//i.test(imageUrl);
        let newImg: FabricImage;
        if (isRemote) {
          const proxied = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          try {
            newImg = await FabricImage.fromURL(proxied, {
              crossOrigin: "anonymous",
            });
          } catch {
            newImg = await FabricImage.fromURL(imageUrl);
          }
        } else {
          newImg = await FabricImage.fromURL(imageUrl, {
            crossOrigin: "anonymous",
          });
        }
        if (cancelled) return;

        if (shirtImageRef.current) canvas.remove(shirtImageRef.current);
        applyMockupLayout(newImg, canvas, CANVAS_WIDTH, actualCanvasHeight);
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
      return () => {
        cancelled = true;
      };
    }, [isReady, imageUrl, side]); // eslint-disable-line react-hooks/exhaustive-deps

    const printTop = printArea.centerY - printArea.height / 2;

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
      </div>
    );
  }
);

export default DesignerCanvas;

// ── Helpers ───────────────────────────────────────────────────────────────────

// Controls for a user-placed object: the default set without the four side handles
// (ml/mr/mt/mb), which stretch one dimension only and would distort the artwork, plus a
// delete button. The corner handles scale proportionally (see uniformScaling on the canvas).
function buildObjectControls(
  controls: FabricObject["controls"],
  Control: typeof import("fabric").Control
): FabricObject["controls"] {
  const kept = Object.fromEntries(
    Object.entries(controls).filter(([key]) => !SIDE_HANDLES.has(key))
  );
  return { ...kept, deleteControl: buildDeleteControl(Control) };
}

const SIDE_HANDLES = new Set(["ml", "mr", "mt", "mb"]);

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
