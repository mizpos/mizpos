import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { CheckoutModal } from "../components/CheckoutModal";
import { ManualProductEntry } from "../components/ManualProductEntry";
import { ReceiptModal } from "../components/ReceiptModal";
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

function POSPage() {
  const { session, logout } = useAuthStore();
  const navigate = useNavigate();
  const { items, addItem, removeItem, updateQuantity, getTotal, getTotalQuantity, clear } = useCartStore();
  const { settings } = useSettingsStore();

  const [barcodeInput, setBarcodeInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);

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
      if (!showManualEntry && !showCheckout && !completedTransaction) {
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
  }, [showManualEntry, showCheckout, completedTransaction]);

  // 通知を自動で消す
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const processBarcode = useCallback(
    async (code: string) => {
      const cleaned = code.replace(/[-\s]/g, "").trim();
      if (!cleaned) return;

      setIsProcessing(true);
      try {
        const codeType = classifyCode(cleaned);
        let product: Product | undefined;

        if (codeType === "jan") {
          product = await findProductByJan(cleaned);
        } else if (codeType === "isbn") {
          product = await findProductByIsbn(cleaned);
          if (!product) product = await findProductByJan(cleaned);
        } else {
          setNotification({ type: "error", message: "不明なコード形式" });
          return;
        }

        if (product) {
          addItem(product);
          setNotification({ type: "success", message: `${product.name} を追加` });
        } else {
          setNotification({ type: "warning", message: `未登録: ${cleaned}` });
        }
      } catch (error) {
        setNotification({ type: "error", message: "処理エラー" });
      } finally {
        setIsProcessing(false);
        setBarcodeInput("");
      }
    },
    [addItem]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        processBarcode(barcodeInput);
      }
    },
    [barcodeInput, processBarcode]
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

  const handleLogout = useCallback(async () => {
    await logout();
    navigate({ to: "/login" });
  }, [logout, navigate]);

  if (!session) return null;

  return (
    <div className={css({
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#0f172a",
      color: "white",
      overflow: "hidden",
      userSelect: "none",
    })}>
      {/* 隠しバーコード入力 */}
      <input
        ref={inputRef}
        type="text"
        value={barcodeInput}
        onChange={(e) => setBarcodeInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        className={css({
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
        })}
        aria-label="バーコード入力"
      />

      {/* ヘッダー */}
      <header className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
      })}>
        <div className={css({ display: "flex", alignItems: "center", gap: "16px" })}>
          <h1 className={css({
            fontSize: "20px",
            fontWeight: 700,
            margin: 0,
            color: "#f8fafc",
          })}>
            mizPOS
          </h1>
          <span className={css({
            fontSize: "13px",
            color: "#94a3b8",
            padding: "4px 10px",
            background: "#334155",
            borderRadius: "4px",
          })}>
            {settings.eventName || "イベント未設定"}
          </span>
        </div>
        <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
          <span className={css({ fontSize: "13px", color: "#94a3b8" })}>
            ID: {session.staffId}
          </span>
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className={css({
              padding: "8px 12px",
              fontSize: "13px",
              color: "#94a3b8",
              background: "transparent",
              border: "1px solid #475569",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { background: "#334155", color: "#f8fafc" },
            })}
          >
            設定
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className={css({
              padding: "8px 12px",
              fontSize: "13px",
              color: "#f87171",
              background: "transparent",
              border: "1px solid #7f1d1d",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { background: "#7f1d1d", color: "#fecaca" },
            })}
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* 通知バー */}
      {notification && (
        <div className={css({
          padding: "12px 20px",
          fontSize: "14px",
          fontWeight: 500,
          textAlign: "center",
          animation: "slideDown 0.2s ease-out",
          background: notification.type === "success" ? "#166534"
            : notification.type === "error" ? "#991b1b"
            : "#92400e",
        })}>
          {notification.message}
        </div>
      )}

      {/* メインコンテンツ */}
      <main className={css({
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: "0",
        overflow: "hidden",
      })}>
        {/* 左: 商品リスト */}
        <section className={css({
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #334155",
          overflow: "hidden",
        })}>
          {/* スキャン状態表示 */}
          <div className={css({
            padding: "20px",
            background: isProcessing ? "#1e40af" : "#1e293b",
            borderBottom: "1px solid #334155",
            transition: "background 0.15s",
          })}>
            <div className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            })}>
              <div>
                <div className={css({
                  fontSize: "13px",
                  color: "#94a3b8",
                  marginBottom: "4px",
                })}>
                  {isProcessing ? "読み取り中..." : "スキャン待機中"}
                </div>
                <div className={css({
                  fontSize: "18px",
                  fontFamily: "monospace",
                  color: barcodeInput ? "#f8fafc" : "#475569",
                  minHeight: "24px",
                })}>
                  {barcodeInput || "バーコードをスキャンしてください"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className={css({
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#f8fafc",
                  background: "#3b82f6",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  "&:hover": { background: "#2563eb" },
                })}
              >
                手動入力
              </button>
            </div>
          </div>

          {/* 商品リスト */}
          <div className={css({
            flex: 1,
            overflowY: "auto",
            padding: "12px",
          })}>
            {items.length === 0 ? (
              <div className={css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#475569",
              })}>
                <div className={css({ fontSize: "48px", marginBottom: "16px", opacity: 0.5 })}>
                  📦
                </div>
                <div className={css({ fontSize: "16px" })}>
                  商品をスキャンしてください
                </div>
              </div>
            ) : (
              <div className={css({ display: "flex", flexDirection: "column", gap: "8px" })}>
                {items.map((item, index) => (
                  <div
                    key={item.product.id}
                    className={css({
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      alignItems: "center",
                      gap: "16px",
                      padding: "16px",
                      background: "#1e293b",
                      borderRadius: "8px",
                      border: "1px solid #334155",
                    })}
                  >
                    <div className={css({ minWidth: 0 })}>
                      <div className={css({
                        fontSize: "12px",
                        color: "#64748b",
                        marginBottom: "2px",
                      })}>
                        #{index + 1}
                      </div>
                      <div className={css({
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#f8fafc",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      })}>
                        {item.product.name}
                      </div>
                      {item.product.circleName && (
                        <div className={css({
                          fontSize: "12px",
                          color: "#94a3b8",
                          marginTop: "2px",
                        })}>
                          {item.product.circleName}
                        </div>
                      )}
                    </div>

                    {/* 数量コントロール */}
                    <div className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    })}>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className={css({
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#334155",
                          border: "none",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "20px",
                          cursor: "pointer",
                          transition: "background 0.15s",
                          "&:hover": { background: "#475569" },
                        })}
                      >
                        −
                      </button>
                      <span className={css({
                        minWidth: "32px",
                        textAlign: "center",
                        fontSize: "18px",
                        fontWeight: 600,
                        fontFamily: "monospace",
                      })}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className={css({
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#334155",
                          border: "none",
                          borderRadius: "8px",
                          color: "#f8fafc",
                          fontSize: "20px",
                          cursor: "pointer",
                          transition: "background 0.15s",
                          "&:hover": { background: "#475569" },
                        })}
                      >
                        +
                      </button>
                    </div>

                    {/* 金額と削除 */}
                    <div className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    })}>
                      <div className={css({
                        fontSize: "16px",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        color: "#f8fafc",
                        minWidth: "80px",
                        textAlign: "right",
                      })}>
                        ¥{(item.product.price * item.quantity).toLocaleString()}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.product.id)}
                        className={css({
                          width: "40px",
                          height: "40px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#7f1d1d",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fecaca",
                          fontSize: "18px",
                          cursor: "pointer",
                          transition: "background 0.15s",
                          "&:hover": { background: "#991b1b" },
                        })}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 右: 会計パネル */}
        <aside className={css({
          display: "flex",
          flexDirection: "column",
          background: "#1e293b",
        })}>
          {/* 合計表示 */}
          <div className={css({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 20px",
          })}>
            <div className={css({
              fontSize: "14px",
              color: "#64748b",
              marginBottom: "8px",
            })}>
              合計 ({totalQuantity}点)
            </div>
            <div className={css({
              fontSize: "52px",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#f8fafc",
              letterSpacing: "-0.02em",
            })}>
              ¥{total.toLocaleString()}
            </div>
            <div className={css({
              fontSize: "13px",
              color: "#64748b",
              marginTop: "8px",
            })}>
              (税{settings.taxRate}%込)
            </div>
          </div>

          {/* アクションボタン */}
          <div className={css({
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            borderTop: "1px solid #334155",
          })}>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={items.length === 0}
              className={css({
                padding: "24px",
                fontSize: "22px",
                fontWeight: 700,
                color: "white",
                background: items.length > 0 ? "#16a34a" : "#334155",
                border: "none",
                borderRadius: "12px",
                cursor: items.length > 0 ? "pointer" : "not-allowed",
                transition: "background 0.15s, transform 0.1s",
                "&:hover:not(:disabled)": { background: "#15803d" },
                "&:active:not(:disabled)": { transform: "scale(0.98)" },
              })}
            >
              会計
            </button>
            <button
              type="button"
              onClick={() => clear()}
              disabled={items.length === 0}
              className={css({
                padding: "16px",
                fontSize: "15px",
                fontWeight: 600,
                color: items.length > 0 ? "#f87171" : "#475569",
                background: "transparent",
                border: items.length > 0 ? "2px solid #7f1d1d" : "2px solid #334155",
                borderRadius: "10px",
                cursor: items.length > 0 ? "pointer" : "not-allowed",
                transition: "all 0.15s",
                "&:hover:not(:disabled)": {
                  background: "#7f1d1d",
                  color: "#fecaca",
                },
              })}
            >
              カートをクリア
            </button>
          </div>
        </aside>
      </main>

      {/* モーダル */}
      {showManualEntry && (
        <ManualProductEntry onClose={() => setShowManualEntry(false)} />
      )}
      {showCheckout && (
        <CheckoutModal
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckoutComplete}
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
