"use client";

import Link from "next/link";
import { useCartStore } from "@/lib/cart/cartStore";
import CartItemRow from "@/components/shop/CartItem";
import { formatHuf } from "@/lib/utils/format";

export default function CartPage() {
  const { items, totalItems, totalPrice } = useCartStore();

  if (items.length === 0) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-layout">
          <h1 className="text-3xl font-bold text-charcoal">Kosár</h1>
          <p className="mt-6 text-base text-muted">A kosara üres.</p>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark"
          >
            Termékek böngészése
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-layout">
        <h1 className="text-3xl font-bold text-charcoal">
          Kosár ({totalItems()} termék)
        </h1>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Item list */}
          <div className="lg:col-span-2">
            {items.map((item) => (
              <CartItemRow key={item.variantId} item={item} />
            ))}
          </div>

          {/* Order summary */}
          <div className="h-fit rounded border border-border-light bg-white p-6">
            <h2 className="text-base font-semibold text-charcoal">
              Rendelés összesítő
            </h2>

            <div className="mt-4 space-y-2">
              {items.map((item) => (
                <div
                  key={item.variantId}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted">
                    {item.productName} × {item.quantity}
                  </span>
                  <span className="text-charcoal">
                    {formatHuf(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-border-light pt-4">
              <div className="flex justify-between text-base font-semibold text-charcoal">
                <span>Összesen</span>
                <span>{formatHuf(totalPrice())}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Az ár tartalmazza az ÁFÁ-t</p>
            </div>

            {/* Checkout CTA — wired in Step 2.2 */}
            <Link
              href="/checkout"
              className="mt-6 block rounded-sm bg-charcoal px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark"
            >
              Tovább a fizetéshez
            </Link>

            <Link
              href="/products"
              className="mt-3 block text-center text-sm text-muted underline-offset-2 hover:underline"
            >
              Vásárlás folytatása
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
