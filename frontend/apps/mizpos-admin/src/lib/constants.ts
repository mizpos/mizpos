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

// CDN URL for desktop app downloads
export const CDN_URLS = {
  dev: "https://d1o5hbbhoeegz0.cloudfront.net",
  prod: "https://d2xppn5ml53jqk.cloudfront.net",
} as const;

// Get current environment based on hostname
export const getEnvironment = (): "dev" | "prod" => {
  if (typeof window === "undefined") return "dev";
  const hostname = window.location.hostname;
  if (
    hostname.includes("localhost") ||
    hostname.includes("127.0.0.1") ||
    hostname.includes("-dev") ||
    hostname.includes("-stg")
  ) {
    return "dev";
  }
  return "prod";
};

// Desktop app version (should match Cargo.toml version)
export const DESKTOP_APP_VERSION = "0.1.0";
