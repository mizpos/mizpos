import { create } from "zustand";
import type { CartItem, Product } from "../types";

/**
 * 適用されたクーポン情報
 */
export interface AppliedCoupon {
  code: string;
  name: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  discountAmount: number; // 計算済みの割引額
}

interface CartState {
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  applyCoupon: (coupon: AppliedCoupon) => void;
  removeCoupon: () => void;
  clear: () => void;
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTaxAmount: (taxRate: number) => number;
  getTotal: (taxRate: number) => number;
  getTotalQuantity: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  appliedCoupon: null,

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

  applyCoupon: (coupon: AppliedCoupon) => {
    set({ appliedCoupon: coupon });
  },

  removeCoupon: () => {
    set({ appliedCoupon: null });
  },

  clear: () => {
    set({ items: [], appliedCoupon: null });
  },

  getSubtotal: () => {
    const { items } = get();
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
  },

  getDiscountAmount: () => {
    const { appliedCoupon } = get();
    return appliedCoupon?.discountAmount ?? 0;
  },

  getTaxAmount: (taxRate: number) => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    const total = subtotal - discount;
    // 内税方式: 税込価格から税額を逆算
    // 税額 = 合計 × 税率 / (100 + 税率)
    return Math.floor((total * taxRate) / (100 + taxRate));
  },

  getTotal: (_taxRate: number) => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    // 内税方式: 商品価格は税込みなので、合計 = 小計 - 割引
    return subtotal - discount;
  },

  getTotalQuantity: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
