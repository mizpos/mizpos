import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { saveTransaction, updateSalesSummary } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { type AppliedCoupon, useCartStore } from "../stores/cart";
import { useSettingsStore } from "../stores/settings";
import type { Payment, PaymentMethod, Transaction } from "../types";
import { Button, Modal } from "./ui";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// クーポン入力スタイル
const couponStyles = {
  container: css({
    marginBottom: "24px",
    padding: "16px",
    background: "#1e293b",
    borderRadius: "12px",
  }),
  label: css({
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "10px",
  }),
  inputRow: css({
    display: "flex",
    gap: "8px",
  }),
  input: css({
    flex: 1,
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#f8fafc",
    background: "#0f172a",
    border: "2px solid #334155",
    borderRadius: "8px",
    outline: "none",
    textTransform: "uppercase",
    transition: "border-color 0.15s ease",
    _focus: {
      borderColor: "#3b82f6",
    },
    _placeholder: { color: "#475569" },
  }),
  applyButton: css({
    padding: "12px 20px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#f8fafc",
    background: "#6366f1",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.15s ease",
    _hover: { background: "#4f46e5" },
    _disabled: {
      background: "#334155",
      cursor: "not-allowed",
    },
  }),
  applied: css({
    marginTop: "12px",
    padding: "12px 14px",
    background: "#14532d",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  appliedInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  }),
  appliedCode: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#86efac",
  }),
  appliedDiscount: css({
    fontSize: "13px",
    color: "#4ade80",
  }),
  removeButton: css({
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 500,
    color: "#fecaca",
    background: "transparent",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: {
      background: "#7f1d1d",
      color: "#f8fafc",
    },
  }),
  error: css({
    marginTop: "8px",
    fontSize: "13px",
    color: "#f87171",
  }),
};

interface CheckoutModalProps {
  onClose: () => void;
  onComplete: (transaction: Transaction) => void;
  isTrainingMode?: boolean;
}

// 合計表示スタイル
const totalDisplayStyles = {
  container: css({
    textAlign: "center",
    padding: "32px",
    background: "#0f172a",
    borderRadius: "14px",
    marginBottom: "24px",
  }),
  label: css({
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "8px",
    fontWeight: 500,
  }),
  amount: css({
    fontSize: "52px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f8fafc",
    letterSpacing: "-0.02em",
    lineHeight: 1,
  }),
};

// 支払い方法選択スタイル
const paymentMethodStyles = {
  container: css({
    marginBottom: "24px",
  }),
  label: css({
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "10px",
  }),
  buttons: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  }),
  button: css({
    padding: "18px",
    fontSize: "15px",
    fontWeight: 600,
    border: "2px solid transparent",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  }),
  buttonCash: css({
    color: "#0f172a",
    background: "#22c55e",
    borderColor: "#22c55e",
  }),
  buttonCashless: css({
    color: "#f8fafc",
    background: "#3b82f6",
    borderColor: "#3b82f6",
  }),
  buttonInactive: css({
    color: "#94a3b8",
    background: "#334155",
    borderColor: "#334155",
    _hover: {
      background: "#475569",
      borderColor: "#475569",
    },
  }),
};

// 現金入力スタイル
const cashInputStyles = {
  label: css({
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "10px",
  }),
  input: css({
    width: "100%",
    padding: "18px",
    fontSize: "32px",
    fontWeight: 700,
    fontFamily: "monospace",
    textAlign: "right",
    color: "#f8fafc",
    background: "#0f172a",
    border: "2px solid #334155",
    borderRadius: "12px",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    _focus: {
      borderColor: "#3b82f6",
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
    },
    _placeholder: { color: "#475569" },
  }),
  quickGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginTop: "16px",
    marginBottom: "16px",
  }),
  quickButton: css({
    padding: "14px 8px",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
    background: "#334155",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: { background: "#475569" },
    _active: { transform: "scale(0.97)" },
  }),
  quickButtonExact: css({
    color: "#0f172a",
    background: "#22c55e",
    _hover: { background: "#16a34a" },
  }),
};

// おつり表示スタイル
const changeDisplayStyles = {
  container: css({
    padding: "18px 20px",
    borderRadius: "12px",
    marginBottom: "24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  valid: css({
    background: "#14532d",
  }),
  invalid: css({
    background: "#7f1d1d",
  }),
  label: css({
    fontSize: "15px",
    fontWeight: 500,
  }),
  labelValid: css({
    color: "#86efac",
  }),
  labelInvalid: css({
    color: "#fecaca",
  }),
  amount: css({
    fontSize: "32px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f8fafc",
  }),
};

