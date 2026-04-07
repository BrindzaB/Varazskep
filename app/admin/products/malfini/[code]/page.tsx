import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { getProduct, getRecommendedPrices, getAvailabilities, buildPriceMap, buildAvailabilityMap } from "@/lib/malfini/client";
import { convertEurToHuf } from "@/lib/malfini/pricing";
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
  const [product, prices, availabilities] = await Promise.all([
    getProduct(params.code, "hu"),
    getRecommendedPrices([params.code]),
    getAvailabilities([params.code]),
  ]);

  if (!product) notFound();

  const priceMap = buildPriceMap(prices, convertEurToHuf);
  const availabilityMap = buildAvailabilityMap(availabilities);
  const categoryConfig = getCategoryConfig(product.categoryCode);

  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
          <Link href="/admin/products" className="hover:text-gray-900 transition-colors">
            ← Termékek
          </Link>
          <span className="text-gray-300">/</span>
          <Link href="/admin/products/malfini" className="hover:text-gray-900 transition-colors">
            Malfini katalógus
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-700">{product.name}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            <span className="font-mono text-base text-gray-400 mr-2">{product.code}</span>
            {product.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm text-gray-500">
              {product.categoryName} · {GENDER_LABELS[product.genderCode ?? ""] ?? product.genderCode ?? "—"} · {product.variants.length} szín
            </p>
            {categoryConfig ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Tervező aktív
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                Tervező nem aktív
              </span>
            )}
          </div>
          {product.description && (
            <p className="text-sm text-gray-600 mt-3 max-w-2xl">{product.description}</p>
          )}
        </div>

        <div className="space-y-6">
          {product.variants.map((variant) => {
            const frontImage = variant.images.find((img) => img.viewCode === "a")?.link;
            const sortedNoms = sortNomenclatures(variant.nomenclatures);

            return (
              <section key={variant.code} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Variant header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={variant.colorIconLink}
                    alt=""
                    className="h-6 w-6 rounded-full object-cover border border-gray-200"
                  />
                  <span className="font-medium text-gray-900">{variant.name}</span>
                  <span className="font-mono text-xs text-gray-400">{variant.code}</span>
                  {frontImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={frontImage}
                      alt={variant.name}
                      className="h-12 w-12 object-contain ml-auto"
                    />
                  )}
                </div>

                {/* Sizes table */}
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 w-24">Méret</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 w-36">SKU</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 w-28">Ár</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500 w-32">Készlet</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedNoms.map((nom) => {
                      const qty = availabilityMap[nom.productSizeCode] ?? 0;
                      const price = priceMap[nom.productSizeCode];
                      return (
                        <tr key={nom.productSizeCode} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-900">{nom.sizeName}</td>
                          <td className="px-4 py-2 font-mono text-xs text-gray-500">{nom.productSizeCode}</td>
                          <td className="px-4 py-2 text-gray-900">
                            {price ? formatHuf(price) : "—"}
                          </td>
                          <td className={`px-4 py-2 font-medium ${stockColorClass(qty)}`}>
                            {qty === 0 ? "Nincs készleten" : `${qty} db`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Attributes (fabric content, etc.) */}
                {variant.attributes && variant.attributes.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
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
