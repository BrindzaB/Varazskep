import AdminNav from "@/components/admin/AdminNav";
import PricingSettingsForm from "@/components/admin/PricingSettingsForm";
import { getPricingSettings } from "@/lib/pricing/settings";
import { getProducts, getMalfiniCostMap } from "@/lib/malfini/client";
import { makeEurToHufConverter } from "@/lib/malfini/pricing";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";

export const dynamic = "force-dynamic";

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

export default async function AdminPricingPage() {
  const settings = await getPricingSettings();
  const samples = await getSamples(settings.eurHufRate);

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-gray-900">Árazás</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500">
          Ezek a beállítások határozzák meg a Malfini ruhák bolti árát. A saját
          termékek ára változatlanul variánsonként állítható a Termékek oldalon.
        </p>

        <PricingSettingsForm initial={settings} samples={samples} />
      </main>
    </div>
  );
}
