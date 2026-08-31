import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
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
import { formatHuf } from "@/lib/utils/format";

export const revalidate = 300;

const GENDER_LABELS: Record<string, string> = {
  GENTS: "Férfi",
  LADIES: "Női",
  UNISEX: "Uniszex",
  KIDS: "Gyerek",
  "GENTS/KIDS": "Férfi/Gyerek",
  "UNISEX/KIDS": "Uniszex/Gyerek",
};

function stockColorClass(qty: number): string {
  if (qty === 0) return "text-red-600";
  if (qty <= 5) return "text-yellow-600";
  return "text-green-700";
}

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

  // Our own price (cost × markup × VAT) is what the shop charges; Malfini's
  // recommended price is shown only as a reference point next to it.
  const priceDetails = await getMalfiniPriceDetails(
    malfiniProductSkus(product)
  );
  const recommendedMap = buildPriceMap(
    prices,
    makeEurToHufConverter(settings.eurHufRate)
  );
  const availabilityMap = buildAvailabilityMap(availabilities);
  const categoryConfig = getCategoryConfig(product.categoryCode);

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
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

        <div className="mb-8">
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

        <p className="mb-4 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600">
          A bolti ár a nettó beszerzési árból számolódik:{" "}
          <strong>+{settings.malfiniMarkupPct}% árrés</strong>, majd{" "}
          <strong>{settings.vatPct}% ÁFA</strong>, majd a legközelebbi{" "}
          {settings.roundGridHuf - 1}-re végződő árra kerekítve.{" "}
          <Link href="/admin/pricing" className="underline hover:text-gray-900">
            Árazási beállítások
          </Link>
        </p>

        <div className="space-y-6">
          {product.variants.map((variant) => {
            const frontImage = variant.images.find(
              (img) => img.viewCode === "a"
            )?.link;
            const sortedNoms = sortNomenclatures(variant.nomenclatures);

            return (
              <section
                key={variant.code}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                {/* Variant header */}
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={variant.colorIconLink}
                    alt=""
                    className="h-6 w-6 rounded-full border border-gray-200 object-cover"
                  />
                  <span className="font-medium text-gray-900">
                    {variant.name}
                  </span>
                  <span className="font-mono text-xs text-gray-400">
                    {variant.code}
                  </span>
                  {frontImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontImage}
                      alt={variant.name}
                      className="ml-auto h-12 w-12 object-contain"
                    />
                  )}
                </div>

                {/* Sizes table */}
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap text-sm">
                    <thead className="border-b border-gray-100">
                      <tr>
                        <th className="w-24 px-4 py-2 text-left font-medium text-gray-500">
                          Méret
                        </th>
                        <th className="w-36 px-4 py-2 text-left font-medium text-gray-500">
                          SKU
                        </th>
                        <th className="w-28 px-4 py-2 text-right font-medium text-gray-500">
                          Beszerzés
                        </th>
                        <th className="w-28 px-4 py-2 text-right font-medium text-gray-500">
                          Bolti ár
                        </th>
                        <th className="w-24 px-4 py-2 text-right font-medium text-gray-500">
                          Árrés
                        </th>
                        <th className="w-28 px-4 py-2 text-right font-medium text-gray-500">
                          Malfini aj.
                        </th>
                        <th className="w-32 px-4 py-2 text-left font-medium text-gray-500">
                          Készlet
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedNoms.map((nom) => {
                        const qty = availabilityMap[nom.productSizeCode] ?? 0;
                        const detail = priceDetails[nom.productSizeCode];
                        const recommended = recommendedMap[nom.productSizeCode];
                        return (
                          <tr
                            key={nom.productSizeCode}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-4 py-2 text-gray-900">
                              {nom.sizeName}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">
                              {nom.productSizeCode}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-600">
                              {detail ? formatHuf(detail.costNetHuf) : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">
                              {detail ? formatHuf(detail.grossHuf) : "—"}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-medium ${
                                detail &&
                                detail.markupPct <
                                  settings.malfiniMarkupPct * 0.8
                                  ? "text-red-600"
                                  : "text-green-700"
                              }`}
                            >
                              {detail ? `${detail.markupPct.toFixed(1)}%` : "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-gray-400">
                              {recommended ? formatHuf(recommended) : "—"}
                            </td>
                            <td
                              className={`px-4 py-2 font-medium ${stockColorClass(qty)}`}
                            >
                              {qty === 0 ? "Nincs készleten" : `${qty} db`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Attributes (fabric content, etc.) */}
                {variant.attributes && variant.attributes.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                      {variant.attributes.map((attr) => (
                        <div key={attr.code} className="flex gap-1">
                          <dt className="text-gray-400">{attr.title}:</dt>
                          <dd className="text-gray-600">{attr.text}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
