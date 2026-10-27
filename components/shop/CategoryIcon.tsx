import type { CategoryIconKey } from "@/lib/shop/categoryIcons";

// 24×24 stroke pictograms for the category tiles. The generic shapes (grid, mug, bag, gift,
// image, phone, key, tag) follow Lucide (ISC licence); the garments, the pillow and the gym
// bag are drawn here because Lucide has no sweatshirt, polo, pillow or drawstring bag.
const PATHS: Record<CategoryIconKey, string[]> = {
  all: [
    "M4 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M14 3h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M14 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z",
    "M4 13h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z",
  ],
  tshirt: [
    "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z",
  ],
  sweatshirt: [
    // Long sleeves with cuffs, ribbed hem.
    "M9 2.5 5 4 2 15l3 1 2-6v11h10V10l2 6 3-1-3-11-4-1.5a3 3 0 0 1-6 0z",
    "M7 18h10",
    "M2.4 13.6l3 1",
    "M21.6 13.6l-3 1",
  ],
  polo: [
    "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z",
    // Collar points and button placket.
    "M8 2l2 4 2-2 2 2 2-4",
    "M12 4v6",
  ],
  mug: [
    "M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1",
    "M6 2v2",
    "M10 2v2",
    "M14 2v2",
  ],
  pillow: [
    // Square cushion with pinched corners and a centre tuft.
    "M4 5c3 1.2 13 1.2 16 0-1.2 3-1.2 11 0 14-3-1.2-13-1.2-16 0 1.2-3 1.2-11 0-14z",
    "M12 12h.01",
  ],
  bag: [
    "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z",
    "M3 6h18",
    "M16 10a4 4 0 0 1-8 0",
  ],
  gymbag: [
    // Drawstring bag: ruffled top, cords looping up and down to the bottom corners.
    "M8 8h8l2.5 12.5H5.5z",
    "M8 8c1.3.8 2.7.8 4 0s2.7-.8 4 0",
    "M12 8V6",
    "M12 6C10 2 6.5 2 6 5s-.5 10-.5 15.5",
    "M12 6c2-4 5.5-4 6-1s.5 10 .5 15.5",
  ],
  gift: [
    "M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z",
    "M12 8v13",
    "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7",
    "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
  ],
  image: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
    "M9 7a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
    "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",
  ],
  phone: [
    "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
    "M12 18h.01",
  ],
  key: [
    "m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4",
    "m21 2-9.6 9.6",
    "M7.5 10a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z",
  ],
  tag: [
    "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z",
    "M7.5 7.5h.01",
  ],
};

interface Props {
  icon: CategoryIconKey;
  className?: string;
}

export default function CategoryIcon({ icon, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
