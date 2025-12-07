import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { CheckoutModal } from "../components/CheckoutModal";
import { ManualProductEntry } from "../components/ManualProductEntry";
import { ProductSelectModal } from "../components/ProductSelectModal";
import { ReceiptModal } from "../components/ReceiptModal";
import { Badge, Button, IconButton } from "../components/ui";
import { findProductByIsbn, findProductByJan } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { useSettingsStore } from "../stores/settings";
import type { Product, Transaction } from "../types";

/**
 * JANコードかISBNコードかを判別
 */
function classifyCode(code: string): "jan" | "isbn" | "unknown" {
  const cleaned = code.replace(/[-\s]/g, "");
  if (!/^\d+$/.test(cleaned)) return "unknown";
  if (cleaned.length === 13) {
    if (cleaned.startsWith("978") || cleaned.startsWith("979")) return "isbn";
    return "jan";
  }
  if (cleaned.length === 8) return "jan";
  return "unknown";
}

// レイアウトスタイル
const layoutStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0f172a",
    color: "white",
    overflow: "hidden",
    userSelect: "none",
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  }),
  headerLeft: css({
    display: "flex",
    alignItems: "center",
    gap: "16px",
  }),
  headerRight: css({
    display: "flex",
    alignItems: "center",
    gap: "12px",
  }),
  title: css({
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
    color: "#f8fafc",
  }),
  main: css({
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 400px",
    overflow: "hidden",
  }),
};

// 通知バーのスタイル
const notificationStyles = {
  base: css({
    padding: "14px 20px",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "center",
    animation: "slideDown 0.2s ease-out",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  }),
  success: css({ background: "#166534" }),
  error: css({ background: "#991b1b" }),
  warning: css({ background: "#92400e" }),
};

// トレーニングモードバナーのスタイル
const trainingBannerStyles = {
  banner: css({
    padding: "12px 20px",
    fontSize: "16px",
    fontWeight: 700,
    textAlign: "center",
    background: "linear-gradient(90deg, #dc2626 0%, #ea580c 50%, #dc2626 100%)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    animation: "pulse 2s ease-in-out infinite",
    borderBottom: "3px solid #991b1b",
  }),
  icon: css({
    fontSize: "20px",
  }),
};

// 商品リストセクションのスタイル
const productSectionStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #334155",
    overflow: "hidden",
  }),
  scanArea: css({
    padding: "20px 24px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    transition: "background 0.2s ease",
  }),
  scanAreaActive: css({
    background: "#1e40af",
  }),
  // 書籍2段目待機状態（オレンジ色）
  scanAreaBookSecond: css({
    background: "#c2410c",
    borderBottom: "3px solid #ea580c",
  }),
  scanContent: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  }),
  scanStatus: css({
    fontSize: "13px",
    color: "#94a3b8",
    marginBottom: "6px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }),
  scanInput: css({
    fontSize: "20px",
    fontFamily: "monospace",
    color: "#f8fafc",
    minHeight: "28px",
    fontWeight: 500,
  }),
  scanPlaceholder: css({
    color: "#64748b",
  }),
  list: css({
    flex: 1,
    overflowY: "auto",
    padding: "16px",
  }),
  emptyState: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#475569",
    gap: "12px",
  }),
  emptyIcon: css({
    fontSize: "56px",
    opacity: 0.4,
  }),
  emptyText: css({
    fontSize: "16px",
    fontWeight: 500,
  }),
  itemsContainer: css({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  }),
};

// 商品アイテムのスタイル
const itemStyles = {
  card: css({
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    gap: "16px",
    padding: "16px 20px",
    background: "#1e293b",
    borderRadius: "10px",
    border: "1px solid #334155",
    transition: "border-color 0.15s ease",
    _hover: {
      borderColor: "#475569",
    },
  }),
  info: css({
    minWidth: 0,
  }),
  index: css({
    fontSize: "11px",
    color: "#64748b",
    marginBottom: "2px",
    fontWeight: 500,
  }),
  name: css({
    fontSize: "15px",
    fontWeight: 600,
    color: "#f8fafc",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  circle: css({
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "3px",
  }),
  quantityControl: css({
    display: "flex",
    alignItems: "center",
    gap: "6px",
  }),
  quantity: css({
    minWidth: "36px",
    textAlign: "center",
    fontSize: "18px",
    fontWeight: 700,
    fontFamily: "monospace",
  }),
  priceSection: css({
    display: "flex",
    alignItems: "center",
    gap: "12px",
  }),
  price: css({
    fontSize: "17px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f8fafc",
    minWidth: "90px",
    textAlign: "right",
  }),
};

// 会計パネルのスタイル
const checkoutPanelStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    background: "#1e293b",
  }),
  totalArea: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  }),
  totalLabel: css({
    fontSize: "15px",
    color: "#64748b",
    marginBottom: "12px",
    fontWeight: 500,
  }),
  totalAmount: css({
    fontSize: "56px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f8fafc",
    letterSpacing: "-0.02em",
    lineHeight: 1,
  }),
  taxInfo: css({
    fontSize: "13px",
    color: "#64748b",
    marginTop: "16px",
  }),
  actions: css({
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    borderTop: "1px solid #334155",
  }),
  checkoutButton: css({
    padding: "24px 32px !important",
    fontSize: "24px !important",
    letterSpacing: "0.05em",
  }),
};

