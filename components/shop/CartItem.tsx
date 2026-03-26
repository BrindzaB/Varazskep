"use client";

import { useCartStore, type CartItem } from "@/lib/cart/cartStore";
import { formatHuf } from "@/lib/utils/format";

interface CartItemProps {
  item: CartItem;
}

export default function CartItemRow({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCartStore();

  return (
    <div className="flex items-start gap-4 border-b border-border-light py-6 last:border-0">
      {/* Image */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded border border-border-light bg-off-white">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-border-medium"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-base font-semibold text-charcoal">
          {item.productName}
        </p>
        <p className="text-sm text-muted">
          {item.color}, {item.size}
        </p>
        <p className="text-sm font-medium text-charcoal">
          {formatHuf(item.price)}
        </p>
      </div>

      {/* Quantity stepper + remove */}
      <div className="flex flex-col items-end gap-3">
        <div className="flex items-center rounded border border-border-light">
          <button
            onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
            aria-label="Mennyiség csökkentése"
            className="px-3 py-1.5 text-charcoal transition-colors hover:bg-off-white"
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-sm font-medium text-charcoal">
            {item.quantity}
          </span>
          <button
            onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
            aria-label="Mennyiség növelése"
            className="px-3 py-1.5 text-charcoal transition-colors hover:bg-off-white"
          >
            +
          </button>
        </div>
        <button
          onClick={() => removeItem(item.variantId)}
          className="text-xs text-muted underline-offset-2 hover:underline"
        >
          Eltávolítás
        </button>
      </div>
    </div>
  );
}
