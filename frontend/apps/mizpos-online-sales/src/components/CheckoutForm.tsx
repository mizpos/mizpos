import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useCart } from "../contexts/CartContext";

interface CheckoutFormProps {
  orderId: string;
}

export default function CheckoutForm({ orderId }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("決済の準備ができていません");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-complete`,
        },
        redirect: "if_required",
      });

      if (error) {
        setErrorMessage(error.message || "決済に失敗しました");
        setIsProcessing(false);
      } else {
        // 決済成功
        clearCart();
        navigate({
          to: "/order-complete",
          search: { order_id: orderId || "" },
        });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "不明なエラー";
      setErrorMessage(`決済処理中にエラーが発生しました: ${errorMessage}`);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className={css({ marginBottom: "24px" })}>
        <PaymentElement />
      </div>

      {errorMessage && (
        <div
          className={css({
            padding: "12px",
            marginBottom: "16px",
            backgroundColor: "#f8d7da",
            borderRadius: "4px",
            color: "#721c24",
            fontSize: "14px",
          })}
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className={css({
          width: "100%",
          padding: "14px",
          backgroundColor: "#f0c14b",
          border: "1px solid #a88734",
          borderRadius: "3px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
          _hover: {
            backgroundColor: "#ddb347",
          },
          _disabled: {
            backgroundColor: "#ddd",
            cursor: "not-allowed",
            borderColor: "#999",
          },
        })}
      >
        {isProcessing
          ? "処理中..."
          : `¥${items
              .reduce(
                (sum, item) => sum + item.product.price * item.quantity,
                0,
              )
              .toLocaleString()} を支払う`}
      </button>
    </form>
  );
}
