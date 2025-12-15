/**
 * Pairing Provider
 *
 * mizpos-desktopとのペアリング状態を管理
 * QRコードやPINコードでペアリングし、決済リクエストをポーリングで受け取る
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';

import {
  verifyPairing,
  deletePairing,
  getPendingPaymentRequest,
  updatePaymentRequestResult,
  type PairingInfo as ApiPairingInfo,
  type PaymentRequest as ApiPaymentRequest,
} from '@/services/api';

// ==========================================
// 型定義
// ==========================================

/**
 * ペアリング情報
 */
export interface PairingInfo {
  pinCode: string;
  posId: string;
  posName: string;
  pairedAt: Date;
  expiresAt: Date;
  eventId?: string;
  eventName?: string;
}

/**
 * 決済リクエスト
 */
export interface PaymentRequest {
  id: string;
  amount: number;
  currency: string;
  description?: string;
  saleId?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  createdAt: Date;
}

/**
 * 決済結果
 */
export interface PaymentResult {
  requestId: string;
  success: boolean;
  paymentIntentId?: string;
  error?: string;
  completedAt: Date;
}

interface PairingContextValue {
  // ペアリング状態
  isPaired: boolean;
  pairingInfo: PairingInfo | null;
  isPolling: boolean;

  // ペアリング操作
  pairWithQRCode: (qrData: string) => Promise<void>;
  pairWithPIN: (pinCode: string) => Promise<void>;
  unpair: () => Promise<void>;

  // 決済リクエスト
  currentPaymentRequest: PaymentRequest | null;
  paymentHistory: PaymentResult[];
  completePayment: (paymentIntentId: string) => Promise<void>;
  cancelPayment: () => Promise<void>;

  // エラー
  error: string | null;
  clearError: () => void;
}

const PairingContext = createContext<PairingContextValue | null>(null);

// ==========================================
// Provider
// ==========================================

// ポーリング間隔（ミリ秒）
const POLLING_INTERVAL = 3000;

interface PairingProviderProps {
  children: ReactNode;
}

