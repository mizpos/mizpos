/**
 * IndexedDB データベース設定（Dexie）
 * オフラインモード対応のためのローカルストレージ
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  OfflineSaleQueue,
  PosSession,
  Product,
  SaleRecord,
} from "../types";

// 画像キャッシュの型
interface CachedImage {
  url: string; // 元のURL（キー）
  blob: Blob; // 画像データ
  cached_at: number;
}

// データベーススキーマ
class PosDatabase extends Dexie {
  // テーブル定義
  products!: EntityTable<Product, "product_id">;
  sales!: EntityTable<SaleRecord, "sale_id">;
  offlineQueue!: EntityTable<OfflineSaleQueue, "queue_id">;
  sessions!: EntityTable<PosSession & { id?: number }, "id">;
  config!: EntityTable<{ key: string; value: unknown }, "key">;
  imageCache!: EntityTable<CachedImage, "url">;

  constructor() {
    super("mizpos-desktop");

    this.version(1).stores({
      // 商品マスタ（ログイン時にサーバーからダウンロード）
      products: "product_id, category, barcode, isdn, publisher_id, event_id",
      // 販売履歴（オンライン・オフライン両方）
      sales: "sale_id, timestamp, synced, employee_number, event_id",
      // オフライン販売キュー（同期待ち）
      offlineQueue: "queue_id, created_at, sync_status",
      // セッション情報（オフライン検証用）
      sessions: "++id, session_id, employee_number, expires_at",
      // アプリ設定
      config: "key",
    });

    // バージョン2: 画像キャッシュテーブル追加
    this.version(2).stores({
      products: "product_id, category, barcode, isdn, publisher_id, event_id",
      sales: "sale_id, timestamp, synced, employee_number, event_id",
      offlineQueue: "queue_id, created_at, sync_status",
      sessions: "++id, session_id, employee_number, expires_at",
      config: "key",
      imageCache: "url, cached_at",
    });
  }
}

// データベースインスタンス（シングルトン）
export const db = new PosDatabase();

// ==========================================
// 商品マスタ操作
// ==========================================

/**
 * 古い形式（name, stock_quantity）から新しい形式（title, quantity）への変換
 * 後方互換性のため、両方の形式をサポート
 */
function normalizeProduct(
  product: Product & { name?: string; stock_quantity?: number },
): Product {
  return {
    ...product,
    title: product.title || product.name || "",
    quantity: product.quantity ?? product.stock_quantity ?? 0,
  };
}

/**
 * 商品マスタを一括更新（ログイン時）
 */
export async function syncProducts(products: Product[]): Promise<void> {
  await db.transaction("rw", db.products, async () => {
    // 既存のデータをクリア
    await db.products.clear();
    // 新しいデータを一括挿入（正規化してから保存）
    const normalizedProducts = products.map(normalizeProduct);
    await db.products.bulkAdd(normalizedProducts);
  });
}

/**
 * 商品を検索
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const lowerQuery = query.toLowerCase();
  const results = await db.products
    .filter((product) => {
      const normalized = normalizeProduct(
        product as Product & { name?: string; stock_quantity?: number },
      );
      return (
        normalized.title?.toLowerCase().includes(lowerQuery) ||
        (product.barcode?.includes(query) ?? false) ||
        (product.isdn?.includes(query) ?? false)
      );
    })
    .toArray();
  return results.map((p) =>
    normalizeProduct(p as Product & { name?: string; stock_quantity?: number }),
  );
}

/**
 * バーコードで商品を検索
 */
export async function findProductByBarcode(
  barcode: string,
): Promise<Product | undefined> {
  const product = await db.products.where("barcode").equals(barcode).first();
  if (!product) return undefined;
  return normalizeProduct(
    product as Product & { name?: string; stock_quantity?: number },
  );
}

/**
 * カテゴリで商品を取得
 */
export async function getProductsByCategory(
  category: string,
): Promise<Product[]> {
  const products = await db.products
    .where("category")
    .equals(category)
    .toArray();
  return products.map((p) =>
    normalizeProduct(p as Product & { name?: string; stock_quantity?: number }),
  );
}

/**
 * 全商品を取得
 */
export async function getAllProducts(): Promise<Product[]> {
  const products = await db.products.toArray();
  return products.map((p) =>
    normalizeProduct(p as Product & { name?: string; stock_quantity?: number }),
  );
}

/**
 * 商品IDで取得
 */
export async function getProductById(
  productId: string,
): Promise<Product | undefined> {
  const product = await db.products.get(productId);
  if (!product) return undefined;
  return normalizeProduct(
    product as Product & { name?: string; stock_quantity?: number },
  );
}

// ==========================================
// 販売履歴操作
// ==========================================

/**
 * 販売を記録
 */
export async function addSale(sale: SaleRecord): Promise<void> {
  await db.sales.add(sale);
}

/**
 * 未同期の販売を取得
 */
export async function getUnsyncedSales(): Promise<SaleRecord[]> {
  return db.sales.where("synced").equals(0).toArray();
}

/**
 * 販売を同期済みにマーク
 */
export async function markSaleSynced(saleId: string): Promise<void> {
  await db.sales.update(saleId, { synced: true });
}

/**
 * 今日の販売を取得
 */
export async function getTodaySales(): Promise<SaleRecord[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.getTime();

  return db.sales.where("timestamp").aboveOrEqual(startOfDay).toArray();
}

// ==========================================
// オフライン販売キュー操作
// ==========================================

/**
 * オフライン販売をキューに追加
 */
export async function addToOfflineQueue(
  sale: SaleRecord,
): Promise<OfflineSaleQueue> {
  const queueItem: OfflineSaleQueue = {
    queue_id: sale.sale_id,
    sale_data: sale,
    created_at: Date.now(),
    sync_status: "pending",
  };

  await db.offlineQueue.add(queueItem);
  return queueItem;
}

