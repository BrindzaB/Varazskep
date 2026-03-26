# DESIGN.md — Varázskép Webshop Design System

Design reference for the Varázskép webshop. All visual decisions must follow this document. The webshop replicates the look and feel of the current site at varazskep.hu — same colors, same typography style, same clean professional aesthetic — with the addition of a T-shirt Designer page in the navigation.

Source reference: https://varazskep.hu (WordPress + Elementor site, analyzed 2026-03-26)

---

## Brand Identity

**Company:** Varázs-kép Kft. (Dunaújváros, Hungary)
**Tagline/tone:** Professional, direct, approachable. No playfulness, no trendy language. The brand speaks to local Hungarian customers clearly and simply.
**Logo:** Horizontal SVG logo (`Fekvo-logo.svg`). Placed in the header, links to the homepage. Must be used as-is — no color modifications, no scaling distortions.
**Imagery style:** Product-focused photography. Real printed products on white/neutral backgrounds. No stock lifestyle photography.

---

## Color Palette

These are the authoritative colors for the webshop. Do not introduce new colors without updating this document first.

### Primary Colors

| Name       | Hex       | Usage                                                   |
| ---------- | --------- | ------------------------------------------------------- |
| Charcoal   | `#32373c` | Primary buttons, header background, heavy text elements |
| White      | `#ffffff` | Page background, card backgrounds, button text          |
| Off-white  | `#f8f9fa` | Section backgrounds, alternate rows, subtle separation  |
| Body text  | `#32373c` | All body text, labels, form fields                      |
| Muted text | `#6c757d` | Secondary text, placeholders, captions                  |

### Border & Divider

| Name          | Hex       | Usage                                 |
| ------------- | --------- | ------------------------------------- |
| Border light  | `#e9ecef` | Card borders, input borders, dividers |
| Border medium | `#abb8c3` | Stronger dividers, focus rings        |

### Semantic Colors (functional only)

| Name    | Hex       | Usage                                   |
| ------- | --------- | --------------------------------------- |
| Success | `#00d084` | Order confirmed, payment success states |
| Error   | `#cf2e2e` | Form errors, destructive actions        |
| Warning | `#fcb900` | Stock warnings, caution states          |
| Info    | `#0693e3` | Informational messages                  |

### What NOT to use

The WordPress site defines many preset accent colors (vivid purple, pale pink, electric grass, etc.). These are **WordPress editor presets** — they are not part of the brand. Do not use them in the webshop UI.

---

## Typography

### Font Family

**Inter** — a clean, geometric sans-serif. Closest match to the current site's system sans-serif, but with consistent rendering across all platforms.

```css
font-family:
  "Inter",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Load via `next/font/google` with weights 400, 500, 600, 700.

### Type Scale

| Token       | Size | Weight | Line Height | Usage                         |
| ----------- | ---- | ------ | ----------- | ----------------------------- |
| `text-xs`   | 12px | 400    | 1.5         | Captions, fine print          |
| `text-sm`   | 14px | 400    | 1.5         | Secondary labels, helper text |
| `text-base` | 16px | 400    | 1.6         | Body text, form inputs        |
| `text-lg`   | 18px | 500    | 1.5         | Lead text, card titles        |
| `text-xl`   | 20px | 600    | 1.4         | Section headings              |
| `text-2xl`  | 24px | 600    | 1.3         | Page subheadings              |
| `text-3xl`  | 30px | 700    | 1.2         | Page titles                   |
| `text-4xl`  | 36px | 700    | 1.1         | Hero headings                 |

### Rules

- Body text: always `text-base`, color `#32373c`
- Never use font sizes below `text-xs` (12px)
- Headings use weight 600 or 700 only
- No decorative or display fonts

---

## Layout & Spacing

### Container Widths

| Name    | Width  | Usage                                         |
| ------- | ------ | --------------------------------------------- |
| Content | 800px  | Text-heavy pages (about, privacy policy)      |
| Default | 1200px | Most pages — product listing, checkout, admin |
| Full    | 100%   | Full-bleed hero sections, designer canvas     |

