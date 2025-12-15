/**
 * API通信サービス
 *
 * バックエンドとの通信を管理
 */

import config from '@/config/env';

// API レスポンス型
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// 共通のfetch関数
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const url = `${config.API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('API Error:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==========================================
// Stripe Terminal API
// ==========================================

/**
 * Connection Tokenを取得
 */
export async function getConnectionToken(locationId?: string): Promise<string> {
  const body = locationId ? { location_id: locationId } : {};
  const response = await fetchApi<{ connection_token: { secret: string } }>(
    '/terminal/connection-token',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to get connection token');
  }

  return response.data.connection_token.secret;
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
  const response = await fetchApi<{ locations: TerminalLocation[] }>(
    '/terminal/locations'
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to get locations');
  }

  return response.data.locations;
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
  const queryParams = locationId ? `?location_id=${locationId}` : '';
  const response = await fetchApi<{ readers: TerminalReader[] }>(
    `/terminal/readers${queryParams}`
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to get readers');
  }

  return response.data.readers;
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
  pnr?: string;
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
  const response = await fetchApi<{ payment_intent: PaymentIntent }>(
    '/terminal/payment-intents',
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to create payment intent');
  }

  return response.data.payment_intent;
}

/**
 * PaymentIntentをキャプチャ（確定）
 */
export async function capturePaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntent> {
  const response = await fetchApi<{ payment_intent: PaymentIntent }>(
    `/terminal/payment-intents/${paymentIntentId}/capture`,
    {
      method: 'POST',
    }
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to capture payment intent');
  }

  return response.data.payment_intent;
}

/**
 * PaymentIntentをキャンセル
 */
export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<PaymentIntent> {
  const response = await fetchApi<{ payment_intent: PaymentIntent }>(
    `/terminal/payment-intents/${paymentIntentId}/cancel`,
    {
      method: 'POST',
    }
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to cancel payment intent');
  }

  return response.data.payment_intent;
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
  const response = await fetchApi<{ payment_intent: PaymentIntentForRefund }>(
    `/terminal/payment-intents/${paymentIntentId}`
  );

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to get payment intent');
  }

  return response.data.payment_intent;
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
  const response = await fetchApi<{ refund: Refund }>('/terminal/refunds', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (response.error || !response.data) {
    throw new Error(response.error || 'Failed to create refund');
  }

  return response.data.refund;
}
