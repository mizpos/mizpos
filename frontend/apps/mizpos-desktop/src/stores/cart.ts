/**
 * カート状態管理ストア
 */

import { create } from "zustand";
import { applyCoupon as applyCouponApi, recordSale } from "../lib/api";
import { addSale, addToOfflineQueue, getTerminalId } from "../lib/db";
import type { AppliedCoupon, CartItem, Product, SaleRecord } from "../types";
import { useAuthStore } from "./auth";
import { useNetworkStore } from "./network";

interface CartState {
  // 状態
  items: CartItem[];
  appliedCoupon: AppliedCoupon | null;
  discountAmount: number;
  isProcessing: boolean;
  lastSale: SaleRecord | null;
  error: string | null;

  // 計算プロパティ
  totalItems: number;
  subtotal: number; // 割引前
  totalAmount: number; // 割引後

  // アクション
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => void;
  checkout: (
    paymentMethod: "cash" | "card" | "other",
  ) => Promise<SaleRecord | null>;
  clearLastSale: () => void;
  clearError: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  // 初期状態
  items: [],
  appliedCoupon: null,
  discountAmount: 0,
  isProcessing: false,
  lastSale: null,
  error: null,

  // 計算プロパティ（getterとして実装）
  get totalItems() {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  get subtotal() {
    return get().items.reduce((sum, item) => sum + item.subtotal, 0);
  },

  get totalAmount() {
    const { subtotal, discountAmount } = get();
    return Math.max(0, subtotal - discountAmount);
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
    set({ items: [], appliedCoupon: null, discountAmount: 0, error: null });
  },

  // クーポン適用
  applyCoupon: async (code: string) => {
    const session = useAuthStore.getState().session;
    const networkStatus = useNetworkStore.getState().status;
    const { subtotal } = get();

    if (!session) {
      set({ error: "ログインが必要です" });
      return false;
    }

    if (networkStatus !== "online") {
      set({ error: "クーポン適用にはインターネット接続が必要です" });
      return false;
    }

    if (subtotal === 0) {
      set({ error: "カートに商品がありません" });
      return false;
    }

    try {
      const result = await applyCouponApi(session.session_id, code, subtotal);

      set({
        appliedCoupon: {
          coupon_id: result.coupon_id,
          code: result.code,
          name: result.name,
          discount_type: result.discount_type,
          discount_value: result.discount_value,
          discount_amount: result.discount_amount,
        },
        discountAmount: result.discount_amount,
        error: null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "クーポンの適用に失敗しました";
      set({ error: message });
      return false;
    }
  },

  // クーポン解除
  removeCoupon: () => {
    set({ appliedCoupon: null, discountAmount: 0 });
  },

  // チェックアウト（販売処理）
  checkout: async (paymentMethod: "cash" | "card" | "other") => {
    const state = get();
    const { items, appliedCoupon, discountAmount } = state;
    // getter プロパティは直接計算する（Zustandのget()ではgetterが動作しない）
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const totalAmount = Math.max(0, subtotal - discountAmount);
    const session = useAuthStore.getState().session;
    const networkStatus = useNetworkStore.getState().status;
    const isOnline = networkStatus === "online";

    if (items.length === 0) {
      set({ error: "カートが空です" });
      return null;
    }

    if (!session) {
      set({ error: "ログインが必要です" });
      return null;
    }

    // カード決済はオンライン必須
    if (paymentMethod === "card" && !isOnline) {
      set({ error: "カード決済にはインターネット接続が必要です" });
      return null;
    }

    set({ isProcessing: true, error: null });

    try {
      const terminalId = await getTerminalId();
      const timestamp = Date.now();

      // オンラインの場合: サーバーで決済処理を先に行う
      if (isOnline) {
        try {
          const serverResponse = await recordSale(session.session_id, {
            items: items.map((item) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.product.price,
            })),
            total_amount: totalAmount,
            payment_method: paymentMethod,
            event_id: session.event_id,
            terminal_id: terminalId,
          });

          // サーバーから返されたsale_idを使用（クレジット決済の追跡用）
          const saleRecord: SaleRecord = {
            sale_id: serverResponse.sale_id,
            timestamp,
            items,
            subtotal,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            received_amount: totalAmount, // 満額受領として記録
            payment_method: paymentMethod,
            employee_number: session.employee_number,
            event_id: session.event_id,
            terminal_id: terminalId,
            synced: true,
            created_at: timestamp,
            coupon: appliedCoupon || undefined,
          };

          // ローカルにも保存（履歴参照用）
          await addSale(saleRecord);

          set({
            items: [],
            appliedCoupon: null,
            discountAmount: 0,
            isProcessing: false,
            lastSale: saleRecord,
            error: null,
          });

          useNetworkStore.getState().updateSyncStatus();
          return saleRecord;
        } catch (apiError) {
          // カード決済の場合はサーバーエラーで中断
          if (paymentMethod === "card") {
            const message =
              apiError instanceof Error
                ? apiError.message
                : "カード決済処理に失敗しました";
            set({ isProcessing: false, error: message });
            return null;
          }

          // 現金・その他の場合はオフラインモードにフォールバック
          console.warn(
            "Server unavailable, falling back to offline mode:",
            apiError,
          );
        }
      }

      // オフラインモード（現金・その他のみ）
      const saleId = crypto.randomUUID();
      const saleRecord: SaleRecord = {
        sale_id: saleId,
        timestamp,
        items,
        subtotal,
        discount_amount: discountAmount,
        total_amount: totalAmount,
        received_amount: totalAmount, // 満額受領として記録
        payment_method: paymentMethod,
        coupon: appliedCoupon || undefined,
        employee_number: session.employee_number,
        event_id: session.event_id,
        terminal_id: terminalId,
        synced: false,
        created_at: timestamp,
      };

      // ローカルに保存
      await addSale(saleRecord);
      // オフラインキューに追加
      await addToOfflineQueue(saleRecord);

      set({
        items: [],
        appliedCoupon: null,
        discountAmount: 0,
        isProcessing: false,
        lastSale: saleRecord,
        error: null,
      });

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
