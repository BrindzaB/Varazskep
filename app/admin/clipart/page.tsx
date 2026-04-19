import Link from "next/link";
import Image from "next/image";
import AdminNav from "@/components/admin/AdminNav";
import ClipartToggleButton from "@/components/admin/ClipartToggleButton";
import { getAllClipartAdmin } from "@/lib/services/clipart";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ category?: string }>;
}

export default async function AdminClipartPage({ searchParams }: Props) {
  const { category } = await searchParams;
  const allItems = await getAllClipartAdmin();

  // Derive unique categories preserving order
  const categories = Array.from(new Set(allItems.map((i) => i.category))).sort();

  const items = category ? allItems.filter((i) => i.category === category) : allItems;

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Minták</h1>
          <Link
            href="/admin/clipart/new"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            + Új minta
          </Link>
        </div>

        {/* Category filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/admin/clipart"
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !category
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Összes ({allItems.length})
          </Link>
          {categories.map((cat) => {
            const count = allItems.filter((i) => i.category === cat).length;
            const isActive = category === cat;
            return (
              <Link
                key={cat}
                href={`/admin/clipart?category=${encodeURIComponent(cat)}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat} ({count})
              </Link>
            );
          })}
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500">Még nincs minta.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Előnézet</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Név</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Kategória</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Állapot</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                        <Image
                          src={item.svgUrl}
                          alt={item.name}
                          width={32}
                          height={32}
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600">{item.category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.active ? "Aktív" : "Inaktív"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <ClipartToggleButton clipartId={item.id} active={item.active} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
