import type { Metadata } from "next";
import OrderForm from "@/components/shop/OrderForm";
import { getOrderFormCatalog } from "@/lib/services/orderForm";

export const metadata: Metadata = {
  title: "Megrendelő lap – Varázskép",
  description:
    "Gyors megrendelés nagyobb, céges tételekhez: válaszd ki a termékeket, töltsd fel a mintát, és mi felvesszük veled a kapcsolatot.",
};

// Rendered per request so admin changes to the featured list show up immediately; the
// Malfini catalogue itself comes from the module/Redis cache.
export const dynamic = "force-dynamic";

export default async function OrderFormPage() {
  const products = await getOrderFormCatalog();

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold uppercase text-brand-blue">
          Megrendelő lap
        </h1>
        <p className="mb-8 text-muted">
          Nagyobb darabszámú, céges rendelésekhez. Add meg a termékeket és a
          darabszámokat, töltsd fel a mintát vagy logót, és mi felvesszük veled a
          kapcsolatot az ár, a határidő és az átvétel egyeztetése miatt. Fizetni
          most nem kell.
        </p>
        <OrderForm products={products} />
      </div>
    </section>
  );
}
