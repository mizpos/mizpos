/**
 * Payment Terminal Pairing Store
 *
 * mizpos-payment-terminalとのペアリング状態を管理
 * PINコードでペアリングし、決済リクエストを送信・結果をポーリングで取得
 */

import { createSalesClient } from "@mizpos/api";
import { create } from "zustand";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Sales APIクライアント（API Gatewayの/salesプレフィックスを追加）
const salesClient = createSalesClient({
  baseUrl: `${API_BASE_URL}/sales`,
  headers: {
    "Content-Type": "application/json",
  },
});

/** ペアリング状態 */
export type PairingStatus =
  | "disconnected" // 未接続
  | "registering" // 登録中
  | "waiting" // ターミナル接続待ち
  | "connected" // 接続済み
  | "error"; // エラー

/** 決済リクエストの状態 */
export type PaymentRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed";

/** 決済リクエスト */
export interface PaymentRequest {
  requestId: string;
  pinCode: string;
  amount: number;
  currency: string;
  description?: string;
  saleId?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  status: PaymentRequestStatus;
  paymentIntentId?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** ペアリング情報 */
export interface PairingInfo {
  pinCode: string;
  posId: string;
  posName: string;
  eventId?: string;
  eventName?: string;
  createdAt: Date;
  expiresAt: Date;
}

interface PairingState {
  // ペアリング状態
  status: PairingStatus;
  pairingInfo: PairingInfo | null;
  error: string | null;

  // 決済リクエスト
  currentPaymentRequest: PaymentRequest | null;

  // ポーリング
  isPolling: boolean;
  isPairingStatusPolling: boolean;

