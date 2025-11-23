import { useState } from "react";
import { css } from "styled-system/css";
import { formatPrice, useCartStore } from "../stores/cart";
import { useNetworkStore } from "../stores/network";
import { NumericKeypad } from "./NumericKeypad";

// 共有スタイル (ReceiptModalでも使用)
const modalOverlayStyle = css({
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
});

const modalBackdropStyle = css({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.6)",
  border: "none",
  cursor: "pointer",
});

const checkoutModalStyle = css({
  position: "relative",
  background: "white",
  borderRadius: "20px",
  width: "90%",
  maxWidth: "500px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  zIndex: 1,
});

const modalHeaderStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid #e0e0e0",
});

const modalTitleStyle = css({
  margin: 0,
  fontSize: "20px",
  fontWeight: 600,
});

const closeButtonStyle = css({
  width: "36px",
  height: "36px",
  fontSize: "24px",
  color: "#666",
  background: "transparent",
  border: "none",
  borderRadius: "50%",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    background: "#f5f5f5",
    color: "#333",
  },
});

const modalBodyStyle = css({
  padding: "24px",
});

// クーポンセクション
const couponSectionStyle = css({
  marginBottom: "20px",
  paddingBottom: "16px",
  borderBottom: "1px solid #e0e0e0",
});

const couponInputRowStyle = css({
  display: "flex",
  gap: "8px",
});

const couponInputStyle = css({
  flex: 1,
  padding: "12px 16px",
  fontSize: "14px",
  border: "2px solid #e0e0e0",
  borderRadius: "8px",
  textTransform: "uppercase",
  _focus: {
    outline: "none",
    borderColor: "#1a237e",
  },
  _disabled: {
    background: "#f5f5f5",
    cursor: "not-allowed",
  },
});

const applyCouponButtonStyle = css({
  padding: "12px 20px",
  fontSize: "14px",
  fontWeight: 600,
  color: "white",
  background: "#1a237e",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    _enabled: {
      background: "#303f9f",
    },
  },
  _disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

const appliedCouponStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  background: "#e8f5e9",
  border: "2px solid #a5d6a7",
  borderRadius: "8px",
});

const couponInfoStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
});

const couponNameStyle = css({
  fontSize: "14px",
  fontWeight: 600,
  color: "#2e7d32",
});

const couponDiscountStyle = css({
  fontSize: "16px",
  fontWeight: 700,
  color: "#2e7d32",
});

const removeCouponButtonStyle = css({
  padding: "8px 16px",
  fontSize: "12px",
  fontWeight: 500,
  color: "#666",
  background: "white",
  border: "1px solid #e0e0e0",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    background: "#f5f5f5",
    borderColor: "#bdbdbd",
  },
});

const couponOfflineNoteStyle = css({
  margin: "8px 0 0 0",
  fontSize: "12px",
  color: "#999",
});

// 金額表示
const checkoutAmountsStyle = css({
  background: "#f5f5f5",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "24px",
});

const amountRowStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
});

const amountRowTotalStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  paddingTop: "12px",
  marginTop: "8px",
  borderTop: "1px solid #e0e0e0",
});

const amountLabelStyle = css({
  fontSize: "14px",
  color: "#666",
});

const amountValueStyle = css({
  fontSize: "18px",
  fontWeight: 600,
  color: "#333",
});

const discountLabelStyle = css({
  fontSize: "14px",
  color: "#d32f2f",
});

const discountValueStyle = css({
  fontSize: "18px",
  fontWeight: 600,
  color: "#d32f2f",
});

const totalLabelStyle = css({
  fontSize: "16px",
  fontWeight: 600,
  color: "#333",
});

const totalValueStyle = css({
  fontSize: "28px",
  fontWeight: 700,
  color: "#1a237e",
});

// 支払い方法
const paymentMethodSectionStyle = css({
  marginBottom: "24px",
});

const sectionLabelStyle = css({
  display: "block",
  fontSize: "14px",
  fontWeight: 600,
  color: "#333",
  marginBottom: "12px",
});

const paymentButtonsStyle = css({
  display: "flex",
  gap: "12px",
});

const paymentButtonStyle = css({
  flex: 1,
  padding: "16px",
  fontSize: "16px",
  fontWeight: 600,
  color: "#666",
  background: "#f5f5f5",
  border: "2px solid #e0e0e0",
  borderRadius: "12px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    borderColor: "#bdbdbd",
  },
});

const paymentButtonActiveStyle = css({
  flex: 1,
  padding: "16px",
  fontSize: "16px",
  fontWeight: 600,
  color: "#1a237e",
  background: "#e8eaf6",
  border: "2px solid #1a237e",
  borderRadius: "12px",
  cursor: "pointer",
  transition: "all 0.2s",
});

const paymentButtonDisabledStyle = css({
  flex: 1,
  padding: "16px",
  fontSize: "16px",
  fontWeight: 600,
  color: "#666",
  background: "#f5f5f5",
  border: "2px solid #e0e0e0",
  borderRadius: "12px",
  cursor: "not-allowed",
  transition: "all 0.2s",
  opacity: 0.5,
  position: "relative",
  _hover: {
    borderColor: "#e0e0e0",
  },
});

