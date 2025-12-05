/**
 * サークル情報
 */
export interface Circle {
  publisher_id: string;
  name: string;
}

/**
 * ユーザーセッション
 */
export interface Session {
  sessionId: string;
  staffId: string;
  staffName: string;
  eventId?: string;
  publisherId?: string;
  circles?: Circle[];
  expiresAt: number;
  offlineVerificationHash: string;
  loginAt: Date;
}

/**
 * 商品情報
 */
export interface Product {
  id: string;
  jan: string;
  jan2?: string; // 2段目バーコード（書籍の場合）
  isbn?: string;
  isdn?: string; // ISDN（ハイフン区切り）
  isBook: boolean; // 書籍フラグ
  name: string;
  circleName?: string;
  price: number;
  imageUrl?: string;
  deletedAt?: Date; // 論理削除日時（nullの場合は有効）
}

/**
 * カート内商品
 */
export interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * 支払い方法
 */
export type PaymentMethod = "cash" | "oya_cashless";

/**
 * 支払い情報
 */
export interface Payment {
  method: PaymentMethod;
  amount: number;
}

/**
 * 取引情報
 */
export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  payments: Payment[];
  staffId: string;
  createdAt: Date;
  isTraining?: boolean;
}

/**
 * プリンター設定
 */
export interface PrinterConfig {
  type: "usb" | "bluetooth" | "pdf";
  vendorId?: number;
  deviceId?: number;
  bluetoothAddress?: string;
  name: string;
  paperWidth: number;
}

/**
 * アプリ設定
 */
export interface AppSettings {
  eventName: string;
  /** サークル名 */
  circleName?: string;
  /** 会場住所 */
  venueAddress?: string;
  terminalId: string;
  taxRate: number;
  printer?: PrinterConfig;
  isTrainingMode?: boolean;
}
