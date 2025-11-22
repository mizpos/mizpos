/**
 * POS端末アプリの型定義
 */

// 従業員情報
export interface PosEmployee {
  employee_number: string;
  display_name: string;
  event_id?: string;
  publisher_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// セッション情報
export interface PosSession {
  session_id: string;
  employee_number: string;
  display_name: string;
  event_id?: string;
  publisher_id?: string;
  expires_at: number;
  offline_verification_hash: string;
}

// 商品情報
export interface Product {
  product_id: string;
  title: string;
  description?: string;
  price: number;
  quantity: number;
  category?: string;
  barcode?: string;
  isdn?: string;
  image_url?: string;
  publisher_id?: string;
  event_id?: string;
  created_at: string;
  updated_at: string;
}

// カートアイテム
export interface CartItem {
  product_id: string;
  product: Product;
  quantity: number;
  subtotal: number;
}

// 販売レコード
export interface SaleRecord {
  sale_id: string;
  timestamp: number;
  items: CartItem[];
  subtotal: number; // 割引前の小計
  discount_amount: number; // クーポン割引額
  total_amount: number; // 割引後の合計
  received_amount: number; // 受領額（現金の場合は満額、カード・その他は合計額と同じ）
  payment_method: "cash" | "card" | "other";
  employee_number: string;
  event_id?: string;
  terminal_id: string;
  synced: boolean;
  created_at: number;
  // クーポン情報
  coupon?: AppliedCoupon;
}

// オフライン販売キュー
export interface OfflineSaleQueue {
  queue_id: string;
  sale_data: SaleRecord;
  created_at: number;
  sync_status: "pending" | "synced" | "failed";
  error_message?: string;
}

// API レスポンス型
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// ログインリクエスト
export interface LoginRequest {
  employee_number: string;
  pin: string;
  terminal_id: string;
}

// ネットワーク状態
export type NetworkStatus = "online" | "offline" | "checking";

// 同期状態
export interface SyncStatus {
  lastSyncTime?: number;
  pendingCount: number;
  isSyncing: boolean;
}

// クーポン
export interface Coupon {
  coupon_id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  publisher_id?: string;
  event_id?: string;
  min_purchase_amount: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit?: number;
  usage_count: number;
  active: boolean;
}

// クーポン適用結果
export interface AppliedCoupon {
  coupon_id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  discount_amount: number; // 実際の割引額
}
