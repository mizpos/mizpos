/**
 * APIクライアント
 * Stock API、Sales API、Accounts APIへのリクエストを管理
 */

const STOCK_API_URL =
  import.meta.env.VITE_STOCK_API_URL || "http://localhost:8000/stock";
const SALES_API_URL =
  import.meta.env.VITE_SALES_API_URL || "http://localhost:8001/sales";
// const ACCOUNTS_API_URL =
//   import.meta.env.VITE_ACCOUNTS_API_URL || "http://localhost:8002/accounts";

/**
 * 認証トークンを取得する関数（Amplifyから）
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { fetchAuthSession } = await import("aws-amplify/auth");
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    return null;
  }
}

/**
 * 共通のHTTPリクエスト関数
 * @param requireAuth - trueの場合、認証ヘッダを付与
 */
async function fetchJSON<T>(
  url: string,
  options?: RequestInit,
  requireAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // 既存のヘッダーを追加
  if (options?.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers[key] = value;
    });
  }

  // 認証が必要な場合のみトークンを取得して付与
  if (requireAuth) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

// ========== Stock API ==========

export interface Product {
  product_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  image_url: string;
  author: string;
  publisher: string;
  publisher_id: string;
  variant_type: "physical" | "digital" | "both";
  isdn?: string;
  download_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductsResponse {
  products: Product[];
}

/**
 * 商品一覧を取得（認証不要）
 */
export async function getProducts(category?: string): Promise<Product[]> {
  const url = new URL(`${STOCK_API_URL}/products`);
  if (category) {
    url.searchParams.set("category", category);
  }
  const data = await fetchJSON<ProductsResponse>(
    url.toString(),
    undefined,
    false,
  );
  return data.products;
}

/**
 * 商品詳細を取得（認証不要）
 */
export async function getProduct(productId: string): Promise<Product> {
  const data = await fetchJSON<{ product: Product }>(
    `${STOCK_API_URL}/products/${productId}`,
    undefined,
    false,
  );
  return data.product;
}

// ========== Sales API ==========

export interface CartItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface ShippingAddress {
  name: string;
  postal_code: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2?: string;
  phone_number: string;
}

export interface CreateOrderRequest {
  cart_items: CartItem[];
  customer_email: string;
  customer_name: string;
  shipping_address: ShippingAddress;
  coupon_code?: string;
  notes?: string;
}

export interface Order {
  order_id: string;
  sale_id?: string; // 後方互換性のため
  customer_email: string;
  customer_name: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  status: "pending" | "completed" | "cancelled" | "refunded";
  shipping_address: ShippingAddress;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  created_at: string;
}

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * オンライン注文を作成（認証不要）
 */
export async function createOrder(request: CreateOrderRequest): Promise<Order> {
  const data = await fetchJSON<{ order: Order }>(
    `${SALES_API_URL}/orders`,
    {
      method: "POST",
      body: JSON.stringify(request),
    },
    false, // 認証不要
  );
  return data.order;
}

/**
 * 注文詳細を取得（認証不要）
 */
export async function getOrder(orderId: string): Promise<Order> {
  const data = await fetchJSON<{ order: Order }>(
    `${SALES_API_URL}/orders/${orderId}`,
    undefined,
    false,
  );
  return data.order;
}

/**
 * メールアドレスで注文一覧を取得（認証不要）
 */
export async function getOrdersByEmail(email: string): Promise<Order[]> {
  const url = new URL(`${SALES_API_URL}/orders`);
  url.searchParams.set("customer_email", email);
  const data = await fetchJSON<{ orders: Order[] }>(
    url.toString(),
    undefined,
    false,
  );
  return data.orders;
}

/**
 * 注文用のPaymentIntentを作成（認証不要）
 */
export async function createOrderPaymentIntent(
  orderId: string,
): Promise<PaymentIntent> {
  const data = await fetchJSON<{ payment_intent: PaymentIntent }>(
    `${SALES_API_URL}/orders/${orderId}/payment-intent`,
    { method: "POST" },
    false, // 認証不要
  );
  return data.payment_intent;
}

/**
 * 注文のPaymentIntentステータスを確認（認証不要）
 */
export async function getOrderPaymentStatus(orderId: string): Promise<{
  order_id: string;
  payment_status: string;
  order_status: string;
  error?: string;
}> {
  return await fetchJSON(
    `${SALES_API_URL}/orders/${orderId}/payment-status`,
    { method: "GET" },
    false, // 認証不要
  );
}

/**
 * クーポンを適用（認証不要）
 */
export async function applyCoupon(
  code: string,
  cartItems: CartItem[],
): Promise<{
  subtotal: number;
  discount: number;
  total: number;
}> {
  return await fetchJSON(
    `${SALES_API_URL}/coupons/apply`,
    {
      method: "POST",
      body: JSON.stringify({ code, cart_items: cartItems }),
    },
    false, // 認証不要
  );
}
