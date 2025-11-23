import {
  createAccountsClient,
  createAndroidMgmtClient,
  createSalesClient,
  createStockClient,
} from "@mizpos/api";
import { fetchAuthSession } from "aws-amplify/auth";

// 各Lambda APIのベースURL
const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

// 認証トークンを取得するヘルパー関数
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
    }
    console.warn("認証トークンが取得できませんでした");
  } catch (error) {
    console.error("認証セッション取得エラー:", error);
  }
  return {
    "Content-Type": "application/json",
  };
}

// 各APIクライアントを作成（認証トークンは各リクエスト時に取得）
export const accounts = createAccountsClient({
  baseUrl: `${API_GATEWAY_BASE}/accounts`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const stock = createStockClient({
  baseUrl: `${API_GATEWAY_BASE}/stock`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const sales = createSalesClient({
  baseUrl: `${API_GATEWAY_BASE}/sales`,
  headers: {
    "Content-Type": "application/json",
  },
});

export const androidMgmt = createAndroidMgmtClient({
  baseUrl: `${API_GATEWAY_BASE}/mizpos-enterprise-android-manager`,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function getAuthenticatedClients() {
  const headers = await getAuthHeaders();

  return {
    accounts: createAccountsClient({
      baseUrl: `${API_GATEWAY_BASE}/accounts`,
      headers,
    }),
    stock: createStockClient({
      baseUrl: `${API_GATEWAY_BASE}/stock`,
      headers,
    }),
    sales: createSalesClient({
      baseUrl: `${API_GATEWAY_BASE}/sales`,
      headers,
    }),
    androidMgmt: createAndroidMgmtClient({
      baseUrl: `${API_GATEWAY_BASE}/mizpos-enterprise-android-manager`,
      headers,
    }),
  };
}

export { getAuthHeaders };
