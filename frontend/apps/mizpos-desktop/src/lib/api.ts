import type { paths as AccountsPaths } from "@mizpos/api/accounts";
import type { paths as StockPaths } from "@mizpos/api/stock";
import createClient from "openapi-fetch";
import type {
  AppliedCoupon,
  LoginRequest,
  PosEvent,
  PosSession,
  Product,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

export const accountsClient = createClient<AccountsPaths>({
  baseUrl: `${API_BASE_URL}/accounts`,
});

export const stockClient = createClient<StockPaths>({
  baseUrl: `${API_BASE_URL}/stock`,
});

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function posLogin(request: LoginRequest): Promise<PosSession> {
  const { data, error, response } = await accountsClient.POST(
    "/pos/auth/login",
    {
      body: {
        employee_number: request.employee_number,
        pin: request.pin,
        terminal_id: request.terminal_id,
      },
    },
  );

  if (error || !response.ok) {
    const detail = (error as { detail?: string })?.detail || "Login failed";
    throw new ApiError(detail, response.status, detail);
  }

  return data as unknown as PosSession;
}

export async function verifySession(
  sessionId: string,
): Promise<{ valid: boolean; session?: PosSession }> {
  const { data, error, response } = await accountsClient.GET(
    "/pos/auth/verify",
    {
      params: { query: { session_id: sessionId } },
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      return { valid: false };
    }
    throw new ApiError("Session verification failed", response.status);
  }

  if (error) {
    return { valid: false };
  }

  return data as unknown as { valid: boolean; session?: PosSession };
}

export async function refreshSession(sessionId: string): Promise<PosSession> {
  const { data, error, response } = await accountsClient.POST(
    "/pos/auth/refresh",
    {
      body: { session_id: sessionId },
    },
  );

  if (error || !response.ok) {
    const detail =
      (error as { detail?: string })?.detail || "Session refresh failed";
    throw new ApiError(detail, response.status, detail);
  }

  return data as unknown as PosSession;
}

export async function posLogout(sessionId: string): Promise<void> {
  await accountsClient
    .POST("/pos/auth/logout", {
      body: { session_id: sessionId },
    })
    .catch(() => {});
}

interface ApiProductResponse {
  product_id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category?: string;
  jan_code?: string;
  isdn?: string;
  image_url?: string;
  publisher_id?: string;
  event_id?: string;
  created_at: string;
  updated_at: string;
}

function mapApiProductToProduct(apiProduct: ApiProductResponse): Product {
  return {
    product_id: apiProduct.product_id,
    title: apiProduct.name,
    description: apiProduct.description,
    price: apiProduct.price,
    quantity: apiProduct.stock_quantity,
    category: apiProduct.category,
    barcode: apiProduct.jan_code,
    isdn: apiProduct.isdn,
    image_url: apiProduct.image_url,
    publisher_id: apiProduct.publisher_id,
    event_id: apiProduct.event_id,
    created_at: apiProduct.created_at,
    updated_at: apiProduct.updated_at,
  };
}

export async function fetchProducts(eventId?: string): Promise<Product[]> {
  const { data, error, response } = await stockClient.GET("/products", {
    params: { query: eventId ? { category: eventId } : {} },
  });

  if (error || !response.ok) {
    throw new ApiError("Failed to fetch products", response.status);
  }

  const responseData = data as { products?: ApiProductResponse[] };
  const apiProducts = responseData.products || [];
  return apiProducts.map(mapApiProductToProduct);
}

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

export async function syncOfflineSales(
  terminalId: string,
  sales: OfflineSale[],
): Promise<SyncResult> {
  const { data, error, response } = await accountsClient.POST(
    "/pos/sync/sales",
    {
      body: {
        terminal_id: terminalId,
        sales: sales as unknown as { [key: string]: unknown }[],
      },
    },
  );

  if (error || !response.ok) {
    throw new ApiError("Failed to sync offline sales", response.status);
  }

  return data as unknown as SyncResult;
}

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
    terminal_id?: string;
  },
): Promise<{ sale_id: string }> {
  const { data, error, response } = await accountsClient.POST("/pos/sales", {
    body: saleData,
    headers: {
      "X-POS-Session": sessionId,
    },
  });

  if (error || !response.ok) {
    const detail =
      (error as { detail?: string })?.detail || "Sale recording failed";
    throw new ApiError(detail, response.status, detail);
  }

  return data as unknown as { sale_id: string };
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const { response } = await stockClient.GET("/products", {
      params: { query: {} },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkNetworkConnectivity(): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  return checkApiHealth();
}

export async function applyCoupon(
  _sessionId: string,
  _code: string,
  _subtotal: number,
  _publisherId?: string,
): Promise<AppliedCoupon & { new_total: number }> {
  throw new ApiError("Coupon API not available in OpenAPI spec", 501);
}

export async function lookupCoupon(
  _sessionId: string,
  _code: string,
): Promise<{ coupon: AppliedCoupon }> {
  throw new ApiError("Coupon API not available in OpenAPI spec", 501);
}

// イベント一覧を取得（POS用認証なしエンドポイント）
interface ApiEventResponse {
  event_id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  publisher_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchPosEvents(): Promise<PosEvent[]> {
  const { data, error, response } = await accountsClient.GET("/pos/events", {});

  if (error || !response.ok) {
    throw new ApiError("Failed to fetch events", response.status);
  }

  // レスポンスが配列の場合と { events: [...] } の場合の両方に対応
  let apiEvents: ApiEventResponse[] = [];
  if (Array.isArray(data)) {
    apiEvents = data as unknown as ApiEventResponse[];
  } else {
    const responseData = data as unknown as {
      events?: ApiEventResponse[];
    };
    apiEvents = responseData.events || [];
  }

  return apiEvents.map((event) => ({
    event_id: event.event_id,
    name: event.name,
    description: event.description,
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location,
    publisher_id: event.publisher_id,
    is_active: event.is_active ?? true,
    created_at: event.created_at,
    updated_at: event.updated_at,
  }));
}
