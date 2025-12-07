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
export type PaymentMethod =
  | "cash"
  | "oya_cashless"
  | "voucher_department" // 百貨店商品券
  | "voucher_event"; // イベント主催者発行商品券

/**
 * 商品券種別
 */
export type VoucherType = "voucher_department" | "voucher_event";

/**
 * 商品券設定
 */
export interface VoucherConfig {
  type: VoucherType;
  name: string;
  allowChange: boolean; // おつりを出すかどうか
}

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
  /** 商品券設定 */
  voucherConfigs?: VoucherConfig[];
}

/**
 * 金種カウント
 */
export interface DenominationCount {
  denomination: number; // 金種（10000, 5000, ...）
  count: number; // 個数
}

/**
 * 閉局チェック用の商品券等カウント
 */
export interface VoucherCount {
  type: string; // "百貨店商品券", "イベント主催者発行商品券", "外貨" など
  amount: number; // 日本円換算金額
  memo?: string; // 備考（外貨の場合は通貨名など）
}

/**
 * 開局レポート
 */
export interface OpeningReport {
  id: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  eventId?: string;

  // 金種別カウント
  denominations: DenominationCount[];
  cashTotal: number;

  openedAt: Date;
}

/**
 * 両替記録
 */
export interface ExchangeRecord {
  id: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  eventId?: string;

  // 両替前
  fromDenominations: DenominationCount[];
  fromTotal: number;

  // 両替後
  toDenominations: DenominationCount[];
  toTotal: number;

  // メモ
  memo?: string;

  exchangedAt: Date;
}

/**
 * 閉局レポート
 */
export interface ClosingReport {
  id: string;
  terminalId: string;
  staffId: string;
  staffName: string;
  eventId?: string;

  // 金種別カウント
  denominations: DenominationCount[];
  cashTotal: number;

  // 商品券等
  vouchers: VoucherCount[];
  voucherTotal: number;

  // 合計
  grandTotal: number;

  // 開局時レジ金
  openingCashTotal: number;

  // 売上との差異
  expectedTotal: number;
  difference: number;

  closedAt: Date;
}
