import { notFound } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import ClipartEditForm from "@/components/admin/ClipartEditForm";
import {
  getClipartByIdAdmin,
  getAllCategoriesAdmin,
} from "@/lib/services/clipart";

export const dynamic = "force-dynamic";

export default async function EditClipartPage({
  params,
}: {
  params: { id: string };
}) {
  const [clipart, categories] = await Promise.all([
    getClipartByIdAdmin(params.id),
    getAllCategoriesAdmin(),
  ]);
  if (!clipart) notFound();

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/admin/clipart"
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            ← Minták
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-600">{clipart.name}</span>
        </div>
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">
          Minta szerkesztése
        </h1>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <ClipartEditForm
            clipartId={clipart.id}
            initialValues={{
              name: clipart.name,
              category: clipart.category,
              svgUrl: clipart.svgUrl,
              darkSvgUrl: clipart.darkSvgUrl,
            }}
            existingCategories={categories}
          />
        </div>
      </main>
    </div>
  );
}
