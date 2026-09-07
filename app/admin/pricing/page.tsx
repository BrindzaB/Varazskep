import AdminNav from "@/components/admin/AdminNav";
import PricingSettingsForm from "@/components/admin/PricingSettingsForm";
import { getPricingSettings } from "@/lib/pricing/settings";
import { getProducts, getMalfiniCostMap } from "@/lib/malfini/client";
import { makeEurToHufConverter } from "@/lib/malfini/pricing";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import { getCachedAccountDetails } from "@/lib/kvikk/account";
import { toDeliveryPointType } from "@/lib/kvikk/deliveryPointMap";
import {
  HOME_DELIVERY_OPTIONS,
  POINT_DELIVERY_OPTIONS,
} from "@/lib/kvikk/deliveryOptions";

export const dynamic = "force-dynamic";

// Weight used for the shipping preview: one t-shirt (~200 g) or a mug (~500 g) both land
// in the couriers' lowest band, which is what the vast majority of orders hit.
const PREVIEW_WEIGHT_GRAMS = 500;

// One real product per designer category, so the preview shows what the settings
// actually do to the catalog rather than an invented example.
async function getSamples(
  eurHufRate: number
): Promise<{ name: string; sku: string; costNetHuf: number }[]> {
  const [products, costMap] = await Promise.all([
    getProducts("hu"),
    getMalfiniCostMap(makeEurToHufConverter(eurHufRate)),
  ]);

  const seen = new Set<string>();
  const samples: { name: string; sku: string; costNetHuf: number }[] = [];

  for (const p of products) {
    if (getCategoryConfig(p.categoryCode) === null) continue;
    if (seen.has(p.categoryCode)) continue;
    const sku = p.variants[0]?.nomenclatures[0]?.productSizeCode;
    const cost = sku ? costMap[sku] : undefined;
    if (!sku || !cost) continue;
    seen.add(p.categoryCode);
    samples.push({
      name: `${p.name} (${p.categoryName})`,
      sku,
      costNetHuf: cost,
    });
  }

  return samples;
}

/**
 * Net Kvikk cost for every delivery option the shop offers, at the preview weight.
 * Comes live from the account pricing, so the preview reflects Kvikk's current monthly
 * list. Returns an empty list if Kvikk is unreachable — the page must still render.
 */
async function getShippingSamples(): Promise<
  { label: string; netHuf: number }[]
> {
  try {
    const { pricing } = await getCachedAccountDetails();

    const priceKeys: { key: string; label: string }[] = [
      ...HOME_DELIVERY_OPTIONS.map((o) => ({ key: o.courier, label: o.label })),
      ...POINT_DELIVERY_OPTIONS.flatMap((o) => {
        const key = toDeliveryPointType(o.courier, o.mapType);
        return key ? [{ key, label: o.label }] : [];
      }),
    ];

    const out: { label: string; netHuf: number }[] = [];
    for (const { key, label } of priceKeys) {
      const table = pricing.shipping.find(
        (s) => s.courier === key && s.country === "HU"
      );
      const range = table?.prices.find(
        (p) => PREVIEW_WEIGHT_GRAMS >= p.min && PREVIEW_WEIGHT_GRAMS <= p.max
      );
      if (range) out.push({ label, netHuf: range.cost });
    }
    return out;
  } catch (err) {
    console.error("[admin/pricing] shipping preview unavailable:", err);
    return [];
  }
}

export default async function AdminPricingPage() {
  const settings = await getPricingSettings();
  const [samples, shippingSamples] = await Promise.all([
    getSamples(settings.eurHufRate),
    getShippingSamples(),
  ]);

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-gray-900">Árazás</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          Ezek a beállítások határozzák meg a Malfini ruhák bolti árát, a
          nyomtatási díjat és a szállítási díjat. A saját termékek ára
          változatlanul variánsonként állítható a Termékek oldalon.
        </p>

        <PricingSettingsForm
          initial={settings}
          samples={samples}
          shippingSamples={shippingSamples}
          shippingPreviewWeightGrams={PREVIEW_WEIGHT_GRAMS}
        />
      </main>
    </div>
  );
}
