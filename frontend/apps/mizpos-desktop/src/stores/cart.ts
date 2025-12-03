import { create } from "zustand";
import type { CartItem, Product } from "../types";

interface CartState {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
  getSubtotal: () => number;
  getTaxAmount: (taxRate: number) => number;
  getTotal: (taxRate: number) => number;
  getTotalQuantity: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (product: Product, quantity = 1) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.product.id === product.id,
      );

      if (existingIndex >= 0) {
        const newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
        };
        return { items: newItems };
      }

      return { items: [...state.items, { product, quantity }] };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    }));
  },

  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      ),
    }));
  },

  clear: () => {
    set({ items: [] });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
  },

  getTaxAmount: (taxRate: number) => {
    const subtotal = get().getSubtotal();
    return Math.floor(subtotal * (taxRate / 100));
  },

  getTotal: (taxRate: number) => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount(taxRate);
    return subtotal + tax;
  },

  getTotalQuantity: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
