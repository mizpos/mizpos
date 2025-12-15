/**
 * Pairing Provider
 *
 * mizpos-desktopとのペアリング状態を管理
 * QRコードやPNRでペアリングし、決済リクエストを受け取る
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

// ==========================================
// 型定義
// ==========================================

/**
 * ペアリング情報
 */
export interface PairingInfo {
  pnr: string;           // ペアリング番号（6桁など）
  posId: string;         // POS端末ID
  posName: string;       // POS端末名
  pairedAt: Date;        // ペアリング日時
  eventId?: string;      // イベントID
  eventName?: string;    // イベント名
}

/**
 * 決済リクエスト
 */
export interface PaymentRequest {
  id: string;            // リクエストID
  amount: number;        // 金額
  currency: string;      // 通貨
  description?: string;  // 説明
  saleId?: string;       // 販売ID
  paymentIntentId?: string;           // Stripe PaymentIntent ID
  paymentIntentClientSecret?: string; // Stripe PaymentIntent client_secret
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

  // ペアリング操作
  pairWithQRCode: (qrData: string) => Promise<void>;
  pairWithPNR: (pnr: string) => Promise<void>;
  unpair: () => void;

  // 決済リクエスト
  currentPaymentRequest: PaymentRequest | null;
  paymentHistory: PaymentResult[];
  completePayment: (paymentIntentId: string) => void;
  cancelPayment: () => void;

  // エラー
  error: string | null;
  clearError: () => void;
}

const PairingContext = createContext<PairingContextValue | null>(null);

// ==========================================
// Provider
// ==========================================

interface PairingProviderProps {
  children: ReactNode;
}

export function PairingProvider({ children }: PairingProviderProps) {
  const [pairingInfo, setPairingInfo] = useState<PairingInfo | null>(null);
  const [currentPaymentRequest, setCurrentPaymentRequest] =
    useState<PaymentRequest | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * QRコードからペアリング情報をパース
   *
   * QRコードのフォーマット例:
   * mizpos://pair?pnr=123456&pos_id=xxx&pos_name=POS1&event_id=yyy&event_name=Event
   */
  const parseQRCode = (qrData: string): PairingInfo | null => {
    try {
      // URLスキームをパース
      if (!qrData.startsWith('mizpos://pair')) {
        throw new Error('Invalid QR code format');
      }

      const url = new URL(qrData.replace('mizpos://', 'https://'));
      const params = url.searchParams;

      const pnr = params.get('pnr');
      const posId = params.get('pos_id');
      const posName = params.get('pos_name');

      if (!pnr || !posId || !posName) {
        throw new Error('Missing required parameters');
      }

      return {
        pnr,
        posId,
        posName,
        pairedAt: new Date(),
        eventId: params.get('event_id') || undefined,
        eventName: params.get('event_name') || undefined,
      };
    } catch (err) {
      console.error('Error parsing QR code:', err);
      return null;
    }
  };

  /**
   * QRコードでペアリング
   */
  const pairWithQRCode = useCallback(async (qrData: string) => {
    setError(null);

    const info = parseQRCode(qrData);
    if (!info) {
      setError('QRコードの形式が正しくありません');
      return;
    }

    // TODO: バックエンドでペアリング情報を検証
    // const response = await verifyPairing(info.pnr);

    setPairingInfo(info);
    console.log('Paired with POS:', info);
  }, []);

  /**
   * PNRでペアリング
   */
  const pairWithPNR = useCallback(async (pnr: string) => {
    setError(null);

    // PNRの形式を検証
    if (!/^\d{6}$/.test(pnr)) {
      setError('PNRは6桁の数字で入力してください');
      return;
    }

    // TODO: バックエンドでPNRを検証し、POS情報を取得
    // const response = await verifyPNR(pnr);

    // 暫定的にダミー情報を設定
    const info: PairingInfo = {
      pnr,
      posId: `pos_${pnr}`,
      posName: `POS Terminal ${pnr}`,
      pairedAt: new Date(),
    };

    setPairingInfo(info);
    console.log('Paired with PNR:', pnr);
  }, []);

  /**
   * ペアリング解除
   */
  const unpair = useCallback(() => {
    setPairingInfo(null);
    setCurrentPaymentRequest(null);
    setPaymentHistory([]);
    console.log('Unpaired');
  }, []);

  /**
   * 決済を完了
   */
  const completePayment = useCallback((paymentIntentId: string) => {
    if (!currentPaymentRequest) return;

    const result: PaymentResult = {
      requestId: currentPaymentRequest.id,
      success: true,
      paymentIntentId,
      completedAt: new Date(),
    };
    setPaymentHistory((prev) => [...prev, result]);
    setCurrentPaymentRequest(null);

    // TODO: バックエンドに結果を通知
    console.log('Payment completed:', result);
  }, [currentPaymentRequest]);

  /**
   * 決済をキャンセル
   */
  const cancelPayment = useCallback(() => {
    if (!currentPaymentRequest) return;

    const result: PaymentResult = {
      requestId: currentPaymentRequest.id,
      success: false,
      error: 'キャンセルされました',
      completedAt: new Date(),
    };
    setPaymentHistory((prev) => [...prev, result]);
    setCurrentPaymentRequest(null);

    // TODO: バックエンドにキャンセルを通知
    console.log('Payment cancelled:', currentPaymentRequest.id);
  }, [currentPaymentRequest]);

  /**
   * エラーをクリア
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const contextValue: PairingContextValue = {
    isPaired: pairingInfo !== null,
    pairingInfo,
    pairWithQRCode,
    pairWithPNR,
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