const offlineBadgeStyle = css({
  display: "block",
  fontSize: "10px",
  fontWeight: 500,
  color: "#e65100",
  marginTop: "4px",
});

// 現金セクション
const cashSectionStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

const receivedDisplayStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  background: "#fafafa",
  border: "2px solid #e0e0e0",
  borderRadius: "12px",
});

const receivedLabelStyle = css({
  fontSize: "14px",
  color: "#666",
});

const receivedAmountStyle = css({
  fontSize: "28px",
  fontWeight: 700,
  color: "#333",
});

// クイック金額ボタン
const quickAmountsStyle = css({
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
});

const quickButtonStyle = css({
  flex: 1,
  minWidth: "80px",
  padding: "12px 16px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#333",
  background: "#fff",
  border: "1px solid #e0e0e0",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    background: "#f5f5f5",
    borderColor: "#bdbdbd",
  },
  _active: {
    transform: "scale(0.95)",
  },
});

const quickButtonExactStyle = css({
  flex: 1,
  minWidth: "80px",
  padding: "12px 16px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#1565c0",
  background: "#e3f2fd",
  border: "1px solid #90caf9",
  borderRadius: "8px",
  cursor: "pointer",
  transition: "all 0.2s",
  _hover: {
    background: "#bbdefb",
    borderColor: "#64b5f6",
  },
  _active: {
    transform: "scale(0.95)",
  },
});

// お釣り表示
const changeDisplayStyle = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  background: "#e8f5e9",
  border: "2px solid #a5d6a7",
  borderRadius: "12px",
});

const changeLabelStyle = css({
  fontSize: "14px",
  color: "#2e7d32",
});

const changeAmountStyle = css({
  fontSize: "28px",
  fontWeight: 700,
  color: "#2e7d32",
});

// エラー
const checkoutErrorStyle = css({
  padding: "12px 16px",
  background: "#ffebee",
  border: "1px solid #ef9a9a",
  borderRadius: "8px",
  color: "#c62828",
  fontSize: "14px",
  textAlign: "center",
});

// フッター
const modalFooterStyle = css({
  display: "flex",
  gap: "12px",
  padding: "20px 24px",
  borderTop: "1px solid #e0e0e0",
});

