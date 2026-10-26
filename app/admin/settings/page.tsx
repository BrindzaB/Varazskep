import AdminNav from "@/components/admin/AdminNav";
import ShopSettingsForm from "@/components/admin/ShopSettingsForm";
import { getShopSettings } from "@/lib/services/shopSettings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getShopSettings();

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-gray-900">Beállítások</h1>
        <ShopSettingsForm initial={settings} />
      </main>
    </div>
  );
}
