/**
 * 環境設定
 *
 * ビルド時に環境変数から設定を取得
 * - EXPO_PUBLIC_API_BASE_URL: API Gateway のベースURL
 * - EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: Stripe Publishable Key（Secrets Manager から取得）
 */

export const config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
};

export default config;
