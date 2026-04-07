import type { MalfiniNomenclature } from "./types";

// Standard clothing size order — smallest to largest.
export const SIZE_ORDER = [
  "3XS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL",
  // Kids numeric sizes
  "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152", "158", "164", "170",
];

export function sortNomenclatures(noms: MalfiniNomenclature[]): MalfiniNomenclature[] {
  return [...noms].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.sizeCode.toUpperCase());
    const bi = SIZE_ORDER.indexOf(b.sizeCode.toUpperCase());
    // Known sizes sort by order; unknown sizes fall to the end in original order.
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
