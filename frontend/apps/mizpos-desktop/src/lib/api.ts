/**
 * API クライアント
 * POS端末からバックエンドAPIへのリクエストを処理
 */

import type { LoginRequest, PosSession, Product } from "../types";

// 環境変数からAPIエンドポイントを取得
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";
const ACCOUNTS_API = `${API_BASE_URL}/accounts`;
const STOCK_API = `${API_BASE_URL}/stock`;
const SALES_API = `${API_BASE_URL}/sales`;

// リクエストタイムアウト（ミリ秒）
const REQUEST_TIMEOUT = 10000;

/**
 * タイムアウト付きfetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * APIエラー
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public detail?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ==========================================
// POS認証API
// ==========================================

/**
 * POS端末ログイン
 */
export async function posLogin(request: LoginRequest): Promise<PosSession> {
  const response = await fetchWithTimeout(`${ACCOUNTS_API}/pos/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(
      error.detail || "Login failed",
      response.status,
      error.detail
    );
  }

  return response.json();
}

/**
 * セッション検証
 */
export async function verifySession(sessionId: string): Promise<{ valid: boolean; session?: PosSession }> {
  const response = await fetchWithTimeout(
    `${ACCOUNTS_API}/pos/auth/verify?session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      return { valid: false };
    }
    throw new ApiError("Session verification failed", response.status);
  }

  return response.json();
}

/**
 * セッション延長
 */
export async function refreshSession(sessionId: string): Promise<PosSession> {
  const response = await fetchWithTimeout(`${ACCOUNTS_API}/pos/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(
      error.detail || "Session refresh failed",
      response.status,
      error.detail
    );
  }

  return response.json();
}

/**
 * ログアウト
 */
export async function posLogout(sessionId: string): Promise<void> {
  await fetchWithTimeout(`${ACCOUNTS_API}/pos/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: sessionId }),
  }).catch(() => {
    // ログアウト失敗は無視（オフラインでもログアウトできるように）
  });
}

// ==========================================
// 商品API
// ==========================================

/**
 * 商品一覧を取得（ログイン時にダウンロード）
 */
export async function fetchProducts(eventId?: string): Promise<Product[]> {
  const params = new URLSearchParams();
  if (eventId) {
    params.append("event_id", eventId);
  }

  const url = `${STOCK_API}/products${params.toString() ? `?${params}` : ""}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new ApiError("Failed to fetch products", response.status);
  }

  const data = await response.json();
  return data.products || [];
}

// ==========================================
// 販売同期API
// ==========================================

interface OfflineSale {
  queue_id: string;
  created_at: number;
  sale_data: unknown;
}

interface SyncResult {
  synced_count: number;
  failed_items: Array<{ queue_id: string; error: string }>;
  sync_timestamp: number;
}

/**
 * オフライン販売を同期
 */
export async function syncOfflineSales(
  terminalId: string,
  sales: OfflineSale[]
): Promise<SyncResult> {
  const response = await fetchWithTimeout(`${ACCOUNTS_API}/pos/sync/sales`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      terminal_id: terminalId,
      sales: sales,
    }),
  });

  if (!response.ok) {
    throw new ApiError("Failed to sync offline sales", response.status);
  }

  return response.json();
}

/**
 * 販売を記録
 */
export async function recordSale(
  sessionId: string,
  saleData: {
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
    }>;
    total_amount: number;
    payment_method: string;
    event_id?: string;
  }
): Promise<{ sale_id: string }> {
  const response = await fetchWithTimeout(`${SALES_API}/sales`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-POS-Session": sessionId,
    },
    body: JSON.stringify(saleData),
  });

  if (!response.ok) {
    throw new ApiError("Failed to record sale", response.status);
  }

  return response.json();
}

// ==========================================
// ヘルスチェック
// ==========================================

/**
 * APIの接続確認
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${STOCK_API}/products?limit=1`, {
      method: "GET",
    }, 5000); // 5秒タイムアウト
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * ネットワーク接続確認
 */
export async function checkNetworkConnectivity(): Promise<boolean> {
  // まずブラウザのオンライン状態をチェック
  if (!navigator.onLine) {
    return false;
  }

  // 実際にAPIに接続できるかチェック
  return checkApiHealth();
}
