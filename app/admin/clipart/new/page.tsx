import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ClipartUploadForm from "@/components/admin/ClipartUploadForm";
import { getAllCategoriesAdmin } from "@/lib/services/clipart";

export default async function NewClipartPage() {
  const existingCategories = await getAllCategoriesAdmin();

  return (
    <div>
      <AdminNav />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/admin/clipart"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Clipartok
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">Új clipart</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Új clipart feltöltése</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ClipartUploadForm existingCategories={existingCategories} />
        </div>
      </main>
    </div>
  );
}
