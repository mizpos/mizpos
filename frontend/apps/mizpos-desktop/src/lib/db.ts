import Dexie, { type Table } from "dexie";
import type { Product, Transaction } from "../types";
import { type ApiProduct, fetchProducts } from "./api";

/**
 * 販売サマリー（レポート用）
 * コードと版元をKeyとして販売数量・金額を集計
 */
export interface SalesSummary {
  id: string; // コード（JAN/ISBN）+ "_" + circleName のハッシュ
  jan: string;
  isbn?: string;
  productName: string;
  circleName: string; // 版元（出版社/サークル名）
  totalQuantity: number;
  totalAmount: number;
  lastSoldAt: Date;
}

/**
 * ローカルキャッシュ用IndexedDB
 */
class MizPOSDatabase extends Dexie {
  products!: Table<Product>;
  transactions!: Table<Transaction>;
  salesSummary!: Table<SalesSummary>;

  constructor() {
    super("mizpos");
    this.version(1).stores({
      products: "id, jan, isbn, name",
      transactions: "id, staffId, createdAt",
    });
    // バージョン2: jan2インデックスを追加
    this.version(2).stores({
      products: "id, jan, jan2, isbn, name",
      transactions: "id, staffId, createdAt",
    });
    // バージョン3: isBookインデックスを追加
    this.version(3).stores({
      products: "id, jan, jan2, isbn, isBook, name",
      transactions: "id, staffId, createdAt",
    });
    // バージョン4: deletedAtと販売サマリーテーブルを追加
    this.version(4).stores({
      products: "id, jan, jan2, isbn, isBook, name, deletedAt",
      transactions: "id, staffId, createdAt",
      salesSummary:
        "id, jan, isbn, circleName, [jan+circleName], [isbn+circleName]",
    });
  }
}

export const db = new MizPOSDatabase();

/**
 * APIから商品データを同期
 * DynamoDBに保存されたバーコードをそのまま使用する
 */
export async function syncProducts(): Promise<number> {
  const apiProducts = await fetchProducts();

  const products: Product[] = apiProducts.map((p: ApiProduct) => ({
    id: p.product_id,
    // DynamoDBに保存されたバーコードを使用（なければ空文字）
    jan: p.jan_barcode_1 || p.jan_code || "",
    jan2: p.jan_barcode_2,
    isbn: p.isbn,
    isdn: p.isdn,
    isBook: p.is_book ?? true, // デフォルトは書籍（後方互換性）
    name: p.name,
    circleName: p.publisher_name || p.publisher,
    price: p.price,
    imageUrl: p.image_url,
  }));

  // 全商品をクリアして再挿入
  await db.products.clear();
  await db.products.bulkPut(products);

  return products.length;
}

/**
 * JANコードで商品を検索（1段目または2段目バーコードで検索）
 * 論理削除された商品は除外
 */
export async function findProductByJan(
  jan: string,
): Promise<Product | undefined> {
  // まず1段目バーコードで検索
  let product = await db.products.where("jan").equals(jan).first();
  if (product && !product.deletedAt) return product;

  // 見つからなければ2段目バーコードで検索
  product = await db.products.where("jan2").equals(jan).first();
  if (product && !product.deletedAt) return product;

  return undefined;
}

/**
 * ISBNで商品を検索
 * 論理削除された商品は除外
 */
export async function findProductByIsbn(
  isbn: string,
): Promise<Product | undefined> {
  const product = await db.products.where("isbn").equals(isbn).first();
  if (product && !product.deletedAt) return product;
  return undefined;
}

/**
 * 商品を追加または更新
 */
export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put(product);
}

/**
 * 取引を保存
 */
export async function saveTransaction(transaction: Transaction): Promise<void> {
  await db.transactions.put(transaction);
}

/**
 * 取引履歴を取得
 */
export async function getTransactions(limit = 100): Promise<Transaction[]> {
  return db.transactions.orderBy("createdAt").reverse().limit(limit).toArray();
}

/**
 * 全商品を取得（論理削除されたものを除外）
 */
export async function getAllProducts(): Promise<Product[]> {
  return db.products.filter((product) => !product.deletedAt).toArray();
}

/**
 * 全商品を取得（論理削除されたものを含む）
 */
export async function getAllProductsIncludingDeleted(): Promise<Product[]> {
  return db.products.toArray();
}

/**
 * 商品を論理削除
 */
export async function softDeleteProduct(productId: string): Promise<void> {
  await db.products.update(productId, { deletedAt: new Date() });
}

/**
 * 論理削除された商品を復元
 */
export async function restoreProduct(productId: string): Promise<void> {
  await db.products.update(productId, { deletedAt: undefined });
}

/**
 * 販売サマリーIDを生成
 */
function generateSalesSummaryId(jan: string, circleName: string): string {
  return `${jan}_${circleName}`.replace(/\s+/g, "_");
}

/**
 * 販売サマリーを更新（取引完了時に呼び出す）
 */
export async function updateSalesSummary(
  transaction: Transaction,
): Promise<void> {
  // トレーニングモードの取引はサマリーに含めない
  if (transaction.isTraining) return;

  for (const item of transaction.items) {
    const { product, quantity } = item;
    const jan = product.jan || "";
    const circleName = product.circleName || "不明";
    const id = generateSalesSummaryId(jan, circleName);

    const existing = await db.salesSummary.get(id);

    if (existing) {
      // 既存レコードを更新
      await db.salesSummary.update(id, {
        totalQuantity: existing.totalQuantity + quantity,
        totalAmount: existing.totalAmount + product.price * quantity,
        lastSoldAt: transaction.createdAt,
      });
    } else {
      // 新規レコードを作成
      await db.salesSummary.put({
        id,
        jan,
        isbn: product.isbn,
        productName: product.name,
        circleName,
        totalQuantity: quantity,
        totalAmount: product.price * quantity,
        lastSoldAt: transaction.createdAt,
      });
    }
  }
}

/**
 * 販売サマリーを取得
 */
export async function getSalesSummary(): Promise<SalesSummary[]> {
  return db.salesSummary.toArray();
}

/**
 * 版元（サークル名）別の販売サマリーを取得
 */
export async function getSalesSummaryByCircle(
  circleName: string,
): Promise<SalesSummary[]> {
  return db.salesSummary.where("circleName").equals(circleName).toArray();
}

/**
 * JANコード別の販売サマリーを取得
 */
export async function getSalesSummaryByJan(
  jan: string,
): Promise<SalesSummary[]> {
  return db.salesSummary.where("jan").equals(jan).toArray();
}