/**
 * 未同期のキューを取得
 */
export async function getPendingOfflineQueue(): Promise<OfflineSaleQueue[]> {
  return db.offlineQueue.where("sync_status").equals("pending").toArray();
}

/**
 * キューアイテムを同期済みにマーク
 */
export async function markQueueItemSynced(queueId: string): Promise<void> {
  await db.offlineQueue.update(queueId, { sync_status: "synced" });
}

/**
 * キューアイテムを失敗としてマーク
 */
export async function markQueueItemFailed(
  queueId: string,
  error: string,
): Promise<void> {
  await db.offlineQueue.update(queueId, {
    sync_status: "failed",
    error_message: error,
  });
}

/**
 * 同期済みのキューをクリア（古いもの）
 */
export async function cleanupSyncedQueue(olderThanDays = 7): Promise<void> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  await db.offlineQueue
    .where("sync_status")
    .equals("synced")
    .and((item) => item.created_at < cutoffTime)
    .delete();
}

// ==========================================
// セッション操作
// ==========================================

/**
 * セッションを保存
 */
export async function saveSession(session: PosSession): Promise<void> {
  // 既存のセッションをクリア
  await db.sessions.clear();
  // 新しいセッションを保存
  await db.sessions.add(session);
}

/**
 * 保存されたセッションを取得
 */
export async function getStoredSession(): Promise<PosSession | undefined> {
  const sessions = await db.sessions.toArray();
  if (sessions.length === 0) return undefined;

  const session = sessions[0];
  // 有効期限チェック
  if (session.expires_at * 1000 < Date.now()) {
    await db.sessions.clear();
    return undefined;
  }

  return session;
}

/**
 * セッションをクリア
 */
export async function clearSession(): Promise<void> {
  await db.sessions.clear();
}

// ==========================================
// 設定操作
// ==========================================

/**
 * 設定を保存
 */
export async function setConfig<T>(key: string, value: T): Promise<void> {
  await db.config.put({ key, value });
}

/**
 * 設定を取得
 */
export async function getConfig<T>(key: string): Promise<T | undefined> {
  const config = await db.config.get(key);
  return config?.value as T | undefined;
}

/**
 * 端末IDを取得または生成
 */
export async function getTerminalId(): Promise<string> {
  let terminalId = await getConfig<string>("terminal_id");

  if (!terminalId) {
    // 新しい端末IDを生成
    terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await setConfig("terminal_id", terminalId);
  }

  return terminalId;
}

// ==========================================
// データベースの初期化・クリア
// ==========================================

/**
 * データベースを完全にクリア（ログアウト時など）
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.products, db.sales, db.offlineQueue, db.sessions],
    async () => {
      await db.products.clear();
      await db.sales.clear();
      await db.offlineQueue.clear();
      await db.sessions.clear();
      // configは端末IDなどがあるのでクリアしない
    },
  );
}

/**
 * 未同期（pending）のオフラインキューのサイズを確認
 */
export async function getOfflineQueueSize(): Promise<number> {
  return db.offlineQueue.where("sync_status").equals("pending").count();
}

/**
 * オフラインキューの警告しきい値（件数）
 */
export const OFFLINE_QUEUE_WARNING_THRESHOLD = 100;

/**
 * オフラインキューがしきい値を超えているか確認
 */
export async function isOfflineQueueNearCapacity(): Promise<boolean> {
  const count = await getOfflineQueueSize();
  return count >= OFFLINE_QUEUE_WARNING_THRESHOLD;
}

// ==========================================
// 画像キャッシュ操作
// ==========================================

/**
 * 画像をキャッシュに保存
 */
export async function cacheImage(url: string, blob: Blob): Promise<void> {
  await db.imageCache.put({
    url,
    blob,
    cached_at: Date.now(),
  });
}

/**
 * キャッシュから画像を取得
 */
export async function getCachedImage(url: string): Promise<Blob | undefined> {
  const cached = await db.imageCache.get(url);
  return cached?.blob;
}

/**
 * 画像URLからBlobを取得（キャッシュ優先）
 */
export async function getImageWithCache(url: string): Promise<string> {
  // キャッシュをチェック
  const cached = await getCachedImage(url);
  if (cached) {
    return URL.createObjectURL(cached);
  }

  // キャッシュになければダウンロードしてキャッシュ
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      await cacheImage(url, blob);
      return URL.createObjectURL(blob);
    }
  } catch (error) {
    console.error("Failed to fetch image:", url, error);
  }

  // 失敗した場合は元のURLを返す
  return url;
}

/**
 * 商品の画像を一括キャッシュ（商品同期時に呼び出す）
 */
export async function cacheProductImages(
  products: Product[],
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const imageUrls = products
    .filter((p) => p.image_url)
    .map((p) => p.image_url as string);

  let completed = 0;
  const total = imageUrls.length;

  // 並列でダウンロード（最大5つ同時）
  const batchSize = 5;
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        try {
          // 既にキャッシュ済みならスキップ
          const existing = await getCachedImage(url);
          if (!existing) {
            const response = await fetch(url);
            if (response.ok) {
              const blob = await response.blob();
              await cacheImage(url, blob);
            }
          }
        } catch (error) {
          console.error("Failed to cache image:", url, error);
        } finally {
          completed++;
          onProgress?.(completed, total);
        }
      }),
    );
  }
}

/**
 * 古い画像キャッシュをクリア
 */
export async function clearOldImageCache(olderThanDays = 30): Promise<void> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  await db.imageCache.where("cached_at").below(cutoffTime).delete();
}

/**
 * 画像キャッシュを完全にクリア
 */
export async function clearAllImageCache(): Promise<void> {
  await db.imageCache.clear();
}
