import { malfiniCategoryLabel } from "./categoryConfig";

// Hungarian display labels for Malfini `genderCode` values.
export const GENDER_LABELS: Record<string, string> = {
  GENTS: "Férfi",
  LADIES: "Női",
  UNISEX: "Uniszex",
  KIDS: "Gyerek",
  "GENTS/KIDS": "Férfi/Gyerek",
  "UNISEX/KIDS": "Uniszex/Gyerek",
};

// "Basic · Pólók · Férfi" — how admin pickers name a Malfini product.
export function malfiniProductLabel(p: {
  code: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  genderCode?: string | null;
}): string {
  return [p.name, malfiniCategoryLabel(p), GENDER_LABELS[p.genderCode ?? ""] ?? p.genderCode]
    .filter(Boolean)
    .join(" · ");
}
