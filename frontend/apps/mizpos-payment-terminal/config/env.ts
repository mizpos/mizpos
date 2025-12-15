/**
 * 環境設定
 *
 * 開発環境と本番環境で異なる設定を管理
 */

const API_GATEWAY_BASE = 'https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com';

const ENV = {
  development: {
    API_GATEWAY_BASE,
    API_BASE_URL: `${API_GATEWAY_BASE}/dev/sales`,
    STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',  // TODO: 実際のキーに置き換え
  },
  production: {
    API_GATEWAY_BASE,
    API_BASE_URL: `${API_GATEWAY_BASE}/prod/sales`,
    STRIPE_PUBLISHABLE_KEY: 'pk_live_xxx',  // TODO: 実際のキーに置き換え
  },
};

// 現在の環境を取得（Expoでは __DEV__ で判定可能）
const getEnv = () => {
  if (__DEV__) {
    return ENV.development;
  }
  return ENV.production;
};

export const config = {
  ...getEnv(),
};

export default config;
