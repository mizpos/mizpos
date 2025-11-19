/**
 * ビジネスロジック定数
 */

// 在庫管理
export const STOCK_LOW_THRESHOLD = 5; // 在庫少の閾値

// ファイルアップロード
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;

// 日付範囲計算（ミリ秒）
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const ONE_WEEK_MS = 7 * ONE_DAY_MS;
export const ONE_MONTH_MS = 30 * ONE_DAY_MS;

// 決済手数料率（パーセント）
export const DEFAULT_STRIPE_ONLINE_FEE_RATE = 3.6;
export const DEFAULT_STRIPE_TERMINAL_FEE_RATE = 3.6;

// 委託販売手数料率（パーセント）
export const DEFAULT_COMMISSION_RATE = 30;
