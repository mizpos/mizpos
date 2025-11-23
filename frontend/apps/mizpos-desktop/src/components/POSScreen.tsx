import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { fetchProducts } from "../lib/api";
import {
  cacheProductImages,
  findProductByCode,
  getAllProducts,
  syncProducts,
} from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { getEffectiveEventId, useEventStore } from "../stores/event";
import { useNetworkStore } from "../stores/network";
import { usePrinterStore } from "../stores/printer";
import type { Product } from "../types";
import { Cart } from "./Cart";
import { CheckoutModal } from "./CheckoutModal";
import { ProductGrid } from "./ProductGrid";
import { ReceiptModal } from "./ReceiptModal";
import { SettingsScreen } from "./SettingsScreen";
import { StatusBar } from "./StatusBar";

const styles = {
  screen: css({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#f0f2f5",
  }),
  content: css({
    display: "flex",
    flex: 1,
    overflow: "hidden",
  }),
  productsPanel: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "16px",
    overflow: "hidden",
  }),
  searchBar: css({
    display: "flex",
    gap: "12px",
    marginBottom: "8px",
  }),
  scanMessageBase: css({
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 500,
    marginBottom: "12px",
    animationName: "fadeIn",
    animationDuration: "0.2s",
    animationTimingFunction: "ease-out",
  }),
  scanMessageSuccess: css({
    background: "#e8f5e9",
    color: "#2e7d32",
    border: "1px solid #a5d6a7",
  }),
  scanMessageError: css({
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef9a9a",
  }),
  searchInput: css({
    flex: 1,
    padding: "14px 20px",
    fontSize: "16px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    background: "white",
    transition: "border-color 0.2s",
    _focus: {
      outline: "none",
      borderColor: "#1a237e",
    },
  }),
  refreshButton: css({
    padding: "14px 24px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#1a237e",
    background: "white",
    border: "2px solid #1a237e",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      _enabled: {
        background: "#e8eaf6",
      },
    },
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  }),
  loadingState: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "#666",
    fontSize: "16px",
  }),
  emptyState: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    color: "#666",
    fontSize: "16px",
  }),
  cartPanel: css({
    width: "400px",
    background: "white",
    borderLeft: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
  }),
};

export function POSScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(
    "商品を読み込んでいます...",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { session } = useAuthStore();
  const { addItem } = useCartStore();
  const { status } = useNetworkStore();
  const { lastSale, clearLastSale } = useCartStore();
  const { selectedEvent } = useEventStore();

  // 有効なイベントIDを取得（セッションに紐づくイベント > 手動選択イベント）
  const effectiveEventId = getEffectiveEventId(
    session?.event_id,
    selectedEvent,
  );
  const { initialize: initPrinter } = usePrinterStore();

  useEffect(() => {
    initPrinter();
  }, [initPrinter]);

  // 商品データの読み込み
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setLoadingMessage("商品を読み込んでいます...");

    try {
      // まずローカルから読み込み
      let localProducts = await getAllProducts();

      // オンラインの場合はサーバーから最新を取得
      if (status === "online") {
        try {
          const serverProducts = await fetchProducts(effectiveEventId);
          if (serverProducts.length > 0) {
            await syncProducts(serverProducts);
            localProducts = serverProducts;

            // 画像をバックグラウンドでキャッシュ
            setLoadingMessage("商品画像をキャッシュ中...");
            await cacheProductImages(serverProducts, (current, total) => {
              setLoadingMessage(
                `商品画像をキャッシュ中... (${current}/${total})`,
              );
            });
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
  }, [status, effectiveEventId]);

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
    if (!product) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.title?.toLowerCase().includes(query) ||
      product.barcode?.includes(searchQuery) ||
      product.isdn?.includes(searchQuery)
    );
  });

  const handleReceiptClose = () => {
    setShowReceipt(false);
    clearLastSale();
  };

  // バーコード/ISDNスキャン処理
  const handleBarcodeScan = useCallback(
    async (code: string) => {
      if (!code.trim()) return;

      console.log("[Scan] Looking up code:", code);
      const product = await findProductByCode(code.trim());

      if (product) {
        console.log("[Scan] Found product:", product.title);
        addItem(product);
        setScanMessage(`${product.title} をカートに追加しました`);
        setSearchQuery("");
        // 3秒後にメッセージを消す
        setTimeout(() => setScanMessage(null), 3000);
      } else {
        console.log("[Scan] Product not found for code:", code);
        setScanMessage(`商品が見つかりません: ${code}`);
        setTimeout(() => setScanMessage(null), 3000);
      }

      // 検索フィールドにフォーカスを戻す
      searchInputRef.current?.focus();
    },
    [addItem],
  );

  // 検索フィールドでEnterキーを押した時の処理
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        e.preventDefault();
        handleBarcodeScan(searchQuery);
      }
    },
    [searchQuery, handleBarcodeScan],
  );

  const getScanMessageClassName = (message: string) => {
    const isError = message.includes("見つかりません");
    return `${styles.scanMessageBase} ${
      isError ? styles.scanMessageError : styles.scanMessageSuccess
    }`;
  };

  return (
    <div className={styles.screen}>
      <StatusBar onOpenSettings={() => setShowSettings(true)} />

      <div className={styles.content}>
        {/* 左側: 商品一覧 */}
        <div className={styles.productsPanel}>
          <div className={styles.searchBar}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="商品名・バーコード・ISDNで検索（Enter: カートに追加）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className={styles.searchInput}
              // biome-ignore lint/a11y/noAutofocus: POS端末では検索欄への即時フォーカスが必要
              autoFocus
            />
            <button
              type="button"
              className={styles.refreshButton}
              onClick={loadProducts}
              disabled={isLoading}
            >
              {isLoading ? "読込中..." : "更新"}
            </button>
          </div>
          {scanMessage && (
            <div className={getScanMessageClassName(scanMessage)}>
              {scanMessage}
            </div>
          )}

          {isLoading ? (
            <div className={styles.loadingState}>
              <p>{loadingMessage}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <p>商品が見つかりません</p>
            </div>
          ) : (
            <ProductGrid products={filteredProducts} />
          )}
        </div>

        {/* 右側: カート */}
        <div className={styles.cartPanel}>
          <Cart onCheckout={() => setShowCheckout(true)} />
        </div>
      </div>

      {/* 会計モーダル */}
      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} />}

      {/* レシートモーダル */}
      {showReceipt && lastSale && (
        <ReceiptModal sale={lastSale} onClose={handleReceiptClose} />
      )}

      {/* 設定画面 */}
      {showSettings && (
        <SettingsScreen onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
