// The invoice line items of a paid webshop order — what the shop enters in Billingo by
// hand today, and what an automated Billingo call will send later. One source for both so
// the admin view and the issued invoice cannot drift apart.
//
// One cart line is one invoice line: the print fee is folded into the gross unit price,
// exactly as the cart shows it. Shipping is its own line. Every amount is gross HUF.

export interface InvoiceLine {
  name: string;
  quantity: number;
  unit: string; // "db"
  unitPriceGrossHuf: number;
  totalGrossHuf: number;
  netHuf: number; // VAT-exclusive part of totalGrossHuf, rounded to whole HUF
  vatHuf: number; // totalGrossHuf − netHuf
}

export interface InvoiceItemInput {
  productName: string;
  colorName: string;
  sizeName: string;
  quantity: number;
  unitPriceHuf: number; // gross product price per piece
  printFeeHuf: number; // gross print fee per piece (0 = no design)
}

export interface InvoiceInput {
  items: InvoiceItemInput[];
  shippingLabel: string; // e.g. "GLS házhozszállítás"
  shippingCostHuf: number; // gross
  vatPct: number;
}

export interface InvoiceSummary {
  lines: InvoiceLine[];
  netHuf: number;
  vatHuf: number;
  grossHuf: number;
}

function line(
  name: string,
  quantity: number,
  unitPriceGrossHuf: number,
  vatPct: number
): InvoiceLine {
  const totalGrossHuf = unitPriceGrossHuf * quantity;
  const netHuf = Math.round(totalGrossHuf / (1 + vatPct / 100));
  return {
    name,
    quantity,
    unit: "db",
    unitPriceGrossHuf,
    totalGrossHuf,
    netHuf,
    vatHuf: totalGrossHuf - netHuf,
  };
}

// "Póló – Fekete – M (egyedi nyomtatással)"; empty colour/size parts are left out.
export function invoiceLineName(item: InvoiceItemInput): string {
  const base = [item.productName, item.colorName, item.sizeName]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" – ");
  return item.printFeeHuf > 0 ? `${base} (egyedi nyomtatással)` : base;
}

export function buildInvoice(input: InvoiceInput): InvoiceSummary {
  const lines = input.items.map((item) =>
    line(
      invoiceLineName(item),
      item.quantity,
      item.unitPriceHuf + item.printFeeHuf,
      input.vatPct
    )
  );
  if (input.shippingCostHuf > 0) {
    lines.push(line(input.shippingLabel, 1, input.shippingCostHuf, input.vatPct));
  }
  return {
    lines,
    netHuf: lines.reduce((s, l) => s + l.netHuf, 0),
    vatHuf: lines.reduce((s, l) => s + l.vatHuf, 0),
    grossHuf: lines.reduce((s, l) => s + l.totalGrossHuf, 0),
  };
}
