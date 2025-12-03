import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { saveTransaction } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { useSettingsStore } from "../stores/settings";
import type { Payment, PaymentMethod, Transaction } from "../types";

interface CheckoutModalProps {
  onClose: () => void;
  onComplete: (transaction: Transaction) => void;
}

export function CheckoutModal({ onClose, onComplete }: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { items, getSubtotal, getTaxAmount, getTotal, clear } = useCartStore();
  const { settings } = useSettingsStore();
  const { session } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const taxRate = settings.taxRate;
  const subtotal = getSubtotal();
  const taxAmount = getTaxAmount(taxRate);
  const total = getTotal(taxRate);
  const received = receivedAmount ? Number.parseInt(receivedAmount, 10) : 0;
  const change = received - total;

  // 現金入力にフォーカス
  useEffect(() => {
    if (paymentMethod === "cash") {
      inputRef.current?.focus();
    }
  }, [paymentMethod]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isProcessing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value === "" || Number.parseInt(value, 10) <= 10000000) {
      setReceivedAmount(value);
    }
  }, []);

  const handleQuickAmount = useCallback((amount: number) => {
    setReceivedAmount(String(amount));
  }, []);

  const handleComplete = useCallback(async () => {
    if (!session) return;
    if (paymentMethod === "cash" && change < 0) return;

    setIsProcessing(true);

    try {
      const payments: Payment[] = [
        {
          method: paymentMethod,
          amount: paymentMethod === "cash" ? received : total,
        },
      ];

      const transaction: Transaction = {
        id: `txn-${Date.now()}`,
        items: [...items],
        subtotal,
        taxRate,
        taxAmount,
        total,
        payments,
        staffId: session.staffId,
        createdAt: new Date(),
      };

      await saveTransaction(transaction);
      clear();
      onComplete(transaction);
    } catch (error) {
      console.error("Checkout failed:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    session,
    paymentMethod,
    change,
    received,
    total,
    items,
    subtotal,
    taxRate,
    taxAmount,
    clear,
    onComplete,
  ]);

  const quickAmounts = [1000, 2000, 3000, 5000, 10000];

  return (
    <div className={css({
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    })}>
      <div className={css({
        background: "#1e293b",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "480px",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "#f8fafc",
      })}>
        {/* ヘッダー */}
        <div className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 24px",
          borderBottom: "1px solid #334155",
        })}>
          <h2 className={css({ margin: 0, fontSize: "20px", fontWeight: 700 })}>
            会計
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className={css({
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#334155",
              border: "none",
              borderRadius: "8px",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { background: "#475569", color: "#f8fafc" },
              "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
            })}
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <div className={css({ padding: "24px" })}>
          {/* 合計金額 */}
          <div className={css({
            textAlign: "center",
            padding: "28px",
            background: "#0f172a",
            borderRadius: "12px",
            marginBottom: "24px",
          })}>
            <div className={css({ fontSize: "13px", color: "#64748b", marginBottom: "8px" })}>
              お会計
            </div>
            <div className={css({
              fontSize: "48px",
              fontWeight: 700,
              fontFamily: "monospace",
              color: "#f8fafc",
              letterSpacing: "-0.02em",
            })}>
              ¥{total.toLocaleString()}
            </div>
          </div>

          {/* 支払い方法 */}
          <div className={css({ marginBottom: "24px" })}>
            <div className={css({
              fontSize: "13px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "10px",
            })}>
              支払い方法
            </div>
            <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" })}>
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={css({
                  padding: "16px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: paymentMethod === "cash" ? "#0f172a" : "#94a3b8",
                  background: paymentMethod === "cash" ? "#22c55e" : "#334155",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": {
                    background: paymentMethod === "cash" ? "#22c55e" : "#475569",
                  },
                })}
              >
                現金
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("oya_cashless")}
                className={css({
                  padding: "16px",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: paymentMethod === "oya_cashless" ? "#0f172a" : "#94a3b8",
                  background: paymentMethod === "oya_cashless" ? "#3b82f6" : "#334155",
                  border: "none",
                  borderRadius: "10px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": {
                    background: paymentMethod === "oya_cashless" ? "#3b82f6" : "#475569",
                  },
                })}
              >
                大家キャッシュレス
              </button>
            </div>
          </div>

          {/* 現金入力 */}
          {paymentMethod === "cash" && (
            <>
              {/* 金額入力 */}
              <div className={css({ marginBottom: "16px" })}>
                <div className={css({
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "10px",
                })}>
                  お預かり金額
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  value={receivedAmount ? `¥${Number.parseInt(receivedAmount, 10).toLocaleString()}` : ""}
                  onChange={handleInputChange}
                  placeholder="¥0"
                  className={css({
                    width: "100%",
                    padding: "16px",
                    fontSize: "28px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    textAlign: "right",
                    color: "#f8fafc",
                    background: "#0f172a",
                    border: "2px solid #334155",
                    borderRadius: "10px",
                    outline: "none",
                    transition: "border-color 0.15s",
                    "&:focus": { borderColor: "#3b82f6" },
                    "&::placeholder": { color: "#475569" },
                  })}
                />
              </div>

              {/* クイック金額ボタン */}
              <div className={css({
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "8px",
                marginBottom: "16px",
              })}>
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleQuickAmount(amount)}
                    className={css({
                      padding: "14px 8px",
                      fontSize: "14px",
                      fontWeight: 600,
                      fontFamily: "monospace",
                      color: "#f8fafc",
                      background: "#334155",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      "&:hover": { background: "#475569" },
                    })}
                  >
                    ¥{amount.toLocaleString()}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleQuickAmount(total)}
                  className={css({
                    padding: "14px 8px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#22c55e",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    "&:hover": { background: "#16a34a" },
                  })}
                >
                  ぴったり
                </button>
              </div>

              {/* おつり表示 */}
              <div className={css({
                padding: "16px 20px",
                background: change >= 0 ? "#14532d" : "#7f1d1d",
                borderRadius: "10px",
                marginBottom: "24px",
              })}>
                <div className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}>
                  <span className={css({ fontSize: "14px", color: change >= 0 ? "#86efac" : "#fecaca" })}>
                    おつり
                  </span>
                  <span className={css({
                    fontSize: "28px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: "#f8fafc",
                  })}>
                    {change >= 0 ? `¥${change.toLocaleString()}` : "−"}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* キャッシュレス選択時 */}
          {paymentMethod === "oya_cashless" && (
            <div className={css({
              padding: "24px",
              background: "#1e40af",
              borderRadius: "10px",
              marginBottom: "24px",
              textAlign: "center",
            })}>
              <div className={css({ fontSize: "14px", color: "#93c5fd", marginBottom: "4px" })}>
                決済金額
              </div>
              <div className={css({
                fontSize: "32px",
                fontWeight: 700,
                fontFamily: "monospace",
              })}>
                ¥{total.toLocaleString()}
              </div>
            </div>
          )}

          {/* 完了ボタン */}
          <button
            type="button"
            onClick={handleComplete}
            disabled={isProcessing || (paymentMethod === "cash" && change < 0)}
            className={css({
              width: "100%",
              padding: "20px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#0f172a",
              background: "#22c55e",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover:not(:disabled)": { background: "#16a34a" },
              "&:active:not(:disabled)": { transform: "scale(0.98)" },
              "&:disabled": {
                background: "#334155",
                color: "#64748b",
                cursor: "not-allowed",
              },
            })}
          >
            {isProcessing ? "処理中..." : "会計完了"}
          </button>
        </div>
      </div>
    </div>
  );
}
