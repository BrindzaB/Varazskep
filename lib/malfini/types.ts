// TypeScript interfaces for Malfini REST API v4 response shapes.
// Docs: https://api.malfini.com/api-docs/index.html

export interface MalfiniNomenclature {
  productSizeCode: string; // 7-char SKU, e.g. "M150XM0" — primary key for availability/price lookups
  size: string;
  sizeName: string;
  sizeCode: string;
}

export interface MalfiniVariant {
  code: string;           // variant identifier (used as colorCode in URL params)
  colorCode: string;      // color identifier
  colorIconLink: string;  // URL to a small color swatch icon image
  name: string;           // color display name
  images: MalfiniImage[];
  nomenclatures: MalfiniNomenclature[];
  attributes?: MalfiniAttribute[];
}

export interface MalfiniImage {
  viewCode: string; // lowercase: "a" = front, "b" = back, "c" = detail, etc.
  link: string;     // full image URL, e.g. https://api.malfini.com/image/product/150/150_01_a~w400.jpg
}

export interface MalfiniAttribute {
  code: string;
  title: string; // e.g. "Anyagösszetétel"
  text: string;  // e.g. "100 % pamut"
}

export interface MalfiniProduct {
  code: string;         // 3-char product code — used as the URL identifier
  name: string;
  description: string;
  subtitle?: string;
  specification?: string;
  categoryName: string;
  categoryCode: string;
  gender?: string;
  genderCode?: string;
  trademark?: string;
  type?: string;
  variants: MalfiniVariant[];
  sizeChartPdf?: string | null;
  productCardPdf?: string | null;
}

export interface MalfiniAvailability {
  productSizeCode: string;
  quantity: number;
  date: string;
}

export interface MalfiniRecommendedPrice {
  productSizeCode: string;
  price: number;    // currency-dependent — check `currency` field (may be HUF or EUR depending on account)
  currency: string;
}

