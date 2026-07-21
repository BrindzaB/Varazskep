import AdminNav from "@/components/admin/AdminNav";
import { getDispatchableOrders } from "@/lib/services/order";
import DeliveryNoteForm from "@/components/admin/DeliveryNoteForm";

export const dynamic = "force-dynamic";

export default async function AdminShippingPage() {
  const orders = await getDispatchableOrders();
  const items = orders.map((o) => ({
    id: o.id,
    trackingNumber: o.kvikkTrackingNumber ?? "",
    courier: o.shippingCourier ?? "",
    customerName: o.customerName,
    productName: o.productName,
  }));

  return (
    <div>
      <AdminNav />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">
          Futárrendelés
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Válaszd ki a feladott (címkével rendelkező), még futárrendelésre nem
          került csomagokat, add meg a felvételi dátumot, és kérj futárt. A
          létrejövő szállítólevél PDF-je futáronként letölthető.
        </p>
        <DeliveryNoteForm orders={items} />
      </main>
    </div>
  );
}
