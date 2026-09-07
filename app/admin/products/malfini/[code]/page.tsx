import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import MalfiniPriceEditor, {
  type EditorVariant,
} from "@/components/admin/MalfiniPriceEditor";
import {
  getProduct,
  getRecommendedPrices,
  getAvailabilities,
  buildPriceMap,
  buildAvailabilityMap,
  malfiniProductSkus,
} from "@/lib/malfini/client";
import { makeEurToHufConverter } from "@/lib/malfini/pricing";
import { getMalfiniPriceDetails } from "@/lib/pricing/resolve";
import { getPricingSettings } from "@/lib/pricing/settings";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";
import { sortNomenclatures } from "@/lib/malfini/sizeOrder";

// Overrides live in the DB and must be visible the moment they are saved.
export const dynamic = "force-dynamic";

const GENDER_LABELS: Record<string, string> = {
  GENTS: "Férfi",
  LADIES: "Női",
  UNISEX: "Uniszex",
  KIDS: "Gyerek",
  "GENTS/KIDS": "Férfi/Gyerek",
  "UNISEX/KIDS": "Uniszex/Gyerek",
};

export default async function AdminMalfiniProductPage({
  params,
}: {
  params: { code: string };
}) {
  const [product, settings, prices, availabilities] = await Promise.all([
    getProduct(params.code, "hu"),
    getPricingSettings(),
    getRecommendedPrices([params.code]),
    getAvailabilities([params.code]),
  ]);

  if (!product) notFound();

  // Our own price (override, else cost × árrés × VAT) is what the shop charges;
  // Malfini's recommended price is shown only as a reference point next to it.
  const priceDetails = await getMalfiniPriceDetails(
    malfiniProductSkus(product)
  );
  const recommendedMap = buildPriceMap(
    prices,
    makeEurToHufConverter(settings.eurHufRate)
  );
  const availabilityMap = buildAvailabilityMap(availabilities);
  const categoryConfig = getCategoryConfig(product.categoryCode);

  const variants: EditorVariant[] = product.variants.map((variant) => ({
    code: variant.code,
    name: variant.name,
    colorIconLink: variant.colorIconLink,
    frontImage:
      variant.images.find((img) => img.viewCode === "a")?.link ?? null,
    attributes: (variant.attributes ?? []).map((a) => ({
      code: a.code,
      title: a.title,
      text: a.text,
    })),
    rows: sortNomenclatures(variant.nomenclatures).map((nom) => {
      const detail = priceDetails[nom.productSizeCode];
      return {
        sku: nom.productSizeCode,
        sizeName: nom.sizeName,
        costNetHuf: detail?.costNetHuf ?? null,
        computedHuf: detail?.computedHuf ?? null,
        overrideHuf:
          detail?.origin === "override" ? (detail?.grossHuf ?? null) : null,
        recommendedHuf: recommendedMap[nom.productSizeCode] ?? null,
        stock: availabilityMap[nom.productSizeCode] ?? 0,
      };
    }),
  }));

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/admin/products"
            className="transition-colors hover:text-gray-900"
          >
            ← Termékek
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href="/admin/products/malfini"
            className="transition-colors hover:text-gray-900"
          >
            Malfini katalógus
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700">{product.name}</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            <span className="mr-2 font-mono text-base text-gray-400">
              {product.code}
            </span>
            {product.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-sm text-gray-500">
              {product.categoryName} ·{" "}
              {GENDER_LABELS[product.genderCode ?? ""] ??
                product.genderCode ??
                "—"}{" "}
              · {product.variants.length} szín
            </p>
            {categoryConfig ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Tervező aktív
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Tervező nem aktív
              </span>
            )}
          </div>
          {product.description && (
            <p className="mt-3 max-w-2xl text-sm text-gray-600">
              {product.description}
            </p>
          )}
        </div>

        <p className="mb-6 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
          Alapból a szabály áraz: nettó beszerzés{" "}
          <strong>+{settings.malfiniMarkupPct}% árrés</strong>, majd{" "}
          <strong>{settings.vatPct}% ÁFA</strong>, majd a legközelebbi{" "}
          {settings.priceEndings.map((e) => `…${e}`).join(" vagy ")} árra
          kerekítve. A „Bolti ár” mezőt átírva ez a méret kézi árat kap, a többi
          változatlan marad.{" "}
          <Link href="/admin/pricing" className="underline hover:text-gray-900">
            Árazási beállítások
          </Link>
        </p>

        <MalfiniPriceEditor
          productCode={product.code}
          variants={variants}
          vatPct={settings.vatPct}
        />
      </main>
    </div>
  );
}
