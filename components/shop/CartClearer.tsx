"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart/cartStore";

// Rendered on the order confirmation page to clear the cart after a successful payment.
// Must be a client component because the cart lives in Zustand (client-only state).
export default function CartClearer() {
  const clearCart = useCartStore((state) => state.clearCart);

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return null;
}
