/**
 * 会計モーダル
 * 支払い方法の選択と決済処理
 */

import { useState } from "react";
import { useCartStore, formatPrice } from "../stores/cart";
import { NumericKeypad } from "./NumericKeypad";
import "./CheckoutModal.css";

interface CheckoutModalProps {
  onClose: () => void;
}

export function CheckoutModal({ onClose }: CheckoutModalProps) {
  const { items, checkout, isProcessing, error, clearError } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [receivedAmount, setReceivedAmount] = useState("");

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  const received = Number.parseInt(receivedAmount, 10) || 0;
  const change = received - totalAmount;

  const handleCheckout = async () => {
    clearError();
    await checkout(paymentMethod);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="checkout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>会計</h2>
          <button type="button" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* 合計金額 */}
          <div className="checkout-total">
            <span className="label">合計金額</span>
            <span className="amount">{formatPrice(totalAmount)}</span>
          </div>

          {/* 支払い方法選択 */}
          <div className="payment-method-section">
            <span className="section-label">支払い方法</span>
            <div className="payment-buttons">
              <button
                type="button"
                className={`payment-button ${paymentMethod === "cash" ? "active" : ""}`}
                onClick={() => setPaymentMethod("cash")}
              >
                現金
              </button>
              <button
                type="button"
                className={`payment-button ${paymentMethod === "card" ? "active" : ""}`}
                onClick={() => setPaymentMethod("card")}
              >
                カード
              </button>
              <button
                type="button"
                className={`payment-button ${paymentMethod === "other" ? "active" : ""}`}
                onClick={() => setPaymentMethod("other")}
              >
                その他
              </button>
            </div>
          </div>

          {/* 現金の場合は預かり金額入力 */}
          {paymentMethod === "cash" && (
            <div className="cash-section">
              <div className="received-display">
                <span className="label">預かり金額</span>
                <span className="received-amount">
                  {receivedAmount ? formatPrice(received) : "¥0"}
                </span>
              </div>

              {/* クイック金額ボタン */}
              <div className="quick-amounts">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="quick-button"
                    onClick={() => handleQuickAmount(amount)}
                  >
                    {formatPrice(amount)}
                  </button>
                ))}
                <button
                  type="button"
                  className="quick-button exact"
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
                <div className="change-display">
                  <span className="label">お釣り</span>
                  <span className="change-amount">{formatPrice(change)}</span>
                </div>
              )}
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="checkout-error">
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="confirm-button"
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