// キャッシュレス表示スタイル
const cashlessDisplayStyles = {
  container: css({
    padding: "28px",
    background: "#1e40af",
    borderRadius: "14px",
    marginBottom: "24px",
    textAlign: "center",
  }),
  label: css({
    fontSize: "14px",
    color: "#93c5fd",
    marginBottom: "8px",
    fontWeight: 500,
  }),
  amount: css({
    fontSize: "36px",
    fontWeight: 700,
    fontFamily: "monospace",
  }),
};

export function CheckoutModal({
  onClose,
  onComplete,
  isTrainingMode = false,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const {
    items,
    appliedCoupon,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    applyCoupon,
    removeCoupon,
    clear,
  } = useCartStore();
  const { settings } = useSettingsStore();
  const { session } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const taxRate = settings.taxRate;
  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      if (value === "" || Number.parseInt(value, 10) <= 10000000) {
        setReceivedAmount(value);
      }
    },
    [],
  );

  const handleQuickAmount = useCallback((amount: number) => {
    setReceivedAmount(String(amount));
  }, []);

  // クーポン適用
  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim() || !session) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/accounts/coupons/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-POS-Session": session.sessionId,
        },
        body: JSON.stringify({
          code: couponCode.toUpperCase(),
          subtotal: subtotal,
          publisher_id: session.publisherId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setCouponError(error.detail || "クーポンの適用に失敗しました");
        return;
      }

      const data = await response.json();
      const appliedCouponData: AppliedCoupon = {
        code: data.code,
        name: data.name,
        discountType: data.discount_type,
        discountValue: data.discount_value,
        discountAmount: data.discount_amount,
      };

      applyCoupon(appliedCouponData);
      setCouponCode("");
    } catch (error) {
      console.error("Error applying coupon:", error);
      setCouponError("クーポンの適用に失敗しました");
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [couponCode, session, subtotal, applyCoupon]);

  // クーポン削除
  const handleRemoveCoupon = useCallback(() => {
    removeCoupon();
    setCouponError(null);
  }, [removeCoupon]);

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
        isTraining: isTrainingMode,
      };

      // トレーニングモード時はDBへの保存とAPIへの送信をスキップ
      if (!isTrainingMode) {
        // ローカルDBに保存
        await saveTransaction(transaction);
        // 販売サマリーを更新
        await updateSalesSummary(transaction);

        // バックエンドに送信
        try {
          const saleItems = items.map((item) => ({
            product_id: item.product.id,
            product_name: item.product.name,
            circle_name: item.product.circleName || null,
            jan: item.product.jan,
            jan2: item.product.jan2 || null,
            isbn: item.product.isbn || null,
            isdn: item.product.isdn || null,
            quantity: item.quantity,
            unit_price: item.product.price,
          }));

          // クーポン情報を含めたリクエストボディ
          const saleBody: Record<string, unknown> = {
            items: saleItems,
            total_amount: total,
            payment_method: paymentMethod,
            event_id: session.eventId,
            terminal_id: settings.terminalId,
          };

          // クーポンが適用されている場合は追加
          if (appliedCoupon) {
            saleBody.coupon_code = appliedCoupon.code;
            saleBody.subtotal = subtotal;
          }

          const response = await fetch(`${API_BASE_URL}/accounts/pos/sales`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-POS-Session": session.sessionId,
            },
            body: JSON.stringify(saleBody),
          });

          if (!response.ok) {
            console.error(
              "Failed to send sale to backend:",
              response.statusText,
            );
            // バックエンド送信失敗時もローカルには保存済みなので続行
          } else {
            console.log("Sale successfully sent to backend");
          }
        } catch (apiError) {
          console.error("Error sending sale to backend:", apiError);
          // ネットワークエラー等でもローカル保存は成功しているので続行
        }
      } else {
        console.log("Training mode: Transaction not saved");
      }

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
    settings.terminalId,
    appliedCoupon,
    isTrainingMode,
  ]);

  // Enterキーで会計完了
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && paymentMethod === "cash" && change >= 0) {
        e.preventDefault();
        handleComplete();
      }
    },
    [paymentMethod, change, handleComplete],
  );

  const quickAmounts = [1000, 2000, 3000, 5000, 10000];
  const canComplete = paymentMethod !== "cash" || change >= 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={isTrainingMode ? "会計 (トレーニング)" : "会計"}
      maxWidth="500px"
      disableClose={isProcessing}
    >
      {/* トレーニングモード警告 */}
      {isTrainingMode && (
        <div
          className={css({
            padding: "12px 16px",
            marginBottom: "16px",
            background:
              "linear-gradient(90deg, #dc2626 0%, #ea580c 50%, #dc2626 100%)",
            borderRadius: "8px",
            textAlign: "center",
            fontSize: "14px",
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.05em",
          })}
        >
          トレーニングモード - この取引は記録されません
        </div>
      )}
      {/* 合計金額 */}
      <div className={totalDisplayStyles.container}>
        <div className={totalDisplayStyles.label}>お会計</div>
        <div className={totalDisplayStyles.amount}>
          ¥{total.toLocaleString()}
        </div>
        {/* 割引がある場合は内訳を表示 */}
        {discountAmount > 0 && (
          <div
            className={css({
              marginTop: "12px",
              fontSize: "14px",
              color: "#94a3b8",
            })}
          >
            <div>小計: ¥{subtotal.toLocaleString()}</div>
            <div className={css({ color: "#4ade80" })}>
              割引: -¥{discountAmount.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* クーポン入力 */}
      <div className={couponStyles.container}>
        <div className={couponStyles.label}>クーポン</div>
        {appliedCoupon ? (
          <div className={couponStyles.applied}>
            <div className={couponStyles.appliedInfo}>
              <span className={couponStyles.appliedCode}>
                {appliedCoupon.code} - {appliedCoupon.name}
              </span>
              <span className={couponStyles.appliedDiscount}>
                -¥{appliedCoupon.discountAmount.toLocaleString()} 割引
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveCoupon}
              className={couponStyles.removeButton}
            >
              削除
            </button>
          </div>
        ) : (
          <>
            <div className={couponStyles.inputRow}>
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="クーポンコード"
                className={couponStyles.input}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={!couponCode.trim() || isApplyingCoupon}
                className={couponStyles.applyButton}
              >
                {isApplyingCoupon ? "..." : "適用"}
              </button>
            </div>
            {couponError && (
              <div className={couponStyles.error}>{couponError}</div>
            )}
          </>
        )}
      </div>

      {/* 支払い方法 */}
      <div className={paymentMethodStyles.container}>
        <div className={paymentMethodStyles.label}>支払い方法</div>
        <div className={paymentMethodStyles.buttons}>
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={`${paymentMethodStyles.button} ${paymentMethod === "cash" ? paymentMethodStyles.buttonCash : paymentMethodStyles.buttonInactive}`}
          >
            現金
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("oya_cashless")}
            className={`${paymentMethodStyles.button} ${paymentMethod === "oya_cashless" ? paymentMethodStyles.buttonCashless : paymentMethodStyles.buttonInactive}`}
          >
            大家キャッシュレス
          </button>
        </div>
      </div>

      {/* 現金入力 */}
      {paymentMethod === "cash" && (
        <>
          <div className={css({ marginBottom: "16px" })}>
            <div className={cashInputStyles.label}>お預かり金額</div>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={
                receivedAmount
                  ? `¥${Number.parseInt(receivedAmount, 10).toLocaleString()}`
                  : ""
              }
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="¥0"
              className={cashInputStyles.input}
            />
          </div>

          {/* クイック金額ボタン */}
          <div className={cashInputStyles.quickGrid}>
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAmount(amount)}
                className={cashInputStyles.quickButton}
              >
                ¥{amount.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleQuickAmount(total)}
              className={`${cashInputStyles.quickButton} ${cashInputStyles.quickButtonExact}`}
            >
              ぴったり
            </button>
          </div>

          {/* おつり表示 */}
          <div
            className={`${changeDisplayStyles.container} ${change >= 0 ? changeDisplayStyles.valid : changeDisplayStyles.invalid}`}
          >
            <span
              className={`${changeDisplayStyles.label} ${change >= 0 ? changeDisplayStyles.labelValid : changeDisplayStyles.labelInvalid}`}
            >
              おつり
            </span>
            <span className={changeDisplayStyles.amount}>
              {change >= 0 ? `¥${change.toLocaleString()}` : "−"}
            </span>
          </div>
        </>
      )}

      {/* キャッシュレス選択時 */}
      {paymentMethod === "oya_cashless" && (
        <div className={cashlessDisplayStyles.container}>
          <div className={cashlessDisplayStyles.label}>決済金額</div>
          <div className={cashlessDisplayStyles.amount}>
            ¥{total.toLocaleString()}
          </div>
        </div>
      )}

      {/* 完了ボタン */}
      <Button
        variant="primary"
        size="xl"
        fullWidth
        onClick={handleComplete}
        disabled={isProcessing || !canComplete}
      >
        {isProcessing ? "処理中..." : "会計完了 (Enter)"}
      </Button>
    </Modal>
  );
}