```css
/* Tailwind config */
maxWidth: {
  'content':'800px','layout': "1200px";
}
```

### Spacing Scale

Match the rhythm from the current site. Use Tailwind's default spacing scale — no custom values needed.

Key spacings in use:

- Section padding: `py-16` (64px top/bottom)
- Card padding: `p-6` (24px)
- Form field gap: `gap-4` (16px)
- Component gap: `gap-6` (24px)

### Responsive Breakpoints

Match the current site's breakpoints:

| Breakpoint | Width        | Tailwind |
| ---------- | ------------ | -------- |
| Mobile     | < 768px      | `sm:`    |
| Tablet     | 768px–1023px | `md:`    |
| Desktop    | ≥ 1024px     | `lg:`    |
| Wide       | ≥ 1200px     | `xl:`    |

Mobile-first approach: default styles are for mobile, then `md:`, `lg:`, `xl:` override upward.

---

## Navigation

### Current site navigation

Főoldal / Árlista / Szolgáltatásaink ▾ / Rólunk / Kapcsolat / Rendelés

### Webshop navigation

The webshop is a different product, so the navigation is restructured for e-commerce. The designer page is added as a first-class menu item.

```
Főoldal | Termékek | Tervező | Kapcsolat
```

| Item      | Route        | Notes                                                          |
| --------- | ------------ | -------------------------------------------------------------- |
| Főoldal   | `/`          | Product listing / homepage                                     |
| Termékek  | `/products`  | All products (can also click individual product from homepage) |
| Tervező   | `/designer`   | T-shirt designer module (Fabric.js)                            |
| Kapcsolat | `/contact` | Contact info, address, opening hours                           |

### Header layout

- Logo left-aligned, links to `/`
- Navigation right-aligned (desktop) / hamburger menu (mobile)
- Sticky header with subtle shadow on scroll
- Header background: `#ffffff`
- Active nav item: underline or `#32373c` text weight 600
- Nav text: `text-sm` (14px), weight 500, color `#32373c`

### Cart indicator

- Cart icon in the header, right of navigation
- Shows item count badge when cart is non-empty
- Badge: `#32373c` background, white text

---

## Components

### Buttons

**Primary (default)**

```
bg-[#32373c] text-white font-medium rounded-sm px-5 py-2.5
hover: bg-[#1d2124]
```

**Secondary / outline**

```
border border-[#32373c] text-[#32373c] bg-white font-medium rounded-sm px-5 py-2.5
hover: bg-[#32373c] text-white
```

**Destructive (admin only)**

```
bg-[#cf2e2e] text-white font-medium rounded-sm px-5 py-2.5
hover: bg-[#a52525]
```

Rules:

- No `rounded-full` pill buttons — use `rounded-sm` (2px) or `rounded` (4px) max
- Button text: always sentence case, never ALL CAPS
- Icon buttons: 40×40px minimum tap target

### Cards

Product cards, order cards:

```
bg-white border border-[#e9ecef] rounded shadow-sm p-6
hover (product card): shadow-md transition-shadow
```

Box shadow levels (from current site):

- `shadow-sm`: `6px 6px 9px rgba(0,0,0,0.2)` — default card
- `shadow-md`: `12px 12px 50px rgba(0,0,0,0.4)` — hover / elevated
- `shadow-sharp`: `6px 6px 0px rgba(0,0,0,0.2)` — admin panel items

### Form Inputs

```
border border-[#abb8c3] rounded px-3 py-2 text-base text-[#32373c]
focus: border-[#32373c] outline-none ring-1 ring-[#32373c]
error: border-[#cf2e2e] ring-[#cf2e2e]
placeholder: text-[#6c757d]
```

Labels: `text-sm font-medium text-[#32373c]` above each input.

### Badges / Status pills

Order status indicators:

