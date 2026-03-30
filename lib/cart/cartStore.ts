"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: string;
  productName: string;
  productSlug: string;
  color: string;
  size: string;
  price: number; // HUF integer
  quantity: number;
  imageUrl: string | null;
  designId?: string; // set when the item was created in the designer
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (variantId: string, designId?: string) => void;
  updateQuantity: (variantId: string, quantity: number, designId?: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

// Items with a designId are always unique (one design per item).
// Items without a designId are deduplicated by variantId.
function itemKey(item: Pick<CartItem, "variantId" | "designId">): string {
  return item.designId ?? item.variantId;
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
                itemKey(i) === key ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          return { items: [...state.items, { ...incoming, quantity: 1 }] };
        });
      },

      removeItem: (variantId, designId) => {
        set((state) => ({
          items: state.items.filter((i) => {
            if (designId) {
              return !(i.variantId === variantId && i.designId === designId);
            }
            return i.variantId !== variantId;
          }),
        }));
      },

      updateQuantity: (variantId, quantity, designId) => {
        if (quantity < 1) {
          get().removeItem(variantId, designId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => {
            const matches = designId
              ? i.variantId === variantId && i.designId === designId
              : i.variantId === variantId;
            return matches ? { ...i, quantity } : i;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "varazskep-cart",
    },
  ),
);
