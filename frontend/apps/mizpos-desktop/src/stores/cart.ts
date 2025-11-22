/**
 * カート状態管理ストア
 */

import { create } from "zustand";
import { recordSale } from "../lib/api";
import { addSale, addToOfflineQueue, getTerminalId } from "../lib/db";
import type { CartItem, Product, SaleRecord } from "../types";
import { useAuthStore } from "./auth";
import { useNetworkStore } from "./network";

interface CartState {
  // 状態
  items: CartItem[];
  isProcessing: boolean;
  lastSale: SaleRecord | null;
  error: string | null;

  // 計算プロパティ
  totalItems: number;
  totalAmount: number;

  // アクション
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  checkout: (
    paymentMethod: "cash" | "card" | "other",
  ) => Promise<SaleRecord | null>;
  clearLastSale: () => void;
  clearError: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  // 初期状態
  items: [],
  isProcessing: false,
  lastSale: null,
  error: null,

  // 計算プロパティ（getterとして実装）
  get totalItems() {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  get totalAmount() {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  // 商品をカートに追加
  addItem: (product: Product, quantity = 1) => {
    set((state) => {
      const existingItem = state.items.find(
        (item) => item.product_id === product.product_id,
      );

      if (existingItem) {
        // 既存のアイテムの数量を増やす
        return {
          items: state.items.map((item) =>
            item.product_id === product.product_id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  subtotal: (item.quantity + quantity) * product.price,
                }
              : item,
          ),
        };
      }

      // 新しいアイテムを追加
      const newItem: CartItem = {
        product_id: product.product_id,
        product,
        quantity,
        subtotal: product.price * quantity,
      };

      return {
        items: [...state.items, newItem],
      };
    });
  },

  // カートからアイテムを削除
  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.product_id !== productId),
    }));
  },

  // アイテムの数量を更新
  updateQuantity: (productId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) =>
        item.product_id === productId
          ? {
              ...item,
              quantity,
              subtotal: quantity * item.product.price,
            }
          : item,
      ),
    }));
  },

  // カートをクリア
  clearCart: () => {
    set({ items: [], error: null });
  },

  // チェックアウト（販売処理）
  checkout: async (paymentMethod: "cash" | "card" | "other") => {
    const { items } = get();
    const session = useAuthStore.getState().session;
    const networkStatus = useNetworkStore.getState().status;

    if (items.length === 0) {
      set({ error: "カートが空です" });
      return null;
    }

    if (!session) {
      set({ error: "ログインが必要です" });
      return null;
    }

    set({ isProcessing: true, error: null });

    try {
      const terminalId = await getTerminalId();
      const saleId = crypto.randomUUID();
      const timestamp = Date.now();

      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

      // 販売レコードを作成
      const saleRecord: SaleRecord = {
        sale_id: saleId,
        timestamp,
        items,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        employee_number: session.employee_number,
        event_id: session.event_id,
        terminal_id: terminalId,
        synced: false,
        created_at: timestamp,
      };

      // ローカルに保存
      await addSale(saleRecord);

      // オンラインの場合はサーバーに送信
      if (networkStatus === "online") {
        try {
          await recordSale(session.session_id, {
            items: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.product.price,
            })),
            total_amount: totalAmount,
            payment_method: paymentMethod,
            event_id: session.event_id,
          });

          saleRecord.synced = true;
        } catch (apiError) {
          console.error("Failed to sync sale to server:", apiError);
          // オフラインキューに追加
          await addToOfflineQueue(saleRecord);
        }
      } else {
        // オフラインの場合はキューに追加
        await addToOfflineQueue(saleRecord);
      }

      // カートをクリアして結果を設定
      set({
        items: [],
        isProcessing: false,
        lastSale: saleRecord,
        error: null,
      });

      // 同期状態を更新
      useNetworkStore.getState().updateSyncStatus();

      return saleRecord;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "販売処理に失敗しました";
      set({
        isProcessing: false,
        error: message,
      });
      return null;
    }
  },

  // 最後の販売情報をクリア
  clearLastSale: () => {
    set({ lastSale: null });
  },

  // エラーをクリア
  clearError: () => {
    set({ error: null });
  },
}));

// 税込価格計算（必要に応じて）
export function calculateTax(amount: number, taxRate = 0.1): number {
  return Math.floor(amount * taxRate);
}

// 合計金額フォーマット
export function formatPrice(amount: number): string {
  return amount.toLocaleString("ja-JP", {
    style: "currency",
    currency: "JPY",
  });
}
