// Presents an order's products as line items, whichever shape the order was stored in.
//
// Orders now keep one OrderItem per cart line. Orders created before that stored a single
// product on the Order row itself — and silently dropped every further cart line and the
// quantity. Their one known product is shown as a line with an unknown quantity and
// price rather than an invented one.

export interface OrderLine {
  key: string;
  productName: string;
  productCode: string | null;
  productSizeCode: string | null;
  colorName: string;
  sizeName: string;
  quantity: number | null; // null = legacy order, quantity was never stored
  unitPriceHuf: number | null; // null = legacy or ORDER_FORM order
  printFeeHuf: number | null; // per piece; null = legacy or ORDER_FORM order
  designId: string | null;
}

interface LineItemFields {
  id: string;
  productName: string;
  productCode: string | null;
  productSizeCode: string | null;
  colorName: string;
  sizeName: string;
  quantity: number;
  unitPriceHuf: number | null; // null on ORDER_FORM lines (priced later)
  printFeeHuf: number | null;
  designId: string | null;
}

interface OrderWithLines {
  id: string;
  items: LineItemFields[];
  // LEGACY single-item fields
  productName: string;
  productCode: string | null;
  productSizeCode: string | null;
  colorName: string;
  sizeName: string;
  designId: string | null;
}

export function getOrderLines(order: OrderWithLines): OrderLine[] {
  if (order.items.length > 0) {
    return order.items.map((item) => ({
      key: item.id,
      productName: item.productName,
      productCode: item.productCode,
      productSizeCode: item.productSizeCode,
      colorName: item.colorName,
      sizeName: item.sizeName,
      quantity: item.quantity,
      unitPriceHuf: item.unitPriceHuf,
      printFeeHuf: item.printFeeHuf,
      designId: item.designId,
    }));
  }
  // No lines and no legacy product: an ORDER_FORM order whose products are described
  // only in its free text.
  if (order.productName === "") return [];
  return [
    {
      key: order.id,
      productName: order.productName,
      productCode: order.productCode,
      productSizeCode: order.productSizeCode,
      colorName: order.colorName,
      sizeName: order.sizeName,
      quantity: null,
      unitPriceHuf: null,
      printFeeHuf: null,
      designId: order.designId,
    },
  ];
}

/** One-line product summary for order lists, e.g. "Póló — Fekete / M × 3 (+2 tétel)". */
export function summarizeOrderLines(lines: OrderLine[]): string {
  const [first, ...rest] = lines;
  if (!first) return "";
  const qty = first.quantity !== null ? ` × ${first.quantity}` : "";
  const more = rest.length > 0 ? ` (+${rest.length} tétel)` : "";
  return `${first.productName} — ${first.colorName} / ${first.sizeName}${qty}${more}`;
}
