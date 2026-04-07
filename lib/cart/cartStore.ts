"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  source: "local" | "malfini";
  // Local only:
  variantId?: string;
  productSlug?: string;
  // Malfini only:
  productSizeCode?: string; // 7-char SKU — primary key for checkout
  productCode?: string;     // 3-char code — for navigating back to product detail
  // Shared (always set):
  productName: string;
  colorName: string;
  sizeName: string;
  price: number; // HUF integer
  quantity: number;
  imageUrl: string | null;
  designId?: string; // set when the item was created in the designer
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

// Stable identity key for a cart item.
// Designed items (designId set): always unique — each design is a distinct line item.
// Malfini items: keyed by productSizeCode.
// Local items: keyed by variantId.
export function itemKey(
  item: Pick<CartItem, "source" | "variantId" | "productSizeCode" | "designId">
): string {
  if (item.designId) return item.designId;
  if (item.source === "malfini") return item.productSizeCode!;
  return item.variantId!;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (incoming) => {
        set((state) => {
          // Designed items are never merged — each design is a distinct line item
          if (incoming.designId) {
            return { items: [...state.items, { ...incoming, quantity: 1 }] };
          }
          const key = itemKey(incoming);
          const existing = state.items.find((i) => itemKey(i) === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...incoming, quantity: 1 }] };
        });
      },

      removeItem: (key) => {
        set((state) => ({
          items: state.items.filter((i) => itemKey(i) !== key),
        }));
      },

      updateQuantity: (key, quantity) => {
        if (quantity < 1) {
          get().removeItem(key);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            itemKey(i) === key ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "varazskep-cart",
      version: 2, // bumped — clears stale carts with old CartItem shape on deploy
    }
  )
);