| Status        | Background | Text      |
| ------------- | ---------- | --------- |
| PENDING       | `#f8f9fa`  | `#6c757d` |
| PAID          | `#e6f7f1`  | `#00d084` |
| IN_PRODUCTION | `#fff3cd`  | `#856404` |
| SHIPPED       | `#cce5ff`  | `#004085` |
| COMPLETE      | `#d4edda`  | `#155724` |
| CANCELLED     | `#f8d7da`  | `#721c24` |

---

## Page-specific Design

### Homepage / Product Listing (`/`)

- Hero section: full-width, `#32373c` background, white headline, short Hungarian description
- Product grid: 3 columns on desktop, 2 on tablet, 1 on mobile
- Product card: product image (square, 1:1), product name, price in HUF, "Kosárba" button
- No sidebar — clean grid layout only

### Product Detail (`/products/[slug]`)

- Product image left (60%), product info right (40%) on desktop
- Stacked on mobile
- Variant selector (color + size) below image
- Clear HUF price display
- "Kosárba" and "Tervező megnyitása" (opens designer with this product loaded) CTAs

### T-shirt Designer (`/designer`)

- Full-width canvas area — no sidebar frame that competes with the design surface
- Toolbar on the left (or top on mobile): clipart panel, text tool, color picker
- Canvas center: the t-shirt mockup with Fabric.js overlay
- Right panel (or bottom on mobile): summary, "Kosárba adás" CTA
- Background: `#f8f9fa` (off-white) to make the white canvas pop
- Designer toolbar: `#32373c` background, white icons

### Cart (`/cart`)

- Simple list layout (not a modal)
- Item row: image thumbnail, name/variant, quantity stepper, price, remove button
- Order summary card on the right (desktop) / below (mobile)
- "Tovább a fizetéshez" (Proceed to checkout) primary button

### Checkout (`/checkout`)

- Single-column, max-width 640px, centered
- Grouped fields: shipping info block, then order summary block
- GDPR consent checkbox at the bottom, above the submit button
- Submit button: full-width, primary style, "Fizetés Stripe-on keresztül"

### Order Confirmation (`/orders/[id]`)

- Centered, content-width (800px)
- Large success icon or checkmark at top
- Order number prominently displayed
- Short summary of what was ordered
- "Vissza a főoldalra" link

### Admin Panel (`/admin/*`)

- Left sidebar navigation (desktop) / top nav (mobile)
- Sidebar background: `#32373c`, white text/icons
- Active sidebar item: slightly lighter background `#464c52`
- Main content: white background, `#f8f9fa` page background
- Tables: clean, `border-b border-[#e9ecef]` row dividers, no outer border

---

## Imagery & Assets

### Product images

- Format: WebP preferred, JPEG fallback
- Aspect ratio: always 1:1 (square) for product cards
- Background: white or transparent
- Minimum size: 800×800px source

### Clipart assets (designer)

- Format: SVG only
- Stored in `public/clipart/` organized by category subfolder
- Must render cleanly at any size — no raster elements inside SVGs
- Naming: `kebab-case.svg` (e.g., `sziv-piros.svg`, `csillag-arany.svg`)

### T-shirt mockup (designer canvas)

- A flat-lay or front-view t-shirt silhouette in SVG
- Neutral gray color by default (color changes via canvas background / overlay)
- Print area must be clearly defined with a visible dashed boundary

---

## Accessibility

- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- All interactive elements must have visible focus states
- All images must have `alt` attributes in Hungarian
- Form inputs must have associated `<label>` elements (no placeholder-only labels)
- Error messages must be associated with their input via `aria-describedby`

---

## Things to avoid

- No `rounded-full` pill shapes on buttons
- No gradients on UI elements (gradients are WordPress editor presets, not brand elements)
- No drop shadows larger than `shadow-md` on standard components
- No ALL CAPS text
- No decorative fonts
- No emoji in UI text
- No blue hyperlink underlines on nav items
- No modal popups for cart or checkout — dedicated pages only
