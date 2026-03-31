import Link from "next/link";
import Image from "next/image";
import AdminNav from "@/components/admin/AdminNav";
import ClipartToggleButton from "@/components/admin/ClipartToggleButton";
import { getAllClipartAdmin } from "@/lib/services/clipart";

export const dynamic = "force-dynamic";

export default async function AdminClipartPage() {
  const items = await getAllClipartAdmin();

  return (
    <div>
      <AdminNav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Minták</h1>
          <Link
            href="/admin/clipart/new"
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Új minta
          </Link>
        </div>

        {items.length === 0 ? (
          <p className="text-gray-500">Még nincs minta.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Előnézet</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Név</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Kategória</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Állapot</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded">
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
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
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
                        <ClipartToggleButton
                          clipartId={item.id}
                          active={item.active}
                        />
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
