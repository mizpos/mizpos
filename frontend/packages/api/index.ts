import createClient from "openapi-fetch";
import type { paths as accountsPaths } from "./generated/accounts";
import type { paths as salesPaths } from "./generated/sales";
import type { paths as stockPaths } from "./generated/stock";
import type { paths as mdmPaths } from "./types/mdm";

export type {
  components as AccountsComponents,
  paths as AccountsPaths,
} from "./generated/accounts";
export type {
  components as MdmComponents,
  paths as MdmPaths,
} from "./generated/mdm";
export type {
  components as SalesComponents,
  paths as SalesPaths,
} from "./generated/sales";
export type {
  components as StockComponents,
  paths as StockPaths,
} from "./generated/stock";

export interface ApiConfig {
  baseUrl: string;
  headers?: Record<string, string>;
}

export function createAccountsClient(config: ApiConfig) {
  return createClient<accountsPaths>({
    baseUrl: config.baseUrl,
    headers: config.headers,
  });
}

export function createStockClient(config: ApiConfig) {
  return createClient<stockPaths>({
    baseUrl: config.baseUrl,
    headers: config.headers,
  });
}

export function createSalesClient(config: ApiConfig) {
  return createClient<salesPaths>({
    baseUrl: config.baseUrl,
    headers: config.headers,
  });
}

export function createMdmClient(config: ApiConfig) {
  return createClient<mdmPaths>({
    baseUrl: config.baseUrl,
    headers: config.headers,
  });
}

export interface MizposApiClients {
  accounts: ReturnType<typeof createAccountsClient>;
  stock: ReturnType<typeof createStockClient>;
  sales: ReturnType<typeof createSalesClient>;
  mdm: ReturnType<typeof createMdmClient>;
}

export function createMizposClients(config: ApiConfig): MizposApiClients {
  return {
    accounts: createAccountsClient(config),
    stock: createStockClient(config),
    sales: createSalesClient(config),
    mdm: createMdmClient(config),
  };
}

export { createClient };