  // アクション
  registerPairing: (
    posId: string,
    posName: string,
    eventId?: string,
    eventName?: string,
  ) => Promise<string>;
  unregisterPairing: () => Promise<void>;
  createPaymentRequest: (
    amount: number,
    items?: Array<{ name: string; quantity: number; price: number }>,
    saleId?: string,
    description?: string,
  ) => Promise<PaymentRequest>;
  cancelPaymentRequest: () => Promise<void>;
  pollPaymentResult: () => Promise<PaymentRequest | null>;
  pollPairingStatus: () => Promise<boolean>;
  startPolling: () => void;
  stopPolling: () => void;
  startPairingStatusPolling: () => void;
  stopPairingStatusPolling: () => void;
  clearError: () => void;
  reset: () => void;
}

/** 6桁のPINコードを生成 */
function generatePinCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** QRコードデータを生成 */
export function generateQRCodeData(pinCode: string): string {
  return `mizpos://pair?pin=${pinCode}`;
}

export const usePairingStore = create<PairingState>((set, get) => {
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let pairingStatusPollingInterval: ReturnType<typeof setInterval> | null = null;

  return {
    status: "disconnected",
    pairingInfo: null,
    error: null,
    currentPaymentRequest: null,
    isPolling: false,
    isPairingStatusPolling: false,

    /**
     * ペアリングを登録（PINコードを生成してサーバーに登録）
     */
    registerPairing: async (posId, posName, eventId, eventName) => {
      set({ status: "registering", error: null });

      const pinCode = generatePinCode();

      try {
        const { error } = await salesClient.POST("/terminal/pairing/register", {
          body: {
            pin_code: pinCode,
            pos_id: posId,
            pos_name: posName,
            event_id: eventId,
            event_name: eventName,
          },
        });

        if (error) {
          throw new Error("Failed to register pairing");
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24時間後

        const pairingInfo: PairingInfo = {
          pinCode,
          posId,
          posName,
          eventId,
          eventName,
          createdAt: now,
          expiresAt,
        };

        set({
          status: "waiting",
          pairingInfo,
        });

        // ターミナル接続待ちのポーリングを開始
        get().startPairingStatusPolling();

        console.log("Pairing registered with PIN:", pinCode);
        return pinCode;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "ペアリング登録に失敗しました";
        set({ status: "error", error: message });
        throw new Error(message);
      }
    },

    /**
     * ペアリングを解除
     */
    unregisterPairing: async () => {
      const { pairingInfo } = get();

      // ポーリングを停止
      get().stopPolling();
      get().stopPairingStatusPolling();

      if (pairingInfo?.pinCode) {
        try {
          await salesClient.DELETE("/terminal/pairing/{pin_code}", {
            params: { path: { pin_code: pairingInfo.pinCode } },
          });
        } catch (err) {
          console.error("Failed to delete pairing on server:", err);
        }
      }

      set({
        status: "disconnected",
        pairingInfo: null,
        currentPaymentRequest: null,
        error: null,
      });

      console.log("Pairing unregistered");
    },

    /**
     * 決済リクエストを作成
     */
    createPaymentRequest: async (amount, items, saleId, description) => {
      const { pairingInfo } = get();

      if (!pairingInfo) {
        throw new Error("ペアリングされていません");
      }

      console.log("[Desktop] Creating payment request:", {
        pin_code: pairingInfo.pinCode,
        amount,
        items_count: items?.length,
      });

      try {
        const { data, error, response } = await salesClient.POST(
          "/terminal/payment-requests",
          {
            body: {
              pin_code: pairingInfo.pinCode,
              amount,
              currency: "jpy",
              description,
              sale_id: saleId,
              items,
            },
          },
        );

        console.log("[Desktop] createPaymentRequest response status:", response?.status);

        if (error || !data) {
          console.error("[Desktop] createPaymentRequest error:", error);
          throw new Error(`Failed to create payment request: ${response?.status}`);
        }

        const apiResponse = data as unknown as {
          payment_request: {
            request_id: string;
            pin_code: string;
            amount: number;
            currency: string;
            description?: string;
            sale_id?: string;
            items?: Array<{ name: string; quantity: number; price: number }>;
            status: PaymentRequestStatus;
            payment_intent_id?: string;
            error_message?: string;
            created_at: string;
            updated_at: string;
          };
        };

        const paymentRequest: PaymentRequest = {
          requestId: apiResponse.payment_request.request_id,
          pinCode: apiResponse.payment_request.pin_code,
          amount: apiResponse.payment_request.amount,
          currency: apiResponse.payment_request.currency,
          description: apiResponse.payment_request.description,
          saleId: apiResponse.payment_request.sale_id,
          items: apiResponse.payment_request.items,
          status: apiResponse.payment_request.status,
          paymentIntentId: apiResponse.payment_request.payment_intent_id,
          errorMessage: apiResponse.payment_request.error_message,
          createdAt: new Date(apiResponse.payment_request.created_at),
          updatedAt: new Date(apiResponse.payment_request.updated_at),
        };

        set({
          currentPaymentRequest: paymentRequest,
          status: "connected",
        });

        console.log("Payment request created:", paymentRequest.requestId);
        return paymentRequest;
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "決済リクエストの作成に失敗しました";
        set({ error: message });
        throw new Error(message);
      }
    },

    /**
     * 決済リクエストをキャンセル
     */
    cancelPaymentRequest: async () => {
      const { currentPaymentRequest } = get();

      if (!currentPaymentRequest) {
        return;
      }

      try {
        await salesClient.DELETE("/terminal/payment-requests/{request_id}", {
          params: { path: { request_id: currentPaymentRequest.requestId } },
        });

        set({ currentPaymentRequest: null });
        console.log("Payment request cancelled");
      } catch (err) {
        console.error("Failed to cancel payment request:", err);
      }
    },

    /**
     * 決済結果をポーリングで取得
     */
    pollPaymentResult: async () => {
      const { currentPaymentRequest } = get();

      if (!currentPaymentRequest) {
        return null;
      }

      try {
        const { data, error, response: httpResponse } = await salesClient.GET(
          "/terminal/payment-requests/{request_id}",
          {
            params: { path: { request_id: currentPaymentRequest.requestId } },
          },
        );

        if (error || !data) {
          console.error("[Desktop] pollPaymentResult error:", error, "status:", httpResponse?.status);
          return null;
        }

        const apiResponse = data as unknown as {
          payment_request: {
            request_id: string;
            pin_code: string;
            amount: number;
            currency: string;
            description?: string;
            sale_id?: string;
            items?: Array<{ name: string; quantity: number; price: number }>;
            status: PaymentRequestStatus;
            payment_intent_id?: string;
            error_message?: string;
            created_at: string;
            updated_at: string;
          };
        };

        const updatedRequest: PaymentRequest = {
          requestId: apiResponse.payment_request.request_id,
          pinCode: apiResponse.payment_request.pin_code,
          amount: apiResponse.payment_request.amount,
          currency: apiResponse.payment_request.currency,
          description: apiResponse.payment_request.description,
          saleId: apiResponse.payment_request.sale_id,
          items: apiResponse.payment_request.items,
          status: apiResponse.payment_request.status,
          paymentIntentId: apiResponse.payment_request.payment_intent_id,
          errorMessage: apiResponse.payment_request.error_message,
          createdAt: new Date(apiResponse.payment_request.created_at),
          updatedAt: new Date(apiResponse.payment_request.updated_at),
        };

        set({ currentPaymentRequest: updatedRequest });

        // 決済完了またはエラーの場合はポーリング停止
        if (
          updatedRequest.status === "completed" ||
          updatedRequest.status === "cancelled" ||
          updatedRequest.status === "failed"
        ) {
          get().stopPolling();
        }

        return updatedRequest;
      } catch (err) {
        console.error("Failed to poll payment result:", err);
        return null;
      }
    },

    /**
     * ポーリングを開始
     */
    startPolling: () => {
      if (pollingInterval) {
        return;
      }

      set({ isPolling: true });

      pollingInterval = setInterval(async () => {
        await get().pollPaymentResult();
      }, 2000); // 2秒間隔

      console.log("Started polling for payment result");
    },

    /**
     * ポーリングを停止
     */
    stopPolling: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      set({ isPolling: false });
      console.log("Stopped polling");
    },

    /**
     * ペアリング状態をポーリングで取得（ターミナル接続検知用）
     */
    pollPairingStatus: async () => {
      const { pairingInfo, status } = get();

      if (!pairingInfo || status !== "waiting") {
        return false;
      }

      try {
        const { data, error, response } = await salesClient.GET(
          "/terminal/pairing/{pin_code}",
          {
            params: { path: { pin_code: pairingInfo.pinCode } },
          },
        );

        if (error || !data) {
          console.error("[Desktop] pollPairingStatus error:", error, "status:", response?.status);
          return false;
        }

        const apiResponse = data as unknown as {
          pairing: {
            pin_code: string;
            pos_id: string;
            pos_name: string;
            event_id?: string;
            event_name?: string;
            terminal_connected: boolean;
            terminal_connected_at?: string;
            created_at: string;
            expires_at: string;
          };
        };

        if (apiResponse.pairing.terminal_connected) {
          console.log("[Desktop] Terminal connected!");
          get().stopPairingStatusPolling();
          set({ status: "connected" });
          return true;
        }

        return false;
      } catch (err) {
        console.error("Failed to poll pairing status:", err);
        return false;
      }
    },

    /**
     * ペアリング状態のポーリングを開始
     */
    startPairingStatusPolling: () => {
      if (pairingStatusPollingInterval) {
        return;
      }

      set({ isPairingStatusPolling: true });

      pairingStatusPollingInterval = setInterval(async () => {
        await get().pollPairingStatus();
      }, 3000); // 3秒間隔

      console.log("[Desktop] Started polling for pairing status");
    },

    /**
     * ペアリング状態のポーリングを停止
     */
    stopPairingStatusPolling: () => {
      if (pairingStatusPollingInterval) {
        clearInterval(pairingStatusPollingInterval);
        pairingStatusPollingInterval = null;
      }

      set({ isPairingStatusPolling: false });
      console.log("[Desktop] Stopped pairing status polling");
    },

    /**
     * エラーをクリア
     */
    clearError: () => {
      set({ error: null });
    },

    /**
     * 状態をリセット
     */
    reset: () => {
      get().stopPolling();
      get().stopPairingStatusPolling();
      set({
        status: "disconnected",
        pairingInfo: null,
        error: null,
        currentPaymentRequest: null,
        isPolling: false,
        isPairingStatusPolling: false,
      });
    },
  };
});
