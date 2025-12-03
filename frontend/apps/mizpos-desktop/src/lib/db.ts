import Dexie, { type Table } from "dexie";
import type { Product, Transaction } from "../types";
import { type ApiProduct, fetchProducts } from "./api";

/**
 * ローカルキャッシュ用IndexedDB
 */
class MizPOSDatabase extends Dexie {
  products!: Table<Product>;
  transactions!: Table<Transaction>;

  constructor() {
    super("mizpos");
    this.version(1).stores({
      products: "id, jan, isbn, name",
      transactions: "id, staffId, createdAt",
    });
  }
}

export const db = new MizPOSDatabase();

/**
 * APIから商品データを同期
 */
export async function syncProducts(): Promise<number> {
  const apiProducts = await fetchProducts();

  const products: Product[] = apiProducts.map((p: ApiProduct) => ({
    id: p.product_id,
    jan: p.jan_code || "",
    isbn: p.isbn,
    name: p.name,
    circleName: p.publisher_name,
    price: p.price,
    imageUrl: p.image_url,
  }));

  // 全商品をクリアして再挿入
  await db.products.clear();
  await db.products.bulkPut(products);

  return products.length;
}

/**
 * JANコードで商品を検索
 */
export async function findProductByJan(
  jan: string,
): Promise<Product | undefined> {
  return db.products.where("jan").equals(jan).first();
}

/**
 * ISBNで商品を検索
 */
export async function findProductByIsbn(
  isbn: string,
): Promise<Product | undefined> {
  return db.products.where("isbn").equals(isbn).first();
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
 * 全商品を取得
 */
export async function getAllProducts(): Promise<Product[]> {
  return db.products.toArray();
}