const cancelButtonStyle = css({
  flex: 1,
  padding: "16px",
  fontSize: "16px",
  fontWeight: 600,
  borderRadius: "12px",
  cursor: "pointer",
  transition: "all 0.2s",
  color: "#666",
  background: "#f5f5f5",
  border: "1px solid #e0e0e0",
  _hover: {
    _enabled: {
      background: "#e0e0e0",
    },
  },
  _disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

const confirmButtonStyle = css({
  flex: 1,
  padding: "16px",
  fontSize: "16px",
  fontWeight: 600,
  borderRadius: "12px",
  cursor: "pointer",
  transition: "all 0.2s",
  color: "white",
  background: "#4caf50",
  border: "none",
  _hover: {
    _enabled: {
      background: "#43a047",
    },
  },
  _disabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
});

interface CheckoutModalProps {
  onClose: () => void;
}

export function CheckoutModal({ onClose }: CheckoutModalProps) {
  const {
    items,
    appliedCoupon,
    discountAmount,
    checkout,
    applyCoupon,
    removeCoupon,
    isProcessing,
    error,
    clearError,
  } = useCartStore();
  const networkStatus = useNetworkStore((state) => state.status);
  const isOnline = networkStatus === "online";
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">(
    "cash",
  );
  const [receivedAmount, setReceivedAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // itemsから直接計算（Zustandのgetterがプラットフォームによって動作しない場合があるため）
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const received = Number.parseInt(receivedAmount, 10) || 0;
  const change = received - totalAmount;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    clearError();
    const success = await applyCoupon(couponCode.trim());
    setIsApplyingCoupon(false);
    if (success) {
      setCouponCode("");
    }
  };

  const handleCheckout = async () => {
    clearError();
    // 現金払いの場合は受領額を渡す、それ以外は合計額と同じ
    const receivedAmountValue =
      paymentMethod === "cash" ? received : totalAmount;
    await checkout(paymentMethod, receivedAmountValue);
  };

  const handleQuickAmount = (amount: number) => {
    setReceivedAmount(amount.toString());
  };

  // よく使う金額ボタン
  const quickAmounts = [1000, 2000, 5000, 10000];

  // ぴったりボタン
  const handleExactAmount = () => {
    setReceivedAmount(totalAmount.toString());
  };

  // 支払いボタンのスタイルを決定するヘルパー関数
  const getPaymentButtonStyle = (
    method: "cash" | "card" | "other",
    isDisabled: boolean,
  ) => {
    if (isDisabled) return paymentButtonDisabledStyle;
    if (paymentMethod === method) return paymentButtonActiveStyle;
    return paymentButtonStyle;
  };

  return (
    <div className={modalOverlayStyle}>
      <button
        type="button"
        className={modalBackdropStyle}
        onClick={onClose}
        aria-label="モーダルを閉じる"
      />
      <div
        className={checkoutModalStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-modal-title"
      >
        <div className={modalHeaderStyle}>
          <h2 id="checkout-modal-title" className={modalTitleStyle}>
            会計
          </h2>
          <button type="button" className={closeButtonStyle} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={modalBodyStyle}>
          {/* クーポン入力 */}
          <div className={couponSectionStyle}>
            <span className={sectionLabelStyle}>クーポン</span>
            {appliedCoupon ? (
              <div className={appliedCouponStyle}>
                <div className={couponInfoStyle}>
                  <span className={couponNameStyle}>{appliedCoupon.name}</span>
                  <span className={couponDiscountStyle}>
                    -{formatPrice(discountAmount)}
                  </span>
                </div>
                <button
                  type="button"
                  className={removeCouponButtonStyle}
                  onClick={removeCoupon}
                >
                  解除
                </button>
              </div>
            ) : (
              <div className={couponInputRowStyle}>
                <input
                  type="text"
                  className={couponInputStyle}
                  placeholder="クーポンコード"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!isOnline || isApplyingCoupon}
                />
                <button
                  type="button"
                  className={applyCouponButtonStyle}
                  onClick={handleApplyCoupon}
                  disabled={!isOnline || isApplyingCoupon || !couponCode.trim()}
                >
                  {isApplyingCoupon ? "..." : "適用"}
                </button>
              </div>
            )}
            {!isOnline && !appliedCoupon && (
              <p className={couponOfflineNoteStyle}>
                クーポン適用にはオンライン接続が必要です
              </p>
            )}
          </div>

          {/* 金額表示 */}
          <div className={checkoutAmountsStyle}>
            <div className={amountRowStyle}>
              <span className={amountLabelStyle}>小計</span>
              <span className={amountValueStyle}>{formatPrice(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className={amountRowStyle}>
                <span className={discountLabelStyle}>割引</span>
                <span className={discountValueStyle}>
                  -{formatPrice(discountAmount)}
                </span>
              </div>
            )}
            <div className={amountRowTotalStyle}>
              <span className={totalLabelStyle}>合計金額</span>
              <span className={totalValueStyle}>
                {formatPrice(totalAmount)}
              </span>
            </div>
          </div>

          {/* 支払い方法選択 */}
          <div className={paymentMethodSectionStyle}>
            <span className={sectionLabelStyle}>支払い方法</span>
            <div className={paymentButtonsStyle}>
              <button
                type="button"
                className={getPaymentButtonStyle("cash", false)}
                onClick={() => setPaymentMethod("cash")}
              >
                現金
              </button>
              <button
                type="button"
                className={getPaymentButtonStyle("card", !isOnline)}
                onClick={() => isOnline && setPaymentMethod("card")}
                disabled={!isOnline}
                title={!isOnline ? "オフライン時はカード決済できません" : ""}
              >
                カード
                {!isOnline && (
                  <span className={offlineBadgeStyle}>オフライン</span>
                )}
              </button>
              <button
                type="button"
                className={getPaymentButtonStyle("other", false)}
                onClick={() => setPaymentMethod("other")}
              >
                その他
              </button>
            </div>
          </div>

          {/* 現金の場合は預かり金額入力 */}
          {paymentMethod === "cash" && (
            <div className={cashSectionStyle}>
              <div className={receivedDisplayStyle}>
                <span className={receivedLabelStyle}>預かり金額</span>
                <span className={receivedAmountStyle}>
                  {receivedAmount ? formatPrice(received) : "¥0"}
                </span>
              </div>

              {/* クイック金額ボタン */}
              <div className={quickAmountsStyle}>
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className={quickButtonStyle}
                    onClick={() => handleQuickAmount(amount)}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
                <button
                  type="button"
                  className={quickButtonExactStyle}
                  onClick={handleExactAmount}
                >
                  ぴったり
                </button>
              </div>

              {/* 数字キーパッド */}
              <NumericKeypad
                value={receivedAmount}
                onChange={setReceivedAmount}
                maxLength={7}
              />

              {/* お釣り表示 */}
              {received >= totalAmount && (
                <div className={changeDisplayStyle}>
                  <span className={changeLabelStyle}>お釣り</span>
                  <span className={changeAmountStyle}>
                    {formatPrice(change)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* エラー表示 */}
          {error && <div className={checkoutErrorStyle}>{error}</div>}
        </div>

        <div className={modalFooterStyle}>
          <button
            type="button"
            className={cancelButtonStyle}
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={confirmButtonStyle}
            onClick={handleCheckout}
            disabled={
              isProcessing ||
              (paymentMethod === "cash" && received < totalAmount)
            }
          >
            {isProcessing ? "処理中..." : "決済する"}
          </button>
        </div>
      </div>
    </div>
  );
}
