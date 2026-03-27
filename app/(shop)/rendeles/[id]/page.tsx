import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderBySessionId } from "@/lib/services/order";
import { formatHuf } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Rendelés visszaigazolás – Varázskép",
};

interface Props {
  params: { id: string };
}

export default async function OrderConfirmationPage({ params }: Props) {
  // params.id is the Stripe session ID (cs_...)
  const order = await getOrderBySessionId(params.id);

  if (!order) {
    // The webhook may not have arrived yet — show a processing state.
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-content text-center">
          <div className="mb-6 text-5xl">⏳</div>
          <h1 className="mb-4 text-3xl font-bold text-charcoal">
            Rendelésed feldolgozás alatt...
          </h1>
          <p className="mb-8 text-muted">
            A fizetés sikeres volt. A rendelés rögzítése folyamatban van —
            hamarosan megérkezik a visszaigazoló e-mail.
          </p>
          <Link
            href="/"
            className="inline-block rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark"
          >
            Vissza a főoldalra
          </Link>
        </div>
      </section>
    );
  }

  const shippingAddress = order.shippingAddress as {
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-content">
        {/* Success header */}
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl">✓</div>
          <h1 className="mb-2 text-3xl font-bold text-charcoal">
            Köszönjük a rendelésed!
          </h1>
          <p className="text-muted">
            A visszaigazlást elküldtük a{" "}
            <span className="font-medium text-charcoal">
              {order.customerEmail}
            </span>{" "}
            e-mail címre.
          </p>
        </div>

        {/* Order details card */}
        <div className="rounded border border-border-light bg-white p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-semibold text-charcoal">
              Rendelés részletei
            </h2>
            <span className="text-xs text-muted">#{order.id.slice(-8).toUpperCase()}</span>
          </div>

          <div className="space-y-4">
            {/* Product */}
            <div className="flex justify-between border-b border-border-light pb-4">
              <div>
                <p className="font-medium text-charcoal">
                  {order.variant.product.name}
                </p>
                <p className="text-sm text-muted">
                  {order.variant.color}, {order.variant.size}
                </p>
              </div>
              <p className="font-medium text-charcoal">
                {formatHuf(order.totalAmount)}
              </p>
            </div>

            {/* Shipping address */}
            <div>
              <p className="mb-1 text-sm font-medium text-charcoal">
                Szállítási cím
              </p>
              <p className="text-sm text-muted">
                {shippingAddress.postalCode} {shippingAddress.city},{" "}
                {shippingAddress.address}
              </p>
            </div>

            {/* Total */}
            <div className="flex justify-between border-t border-border-light pt-4">
              <span className="font-semibold text-charcoal">Összesen</span>
              <span className="font-semibold text-charcoal">
                {formatHuf(order.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block rounded-sm bg-charcoal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-charcoal-dark"
          >
            Vissza a főoldalra
          </Link>
        </div>
      </div>
    </section>
  );
}