// 隠しインプットのスタイル
const hiddenInputStyle = css({
  position: "absolute",
  opacity: 0,
  pointerEvents: "none",
});

// スタッフID表示
const staffIdStyle = css({
  fontSize: "13px",
  color: "#94a3b8",
  fontFamily: "monospace",
});

function POSPage() {
  const { session, logout } = useAuthStore();
  const navigate = useNavigate();
  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    getTotal,
    getTotalQuantity,
    clear,
  } = useCartStore();
  const { settings, toggleTrainingMode } = useSettingsStore();
  const isTrainingMode = settings.isTrainingMode ?? false;

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showProductSelect, setShowProductSelect] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [completedTransaction, setCompletedTransaction] =
    useState<Transaction | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  // 書籍2段階スキャン: 1段目スキャン後の商品を一時保存
  const [pendingBookProduct, setPendingBookProduct] = useState<Product | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);

  const total = getTotal(settings.taxRate);
  const totalQuantity = getTotalQuantity();

  // 未ログインならログイン画面へ
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
    }
  }, [session, navigate]);

  // 常にバーコード入力にフォーカス
  useEffect(() => {
    const focusInput = () => {
      if (
        !showManualEntry &&
        !showProductSelect &&
        !showCheckout &&
        !completedTransaction
      ) {
        inputRef.current?.focus();
      }
    };
    focusInput();
    const interval = setInterval(focusInput, 500);
    document.addEventListener("click", focusInput);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", focusInput);
    };
  }, [showManualEntry, showProductSelect, showCheckout, completedTransaction]);

  // 通知を自動で消す
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // モーダル表示中は無効
      if (
        showManualEntry ||
        showProductSelect ||
        showCheckout ||
        completedTransaction
      )
        return;

      // F1: 手動入力
      if (e.key === "F1") {
        e.preventDefault();
        setShowManualEntry(true);
      }
      // F4: 商品選択
      if (e.key === "F4") {
        e.preventDefault();
        setShowProductSelect(true);
      }
      // F2: 会計（Enter は連続スキャンの妨げになるため F2 のみ対応）
      if (e.key === "F2") {
        e.preventDefault();
        if (items.length > 0) setShowCheckout(true);
      }
      // F3: カートクリア
      if (e.key === "F3") {
        e.preventDefault();
        if (items.length > 0) clear();
      }
      // Escape: カートクリア確認なしで実行
      if (e.key === "Escape" && items.length > 0) {
        e.preventDefault();
        clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showManualEntry,
    showProductSelect,
    showCheckout,
    completedTransaction,
    items.length,
    clear,
  ]);

  const processBarcode = useCallback(
    async (code: string) => {
      const cleaned = code.replace(/[-\s]/g, "").trim();
      if (!cleaned) return;

      setIsProcessing(true);
      try {
        // 書籍2段目待機中の場合
        if (pendingBookProduct) {
          // 2段目バーコードを照合
          if (pendingBookProduct.jan2 === cleaned) {
            addItem(pendingBookProduct);
            setNotification({
              type: "success",
              message: `${pendingBookProduct.name} を追加しました`,
            });
            setPendingBookProduct(null);
          } else {
            setNotification({
              type: "error",
              message: "2段目バーコードが一致しません。やり直してください。",
            });
            setPendingBookProduct(null);
          }
          return;
        }

        const codeType = classifyCode(cleaned);
        let product: Product | undefined;

        if (codeType === "jan") {
          product = await findProductByJan(cleaned);
        } else if (codeType === "isbn") {
          product = await findProductByIsbn(cleaned);
          if (!product) product = await findProductByJan(cleaned);
        } else {
          setNotification({ type: "error", message: "不明なコード形式です" });
          return;
        }

        if (product) {
          // 書籍かつ2段目バーコードがある場合は2段階スキャン
          if (product.isBook && product.jan2) {
            setPendingBookProduct(product);
            setNotification({
              type: "warning",
              message: `${product.name} - 2段目バーコードをスキャンしてください`,
            });
          } else {
            // 非書籍または2段目バーコードがない場合は即追加
            addItem(product);
            setNotification({
              type: "success",
              message: `${product.name} を追加しました`,
            });
          }
        } else {
          setNotification({
            type: "warning",
            message: `未登録のコード: ${cleaned}`,
          });
        }
      } catch {
        setNotification({
          type: "error",
          message: "処理中にエラーが発生しました",
        });
      } finally {
        setIsProcessing(false);
        setBarcodeInput("");
      }
    },
    [addItem, pendingBookProduct],
  );

  // 書籍2段目待機キャンセル
  const cancelPendingBook = useCallback(() => {
    setPendingBookProduct(null);
    setNotification({
      type: "warning",
      message: "書籍スキャンをキャンセルしました",
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && barcodeInput) {
        e.preventDefault();
        processBarcode(barcodeInput);
      }
    },
    [barcodeInput, processBarcode],
  );

  const handleCheckout = useCallback(() => {
    if (items.length > 0) {
      setShowCheckout(true);
    }
  }, [items.length]);

  const handleCheckoutComplete = useCallback((transaction: Transaction) => {
    setShowCheckout(false);
    setCompletedTransaction(transaction);
  }, []);

  const handleProductSelect = useCallback(
    (product: Product) => {
      addItem(product);
      setNotification({
        type: "success",
        message: `${product.name} を追加しました`,
      });
    },
    [addItem],
  );

  const handleLogout = useCallback(async () => {
    await logout();
    navigate({ to: "/login" });
  }, [logout, navigate]);

  if (!session) return null;

  return (
    <div className={layoutStyles.container}>
      {/* 隠しバーコード入力 */}
      <input
        ref={inputRef}
        type="text"
        value={barcodeInput}
        onChange={(e) => setBarcodeInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        className={hiddenInputStyle}
        aria-label="バーコード入力"
      />

      {/* ヘッダー */}
      <header className={layoutStyles.header}>
        <div className={layoutStyles.headerLeft}>
          <h1 className={layoutStyles.title}>mizPOS</h1>
          <Badge variant={settings.eventName ? "info" : "default"}>
            {settings.eventName || "イベント未設定"}
          </Badge>
        </div>
        <div className={layoutStyles.headerRight}>
          <span className={staffIdStyle}>ID: {session.staffId}</span>
          <Button
            variant={isTrainingMode ? "danger" : "outline"}
            size="sm"
            onClick={toggleTrainingMode}
          >
            {isTrainingMode ? "トレーニング中" : "トレーニング"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/settings" })}
          >
            設定
          </Button>
          <Button variant="outlineDanger" size="sm" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>
      </header>

      {/* トレーニングモードバナー */}
      {isTrainingMode && (
        <div className={trainingBannerStyles.banner}>
          <span className={trainingBannerStyles.icon}>⚠️</span>
          トレーニングモード - 取引は記録されません
          <span className={trainingBannerStyles.icon}>⚠️</span>
        </div>
      )}

      {/* 通知バー */}
      {notification && (
        <div
          className={`${notificationStyles.base} ${notificationStyles[notification.type]}`}
        >
          {notification.type === "success" && "✓"}
          {notification.type === "error" && "✕"}
          {notification.type === "warning" && "!"}
          {notification.message}
        </div>
      )}

      {/* メインコンテンツ */}
      <main className={layoutStyles.main}>
        {/* 左: 商品リスト */}
        <section className={productSectionStyles.container}>
          {/* スキャン状態表示 */}
          <div
            className={`${productSectionStyles.scanArea} ${
              pendingBookProduct
                ? productSectionStyles.scanAreaBookSecond
                : isProcessing
                  ? productSectionStyles.scanAreaActive
                  : ""
            }`}
          >
            <div className={productSectionStyles.scanContent}>
              <div>
                <div className={productSectionStyles.scanStatus}>
                  {isProcessing && (
                    <span
                      className={css({
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#60a5fa",
                        animation: "pulse 1s ease-in-out infinite",
                      })}
                    />
                  )}
                  {pendingBookProduct && (
                    <span
                      className={css({
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#fb923c",
                        animation: "pulse 0.5s ease-in-out infinite",
                      })}
                    />
                  )}
                  {pendingBookProduct
                    ? `書籍: ${pendingBookProduct.name} - 2段目待機中`
                    : isProcessing
                      ? "読み取り中..."
                      : "スキャン待機中"}
                </div>
                <div
                  className={`${productSectionStyles.scanInput} ${!barcodeInput ? productSectionStyles.scanPlaceholder : ""}`}
                >
                  {barcodeInput ||
                    (pendingBookProduct
                      ? "2段目バーコードをスキャンしてください"
                      : "バーコードをスキャン / F1で手動入力")}
                </div>
              </div>
              <div className={css({ display: "flex", gap: "8px" })}>
                {pendingBookProduct ? (
                  <Button variant="outlineDanger" onClick={cancelPendingBook}>
                    キャンセル
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setShowManualEntry(true)}
                    >
                      手動入力 (F1)
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setShowProductSelect(true)}
                    >
                      商品選択 (F4)
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 商品リスト */}
          <div className={productSectionStyles.list}>
            {items.length === 0 ? (
              <div className={productSectionStyles.emptyState}>
                <div className={productSectionStyles.emptyIcon}>📦</div>
                <div className={productSectionStyles.emptyText}>
                  商品をスキャンしてください
                </div>
              </div>
            ) : (
              <div className={productSectionStyles.itemsContainer}>
                {items.map((item, index) => (
                  <div key={item.product.id} className={itemStyles.card}>
                    <div className={itemStyles.info}>
                      <div className={itemStyles.index}>#{index + 1}</div>
                      <div className={itemStyles.name}>{item.product.name}</div>
                      {item.product.circleName && (
                        <div className={itemStyles.circle}>
                          {item.product.circleName}
                        </div>
                      )}
                    </div>

                    {/* 数量コントロール */}
                    <div className={itemStyles.quantityControl}>
                      <IconButton
                        label="数量を減らす"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                      >
                        −
                      </IconButton>
                      <span className={itemStyles.quantity}>
                        {item.quantity}
                      </span>
                      <IconButton
                        label="数量を増やす"
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1)
                        }
                      >
                        +
                      </IconButton>
                    </div>

                    {/* 金額と削除 */}
                    <div className={itemStyles.priceSection}>
                      <div className={itemStyles.price}>
                        ¥{(item.product.price * item.quantity).toLocaleString()}
                      </div>
                      <IconButton
                        variant="danger"
                        label="削除"
                        onClick={() => removeItem(item.product.id)}
                      >
                        ×
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 右: 会計パネル */}
        <aside className={checkoutPanelStyles.container}>
          {/* 合計表示 */}
          <div className={checkoutPanelStyles.totalArea}>
            <div className={checkoutPanelStyles.totalLabel}>
              合計 ({totalQuantity}点)
            </div>
            <div className={checkoutPanelStyles.totalAmount}>
              ¥{total.toLocaleString()}
            </div>
            <div className={checkoutPanelStyles.taxInfo}>
              (税{settings.taxRate}%込)
            </div>
          </div>

          {/* アクションボタン */}
          <div className={checkoutPanelStyles.actions}>
            <Button
              variant="primary"
              size="xl"
              fullWidth
              onClick={handleCheckout}
              disabled={items.length === 0}
              className={checkoutPanelStyles.checkoutButton}
            >
              会計 (F2)
            </Button>
            <Button
              variant="outlineDanger"
              size="lg"
              fullWidth
              onClick={() => clear()}
              disabled={items.length === 0}
            >
              カートをクリア (F3)
            </Button>
          </div>
        </aside>
      </main>

      {/* モーダル */}
      {showManualEntry && (
        <ManualProductEntry onClose={() => setShowManualEntry(false)} />
      )}
      <ProductSelectModal
        isOpen={showProductSelect}
        onClose={() => setShowProductSelect(false)}
        onSelect={handleProductSelect}
      />
      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
          isTrainingMode={isTrainingMode}
        />
      )}
      {completedTransaction && (
        <ReceiptModal
          transaction={completedTransaction}
          onClose={() => setCompletedTransaction(null)}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/pos")({
  component: POSPage,
});
