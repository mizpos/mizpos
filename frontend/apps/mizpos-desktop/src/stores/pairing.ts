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

/** カード詳細情報（レシート表示用） */
export interface CardDetails {
  brand?: string; // カードブランド（visa, mastercard等）
  last4?: string; // カード番号下4桁
  expMonth?: number; // 有効期限（月）
  expYear?: number; // 有効期限（年）
  cardholderName?: string; // カード名義人
  funding?: string; // カード種別（credit, debit等）
  terminalSerialNumber?: string; // 端末シリアル番号
  transactionType?: string; // 取引種別（sale/refund）
  paymentType?: string; // 支払区分
  transactionAt?: string; // 取引日時（ISO8601形式）
}

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
  cardDetails?: CardDetails;
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
  let pairingStatusPollingInterval: ReturnType<typeof setInterval> | null =
    null;

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

        console.log(
          "[Desktop] createPaymentRequest response status:",
          response?.status,
        );

        if (error || !data) {
          console.error("[Desktop] createPaymentRequest error:", error);
          throw new Error(
            `Failed to create payment request: ${response?.status}`,
          );
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
            card_details?: {
              brand?: string;
              last4?: string;
              exp_month?: number;
              exp_year?: number;
              cardholder_name?: string;
              funding?: string;
              terminal_serial_number?: string;
              transaction_type?: string;
              payment_type?: string;
              transaction_at?: string;
            };
            created_at: string;
            updated_at: string;
          };
        };

        const cd = apiResponse.payment_request.card_details;
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
          cardDetails: cd
            ? {
                brand: cd.brand,
                last4: cd.last4,
                expMonth: cd.exp_month,
                expYear: cd.exp_year,
                cardholderName: cd.cardholder_name,
                funding: cd.funding,
                terminalSerialNumber: cd.terminal_serial_number,
                transactionType: cd.transaction_type,
                paymentType: cd.payment_type,
                transactionAt: cd.transaction_at,
              }
            : undefined,
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
        const {
          data,
          error,
          response: httpResponse,
        } = await salesClient.GET("/terminal/payment-requests/{request_id}", {
          params: { path: { request_id: currentPaymentRequest.requestId } },
        });

        if (error || !data) {
          console.error(
            "[Desktop] pollPaymentResult error:",
            error,
            "status:",
            httpResponse?.status,
          );
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
            card_details?: {
              brand?: string;
              last4?: string;
              exp_month?: number;
              exp_year?: number;
              cardholder_name?: string;
              funding?: string;
              terminal_serial_number?: string;
              transaction_type?: string;
              payment_type?: string;
              transaction_at?: string;
            };
            created_at: string;
            updated_at: string;
          };
        };

        const cd = apiResponse.payment_request.card_details;
        // デバッグ: APIからのcard_detailsを確認
        console.log("[pairing] API card_details:", cd);

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
          cardDetails: cd
            ? {
                brand: cd.brand,
                last4: cd.last4,
                expMonth: cd.exp_month,
                expYear: cd.exp_year,
                cardholderName: cd.cardholder_name,
                funding: cd.funding,
                terminalSerialNumber: cd.terminal_serial_number,
                transactionType: cd.transaction_type,
                paymentType: cd.payment_type,
                transactionAt: cd.transaction_at,
              }
            : undefined,
          createdAt: new Date(apiResponse.payment_request.created_at),
          updatedAt: new Date(apiResponse.payment_request.updated_at),
        };

        set({ currentPaymentRequest: updatedRequest });

        // 決済完了またはエラーの場合はポーリング停止
        // ただし、completedでもpaymentIntentIdまたはcardDetailsがない場合は継続
        // （Payment Terminalからの結果がまだ同期されていない可能性）
        if (
          updatedRequest.status === "cancelled" ||
          updatedRequest.status === "failed" ||
          (updatedRequest.status === "completed" &&
            updatedRequest.paymentIntentId &&
            updatedRequest.cardDetails)
        ) {
          get().stopPolling();
        } else if (
          updatedRequest.status === "completed" &&
          updatedRequest.paymentIntentId &&
          !updatedRequest.cardDetails
        ) {
          // paymentIntentIdはあるがcardDetailsがまだない場合は継続
          console.log(
            "[pairing] Waiting for cardDetails, continuing polling...",
          );
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
     * ペアリング状態をポーリングで取得（ターミナル接続/切断検知用）
     */
    pollPairingStatus: async () => {
      const { pairingInfo, status } = get();

      // disconnected, registering, error の場合はポーリング不要
      if (
        !pairingInfo ||
        status === "disconnected" ||
        status === "registering" ||
        status === "error"
      ) {
        return false;
      }

      try {
        const { data, error, response } = await salesClient.GET(
          "/terminal/pairing/{pin_code}",
          {
            params: { path: { pin_code: pairingInfo.pinCode } },
          },
        );

        // 404の場合はペアリングが削除された（ターミナル側で切断された）
        if (response?.status === 404) {
          console.log("[Desktop] Pairing not found - terminal disconnected");
          get().stopPairingStatusPolling();
          set({
            status: "disconnected",
            pairingInfo: null,
            error: "ターミナルとの接続が切れました",
          });
          return false;
        }

        if (error || !data) {
          console.error(
            "[Desktop] pollPairingStatus error:",
            error,
            "status:",
            response?.status,
          );
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
          if (status === "waiting") {
            console.log("[Desktop] Terminal connected!");
            set({ status: "connected" });
          }
          return true;
        }

        // 接続済みだったのに terminal_connected が false になった場合
        if (status === "connected" && !apiResponse.pairing.terminal_connected) {
          console.log("[Desktop] Terminal disconnected!");
          set({
            status: "waiting",
            error: "ターミナルとの接続が切れました。再接続を待っています...",
          });
          return false;
        }

        return false;
      } catch (err) {
        console.error("Failed to poll pairing status:", err);
        return false;
      }
    },

    /**
     * ペアリング状態のポーリングを開始
     * connected 状態でも切断検知のため継続する
     */
    startPairingStatusPolling: () => {
      if (pairingStatusPollingInterval) {
        return;
      }

      set({ isPairingStatusPolling: true });

      pairingStatusPollingInterval = setInterval(async () => {
        await get().pollPairingStatus();
      }, 5000); // 5秒間隔（接続後は頻繁なチェックは不要）

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
