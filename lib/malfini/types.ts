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
  viewCode: string; // "A" = front, "B" = back, other letters for additional views
  link: string;     // full image URL
}

export interface MalfiniAttribute {
  code: string;
  name: string;
  value: string;
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
}

export interface MalfiniAvailability {
  productSizeCode: string;
  quantity: number;
  date: string;
}

export interface MalfiniRecommendedPrice {
  productSizeCode: string;
  price: number;    // EUR, decimal (e.g. 12.99)
  currency: string;
}

export interface MalfiniPrice {
  productSizeCode: string;
  limit: number;    // minimum quantity for this price tier
  price: number;
  currency: string;
}
