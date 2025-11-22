/**
 * POS販売画面
 * 商品選択、カート、会計を行うメイン画面
 */

import { useState, useEffect, useCallback } from "react";
import { StatusBar } from "./StatusBar";
import { ProductGrid } from "./ProductGrid";
import { Cart } from "./Cart";
import { CheckoutModal } from "./CheckoutModal";
import { ReceiptModal } from "./ReceiptModal";
import { useCartStore } from "../stores/cart";
import { useNetworkStore } from "../stores/network";
import { getAllProducts, syncProducts } from "../lib/db";
import { fetchProducts } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import type { Product } from "../types";
import "./POSScreen.css";

export function POSScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const { session } = useAuthStore();
  const { status } = useNetworkStore();
  const { lastSale, clearLastSale } = useCartStore();

  // 商品データの読み込み
  const loadProducts = useCallback(async () => {
    setIsLoading(true);

    try {
      // まずローカルから読み込み
      let localProducts = await getAllProducts();

      // オンラインの場合はサーバーから最新を取得
      if (status === "online") {
        try {
          const serverProducts = await fetchProducts(session?.event_id);
          if (serverProducts.length > 0) {
            await syncProducts(serverProducts);
            localProducts = serverProducts;
          }
        } catch (error) {
          console.error("Failed to fetch products from server:", error);
          // ローカルデータを使用
        }
      }

      setProducts(localProducts);
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoading(false);
    }
  }, [status, session?.event_id]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // 販売完了後にレシートを表示
  useEffect(() => {
    if (lastSale) {
      setShowCheckout(false);
      setShowReceipt(true);
    }
  }, [lastSale]);

  // 検索フィルタリング
  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.title.toLowerCase().includes(query) ||
      product.barcode?.includes(searchQuery) ||
      product.isdn?.includes(searchQuery)
    );
  });

  const handleReceiptClose = () => {
    setShowReceipt(false);
    clearLastSale();
  };

  return (
    <div className="pos-screen">
      <StatusBar />

      <div className="pos-content">
        {/* 左側: 商品一覧 */}
        <div className="products-panel">
          <div className="search-bar">
            <input
              type="text"
              placeholder="商品名・バーコードで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button
              type="button"
              className="refresh-button"
              onClick={loadProducts}
              disabled={isLoading}
            >
              {isLoading ? "読込中..." : "更新"}
            </button>
          </div>

          {isLoading ? (
            <div className="loading-state">
              <p>商品を読み込んでいます...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <p>商品が見つかりません</p>
            </div>
          ) : (
            <ProductGrid products={filteredProducts} />
          )}
        </div>

        {/* 右側: カート */}
        <div className="cart-panel">
          <Cart onCheckout={() => setShowCheckout(true)} />
        </div>
      </div>

      {/* 会計モーダル */}
      {showCheckout && (
        <CheckoutModal onClose={() => setShowCheckout(false)} />
      )}

      {/* レシートモーダル */}
      {showReceipt && lastSale && (
        <ReceiptModal sale={lastSale} onClose={handleReceiptClose} />
      )}
    </div>
  );
}
