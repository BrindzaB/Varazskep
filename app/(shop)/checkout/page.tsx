import type { Metadata } from "next";
import CheckoutForm from "@/components/shop/CheckoutForm";

export const metadata: Metadata = {
  title: "Fizetés – Varázskép",
};

export default function CheckoutPage() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-layout">
        <h1 className="mb-10 text-3xl font-bold text-charcoal">Fizetés</h1>
        <CheckoutForm />
      </div>
    </section>
  );
}