export function PairingProvider({ children }: PairingProviderProps) {
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [currentPaymentRequest, setCurrentPaymentRequest] =
    useState<PaymentRequest | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // ポーリング用の参照
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  /**
   * APIレスポンスをローカル型に変換
   */
  const convertApiPairing = (api: ApiPairingInfo): PairingInfo => ({
    pinCode: api.pin_code,
    posId: api.pos_id,
    posName: api.pos_name,
    pairedAt: new Date(api.created_at),
    expiresAt: new Date(api.expires_at),
    eventId: api.event_id,
    eventName: api.event_name,
  });

  const convertApiPaymentRequest = (api: ApiPaymentRequest): PaymentRequest => ({
    id: api.request_id,
    amount: api.amount,
    currency: api.currency,
    description: api.description,
    saleId: api.sale_id,
    items: api.items,
    createdAt: new Date(api.created_at),
  });

  /**
   * QRコードからPINコードを抽出
   */
  const extractPinFromQRCode = (qrData: string): string | null => {
    try {
      if (!qrData.startsWith('mizpos://pair')) {
        return null;
      }

      const url = new URL(qrData.replace('mizpos://', 'https://'));
      return url.searchParams.get('pin');
    } catch {
      return null;
    }
  };

  /**
   * ポーリングを開始
   */
  const startPolling = useCallback((pinCode: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    setIsPolling(true);
    console.log('Starting payment request polling for PIN:', pinCode);

    const poll = async () => {
      try {
        const request = await getPendingPaymentRequest(pinCode);

        if (request && request.request_id !== currentRequestIdRef.current) {
          console.log('New payment request received:', request);
          currentRequestIdRef.current = request.request_id;
          setCurrentPaymentRequest(convertApiPaymentRequest(request));
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    // 即時実行
    poll();

    // 定期実行
    pollingRef.current = setInterval(poll, POLLING_INTERVAL);
  }, []);

  /**
   * ポーリングを停止
   */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
    console.log('Stopped payment request polling');
  }, []);

  /**
   * QRコードでペアリング
   */
  const pairWithQRCode = useCallback(async (qrData: string) => {
    setError(null);

    const pinCode = extractPinFromQRCode(qrData);
    if (!pinCode) {
      setError('QRコードの形式が正しくありません');
      return;
    }

    try {
      const apiPairing = await verifyPairing(pinCode);
      const info = convertApiPairing(apiPairing);
      setPairingInfo(info);
      startPolling(pinCode);
      console.log('Paired with QR code:', info);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ペアリングに失敗しました';
      setError(message);
      console.error('QR pairing error:', err);
    }
  }, [startPolling]);

  /**
   * PINコードでペアリング
   */
  const pairWithPIN = useCallback(async (pinCode: string) => {
    setError(null);

    if (!/^\d{6}$/.test(pinCode)) {
      setError('PINコードは6桁の数字で入力してください');
      return;
    }

    try {
      const apiPairing = await verifyPairing(pinCode);
      const info = convertApiPairing(apiPairing);
      setPairingInfo(info);
      startPolling(pinCode);
      console.log('Paired with PIN:', pinCode);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PINコードが見つかりません';
      setError(message);
      console.error('PIN pairing error:', err);
    }
  }, [startPolling]);

  /**
   * ペアリング解除
   */
  const unpair = useCallback(async () => {
    stopPolling();

    if (pairingInfo?.pinCode) {
      try {
        await deletePairing(pairingInfo.pinCode);
      } catch (err) {
        console.error('Failed to delete pairing on server:', err);
      }
    }

    setPairingInfo(null);
    setCurrentPaymentRequest(null);
    currentRequestIdRef.current = null;
    console.log('Unpaired');
  }, [pairingInfo, stopPolling]);

  /**
   * 決済を完了
   */
  const completePayment = useCallback(async (paymentIntentId: string) => {
    if (!currentPaymentRequest) return;

    try {
      await updatePaymentRequestResult(currentPaymentRequest.id, {
        status: 'completed',
        payment_intent_id: paymentIntentId,
      });

      const result: PaymentResult = {
        requestId: currentPaymentRequest.id,
        success: true,
        paymentIntentId,
        completedAt: new Date(),
      };
      setPaymentHistory((prev) => [...prev, result]);
      setCurrentPaymentRequest(null);
      currentRequestIdRef.current = null;

      console.log('Payment completed:', result);
    } catch (err) {
      console.error('Failed to report payment completion:', err);
    }
  }, [currentPaymentRequest]);

  /**
   * 決済をキャンセル
   */
  const cancelPayment = useCallback(async () => {
    if (!currentPaymentRequest) return;

    try {
      await updatePaymentRequestResult(currentPaymentRequest.id, {
        status: 'cancelled',
        error_message: 'ユーザーによりキャンセルされました',
      });

      const result: PaymentResult = {
        requestId: currentPaymentRequest.id,
        success: false,
        error: 'キャンセルされました',
        completedAt: new Date(),
      };
      setPaymentHistory((prev) => [...prev, result]);
      setCurrentPaymentRequest(null);
      currentRequestIdRef.current = null;

      console.log('Payment cancelled');
    } catch (err) {
      console.error('Failed to report payment cancellation:', err);
    }
  }, [currentPaymentRequest]);

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const contextValue: PairingContextValue = {
    isPaired: pairingInfo !== null,
    pairingInfo,
    isPolling,
    pairWithQRCode,
    pairWithPIN,
    unpair,
    currentPaymentRequest,
    paymentHistory,
    completePayment,
    cancelPayment,
    error,
    clearError,
  };

  return (
    <PairingContext.Provider value={contextValue}>
      {children}
    </PairingContext.Provider>
  );
}

// ==========================================
// Hook
// ==========================================

export function usePairing(): PairingContextValue {
  const context = useContext(PairingContext);
  if (!context) {
    throw new Error('usePairing must be used within a PairingProvider');
  }
  return context;
}
