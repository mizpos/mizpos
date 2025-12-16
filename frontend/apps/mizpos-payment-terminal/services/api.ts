/**
 * API通信サービス
 *
 * @mizpos/api パッケージを使用したOpenAPIクライアント
 */

import { createSalesClient, type SalesComponents } from '@mizpos/api';
import config from '@/config/env';

// Sales APIクライアント
export const salesClient = createSalesClient({
  baseUrl: config.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==========================================
// 型定義（APIレスポンス用）
// ==========================================

/**
 * ペアリング情報（APIレスポンス）
 */
export interface PairingInfo {
  pin_code: string;
  pos_id: string;
  pos_name: string;
  event_id?: string;
  event_name?: string;
  created_at: string;
  expires_at: string;
}

/**
 * 決済リクエスト（APIレスポンス）
 */
export interface PaymentRequest {
  request_id: string;
  pin_code: string;
  amount: number;
  currency: string;
  description?: string;
  sale_id?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  status: SalesComponents['schemas']['PaymentRequestStatus'];
  payment_intent_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * カード詳細情報（レシート表示用）
 */
export interface CardDetails {
  brand?: string;  // カードブランド（visa, mastercard等）
  last4?: string;  // カード番号下4桁
  exp_month?: number;  // 有効期限（月）
  exp_year?: number;  // 有効期限（年）
  cardholder_name?: string;  // カード名義人
  funding?: string;  // カード種別（credit, debit等）
  terminal_serial_number?: string;  // 端末シリアル番号
  merchant_name?: string;  // 加盟店名（Stripeアカウント名）
  transaction_type?: string;  // 取引種別（sale/refund）
  payment_type?: string;  // 支払区分
  transaction_at?: string;  // 取引日時（ISO8601形式）
}

/**
 * 決済結果更新リクエスト
 */
export interface UpdatePaymentRequestResultParams {
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'failed';
  payment_intent_id?: string;
  error_message?: string;
  card_details?: CardDetails;
}

// ==========================================
// Terminal Pairing API
// ==========================================

/**
 * ペアリングを検証（ターミナル側）
 */
export async function verifyPairing(pinCode: string): Promise<PairingInfo> {
  console.log('[API] Verifying pairing for PIN:', pinCode);

  const { data, error, response } = await salesClient.POST('/terminal/pairing/verify', {
    body: { pin_code: pinCode },
  });

  console.log('[API] verifyPairing response status:', response?.status);

  if (error) {
    console.error('[API] verifyPairing error:', error, 'status:', response?.status);
    throw new Error(`PINコードが見つかりません (${response?.status || 'unknown'})`);
  }

  if (!data) {
    console.error('[API] verifyPairing: empty response');
    throw new Error('レスポンスが空です');
  }

  console.log('[API] verifyPairing data:', JSON.stringify(data));
  const result = data as unknown as { pairing: PairingInfo };

  if (!result.pairing) {
    console.error('[API] verifyPairing: pairing not found in response', data);
    throw new Error('ペアリング情報が見つかりません');
  }

  console.log('[API] Pairing verified successfully:', result.pairing.pos_name);
  return result.pairing;
}

/**
 * ペアリング状態を取得（切断検知用）
 * @returns ペアリング情報、または存在しない場合はnull
 */
export async function getPairingStatus(pinCode: string): Promise<PairingInfo | null> {
  console.log('[API] Checking pairing status for PIN:', pinCode);

  const { data, error, response } = await salesClient.GET('/terminal/pairing/{pin_code}', {
    params: { path: { pin_code: pinCode } },
  });

  // 404はペアリングが存在しない（POS側で削除された）
  if (response?.status === 404) {
    console.log('[API] Pairing not found - disconnected');
    return null;
  }

  if (error) {
    console.error('[API] getPairingStatus error:', error, 'status:', response?.status);
    throw new Error(`ペアリング状態の取得に失敗: ${response?.status || 'unknown'}`);
  }

  const result = data as unknown as { pairing: PairingInfo };
  console.log('[API] Pairing status:', result?.pairing ? 'exists' : 'not found');
  return result?.pairing || null;
}

/**
 * ペアリングを解除
 */
export async function deletePairing(pinCode: string): Promise<void> {
  const { error } = await salesClient.DELETE('/terminal/pairing/{pin_code}', {
    params: { path: { pin_code: pinCode } },
  });

  if (error) {
    throw new Error('Failed to delete pairing');
  }
}

// ==========================================
// Terminal Payment Request API
// ==========================================

/**
 * ペンディング状態の決済リクエストを取得（ポーリング用）
 */
export async function getPendingPaymentRequest(
  pinCode: string
): Promise<PaymentRequest | null> {
  console.log('[API] Polling for pending payment request, PIN:', pinCode);

  const { data, error, response } = await salesClient.GET(
    '/terminal/payment-requests/pending/{pin_code}',
    {
      params: { path: { pin_code: pinCode } },
    }
  );

  // 404は「リクエストなし」として正常扱い
  if (response?.status === 404) {
    console.log('[API] No pending payment request');
    return null;
  }

  if (error) {
    console.error('[API] getPendingPaymentRequest error:', error, 'status:', response?.status);
    throw new Error(`決済リクエストの取得に失敗: ${response?.status || 'unknown'}`);
  }

  const result = data as unknown as { payment_request: PaymentRequest | null };
  console.log('[API] Pending payment request:', result?.payment_request?.request_id || 'none');
  return result?.payment_request || null;
}

/**
 * 決済リクエストの結果を更新
 */
export async function updatePaymentRequestResult(
  requestId: string,
  params: UpdatePaymentRequestResultParams
): Promise<PaymentRequest> {
  const { data, error } = await salesClient.PUT(
    '/terminal/payment-requests/{request_id}/result',
    {
      params: { path: { request_id: requestId } },
      body: params,
    }
  );

  if (error) {
    throw new Error('Failed to update payment request result');
  }

  return data as unknown as { payment_request: PaymentRequest }['payment_request'];
}

// ==========================================
// Stripe Terminal API
// ==========================================

/**
 * Connection Tokenを取得
 */
export async function getConnectionToken(locationId?: string): Promise<string> {
  const { data, error } = await salesClient.POST('/terminal/connection-token', {
    body: locationId ? { location_id: locationId } : null,
  });

  if (error) {
    throw new Error('Failed to get connection token');
  }

  const response = data as unknown as { connection_token: { secret: string } };
  return response.connection_token.secret;
}

/**
 * ロケーション一覧を取得
 */
export interface TerminalLocation {
  id: string;
  display_name: string;
  address: {
    line1: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
}

export async function getLocations(): Promise<TerminalLocation[]> {
  const { data, error } = await salesClient.GET('/terminal/locations');

  if (error) {
    throw new Error('Failed to get locations');
  }

  const response = data as unknown as { locations: TerminalLocation[] };
  return response.locations;
}

/**
 * Stripeアカウント情報（加盟店名など）
 */
export interface StripeAccountInfo {
  merchant_name: string;
  business_name: string;
  statement_descriptor: string;
}

/**
 * Stripeアカウント情報を取得
 */
export async function getStripeAccountInfo(): Promise<StripeAccountInfo> {
  const { data, error } = await salesClient.GET('/terminal/account');

  if (error) {
    throw new Error('Failed to get Stripe account info');
  }

  const response = data as unknown as { account: StripeAccountInfo };
  return response.account;
}

/**
 * リーダー一覧を取得
 */
export interface TerminalReader {
  id: string;
  label: string;
  location: string;
  device_type: string;
  status: string;
  serial_number: string;
}

export async function getReaders(locationId?: string): Promise<TerminalReader[]> {
  const { data, error } = await salesClient.GET('/terminal/readers', {
    params: { query: { location_id: locationId } },
  });

  if (error) {
    throw new Error('Failed to get readers');
  }

  const response = data as unknown as { readers: TerminalReader[] };
  return response.readers;
}

/**
 * PaymentIntentを作成（Terminal用）
 */
export interface CreatePaymentIntentParams {
  amount: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  sale_id?: string;
  pinCode?: string;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntent> {
  const { data, error } = await salesClient.POST('/terminal/payment-intents', {
    body: {
      amount: params.amount,
      currency: params.currency ?? 'jpy',
      description: params.description,
      metadata: params.metadata,
      sale_id: params.sale_id,
      pnr: params.pinCode,
    },
  });

  if (error) {
    throw new Error('Failed to create payment intent');
  }

  const response = data as unknown as { payment_intent: PaymentIntent };
  return response.payment_intent;
}

/**
 * PaymentIntentをキャプチャ（確定）
 */
export async function capturePaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntent> {
  const { data, error } = await salesClient.POST(
    '/terminal/payment-intents/{payment_intent_id}/capture',
    {
      params: { path: { payment_intent_id: paymentIntentId } },
    }
  );

  if (error) {
    throw new Error('Failed to capture payment intent');
  }

  const response = data as unknown as { payment_intent: PaymentIntent };
  return response.payment_intent;
}

/**
 * PaymentIntentをキャンセル
 */
export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntent> {
  const { data, error } = await salesClient.POST(
    '/terminal/payment-intents/{payment_intent_id}/cancel',
    {
      params: { path: { payment_intent_id: paymentIntentId } },
    }
  );

  if (error) {
    throw new Error('Failed to cancel payment intent');
  }

  const response = data as unknown as { payment_intent: PaymentIntent };
  return response.payment_intent;
}

/**
 * PaymentIntent情報を取得（返金確認用）
 */
export interface PaymentIntentForRefund {
  id: string;
  amount: number;
  amount_received: number;
  currency: string;
  status: string;
  refundable: boolean;
  metadata: Record<string, string>;
}

export async function getPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntentForRefund> {
  const { data, error } = await salesClient.GET(
    '/terminal/payment-intents/{payment_intent_id}',
    {
      params: { path: { payment_intent_id: paymentIntentId } },
    }
  );

  if (error) {
    throw new Error('Failed to get payment intent');
  }

  const response = data as unknown as { payment_intent: PaymentIntentForRefund };
  return response.payment_intent;
}

/**
 * 返金を処理
 */
export interface CreateRefundParams {
  payment_intent_id: string;
  amount?: number;
  reason?: string;
}

export interface Refund {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_intent: string;
  reason: string | null;
}

export async function createRefund(params: CreateRefundParams): Promise<Refund> {
  const { data, error } = await salesClient.POST('/terminal/refunds', {
    body: params,
  });

  if (error) {
    throw new Error('Failed to create refund');
  }

  const response = data as unknown as { refund: Refund };
  return response.refund;
}
