/**
 * 環境設定
 *
 * 開発環境と本番環境で異なる設定を管理
 */

const ENV = {
  development: {
    API_BASE_URL: 'https://api.example.com/dev/sales',  // TODO: 実際のAPIエンドポイントに置き換え
    STRIPE_PUBLISHABLE_KEY: 'pk_test_xxx',  // TODO: 実際のキーに置き換え
  },
  production: {
    API_BASE_URL: 'https://api.example.com/prod/sales',  // TODO: 実際のAPIエンドポイントに置き換え
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
