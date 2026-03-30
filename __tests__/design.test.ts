import { describe, it, expect, vi } from "vitest";

// Mock out the DB and Supabase modules so the pure SVG functions can be
// imported without requiring environment variables.
vi.mock("@/lib/db", () => ({
  prisma: { design: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(),
  BUCKET_DESIGNS: "designs",
}));

import { buildSvgFromObjects, buildDesignSvg } from "@/lib/services/design";

// ── buildSvgFromObjects ───────────────────────────────────────────────────────

describe("buildSvgFromObjects", () => {
  it("returns a valid SVG wrapper for an empty object list", () => {
    const svg = buildSvgFromObjects([], 500, 600);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="500" height="600"');
    expect(svg).toContain('<rect width="500" height="600" fill="white"/>');
    expect(svg).toContain("</svg>");
  });

  it("renders an i-text object as a <text> element", () => {
    const objects = [
      {
        type: "i-text",
        text: "Hello",
        left: 250,
        top: 280,
        fontSize: 36,
        fontFamily: "Inter",
        fill: "#000000",
        angle: 0,
        scaleX: 1,
        scaleY: 1,
      },
    ];
    const svg = buildSvgFromObjects(objects, 500, 600);
    expect(svg).toContain("<text");
    expect(svg).toContain("Hello");
    expect(svg).toContain('font-family="Inter"');
    expect(svg).toContain('font-size="36"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('translate(250, 280)');
  });

  it("renders an image object as an <image> element", () => {
    const objects = [
      {
        type: "image",
        src: "https://example.com/star.svg",
        left: 250,
        top: 280,
        width: 100,
        height: 100,
        scaleX: 0.8,
        scaleY: 0.8,
        angle: 0,
      },
    ];
    const svg = buildSvgFromObjects(objects, 500, 600);
    expect(svg).toContain("<image");
    expect(svg).toContain('href="https://example.com/star.svg"');
    expect(svg).toContain('translate(250, 280)');
    expect(svg).toContain('scale(0.8, 0.8)');
  });

  it("escapes XML special characters in text content", () => {
    const objects = [
      {
        type: "i-text",
        text: 'A & B <test> "quote" \'apos\'',
        left: 250,
        top: 280,
        fontSize: 20,
        fontFamily: "Inter",
        fill: "#000000",
      },
    ];
    const svg = buildSvgFromObjects(objects, 500, 600);
    expect(svg).toContain("A &amp; B &lt;test&gt; &quot;quote&quot; &apos;apos&apos;");
    // Raw characters must not appear inside element content
    expect(svg).not.toContain("A & B");
  });

  it("renders multi-line text with multiple <tspan> elements", () => {
    const objects = [
      {
        type: "i-text",
        text: "Line one\nLine two",
        left: 250,
        top: 280,
        fontSize: 24,
        fontFamily: "Inter",
        fill: "#000000",
      },
    ];
    const svg = buildSvgFromObjects(objects, 500, 600);
    const tspanCount = (svg.match(/<tspan/g) ?? []).length;
    expect(tspanCount).toBe(2);
    expect(svg).toContain("Line one");
    expect(svg).toContain("Line two");
  });

  it("includes rotation in the transform when angle is non-zero", () => {
    const objects = [
      {
        type: "i-text",
        text: "Rotated",
        left: 250,
        top: 280,
        fontSize: 24,
        fontFamily: "Inter",
        fill: "#000000",
        angle: 45,
        scaleX: 1,
        scaleY: 1,
      },
    ];
    const svg = buildSvgFromObjects(objects, 500, 600);
    expect(svg).toContain("rotate(45)");
  });

  it("skips unknown object types silently", () => {
    const objects = [{ type: "rect", left: 100, top: 100 }];
    const svg = buildSvgFromObjects(objects, 500, 600);
    // Should still be a valid SVG but contain no user elements beyond the background rect
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<rect x=");
  });
});

// ── buildDesignSvg ────────────────────────────────────────────────────────────

describe("buildDesignSvg", () => {
  it("returns a single 500×600 SVG when only the front has objects", () => {
    const svg = buildDesignSvg({
      front: [{ type: "i-text", text: "Front", left: 250, top: 280, fontSize: 24, fontFamily: "Inter", fill: "#000000" }],
      back: [],
    });
    expect(svg).toContain('width="500" height="600"');
    expect(svg).not.toContain("Hátul");
  });

  it("returns a combined SVG with both panels when back has objects", () => {
    const svg = buildDesignSvg({
      front: [{ type: "i-text", text: "Front", left: 250, top: 280, fontSize: 24, fontFamily: "Inter", fill: "#000000" }],
      back: [{ type: "i-text", text: "Back", left: 250, top: 280, fontSize: 24, fontFamily: "Inter", fill: "#000000" }],
    });
    expect(svg).toContain("Elől");
    expect(svg).toContain("Hátul");
    expect(svg).toContain("Front");
    expect(svg).toContain("Back");
    // Width should be wider than a single canvas
    const widthMatch = svg.match(/width="(\d+)"/);
    expect(Number(widthMatch?.[1])).toBeGreaterThan(500);
  });

  it("returns a single panel when both sides are empty", () => {
    const svg = buildDesignSvg({ front: [], back: [] });
    expect(svg).toContain('width="500" height="600"');
    expect(svg).not.toContain("Hátul");
  });
});
