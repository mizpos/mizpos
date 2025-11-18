import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useCart } from "../contexts/CartContext";
import { createOrder, createOrderPaymentIntent, type CartItem as ApiCartItem } from "../lib/api";

interface CheckoutFormProps {
  customerInfo: {
    email: string;
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    address_line1: string;
    address_line2: string;
    phone_number: string;
  };
}

export default function CheckoutForm({ customerInfo }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { items, clearCart } = useCart();
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentIntentReady, setPaymentIntentReady] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // 注文作成mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const cartItems: ApiCartItem[] = items.map((item) => ({
        product_id: item.product.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const order = await createOrder({
        cart_items: cartItems,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        shipping_address: {
          name: customerInfo.name,
          postal_code: customerInfo.postalCode,
          prefecture: customerInfo.prefecture,
          city: customerInfo.city,
          address_line1: customerInfo.address_line1,
          address_line2: customerInfo.address_line2,
          phone_number: customerInfo.phone_number,
        },
      });

      return order;
    },
    onSuccess: async (order) => {
      setOrderId(order.order_id || order.sale_id);

      // PaymentIntent作成
      try {
        const paymentIntent = await createOrderPaymentIntent(order.order_id || order.sale_id);
        setClientSecret(paymentIntent.client_secret);
        setPaymentIntentReady(true);
      } catch (error) {
        setErrorMessage("決済の準備に失敗しました");
        console.error("PaymentIntent creation failed:", error);
      }
    },
    onError: (error: Error) => {
      setErrorMessage(`注文の作成に失敗しました: ${error.message}`);
    },
  });

  // 初回レンダリング時に注文を作成
  useState(() => {
    createOrderMutation.mutate();
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !paymentIntentReady) {
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
    } catch (error) {
      setErrorMessage("決済処理中にエラーが発生しました");
      setIsProcessing(false);
    }
  };

  if (createOrderMutation.isPending) {
    return (
      <div className={css({ padding: "40px", textAlign: "center" })}>
        <p>注文を作成中...</p>
      </div>
    );
  }

  if (createOrderMutation.isError) {
    return (
      <div className={css({ padding: "20px", backgroundColor: "#f8d7da", borderRadius: "4px", color: "#721c24" })}>
        <p>{errorMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {paymentIntentReady && clientSecret ? (
        <>
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
            {isProcessing ? "処理中..." : `¥${items.reduce((sum, item) => sum + item.product.price * item.quantity, 0).toLocaleString()} を支払う`}
          </button>
        </>
      ) : (
        <div className={css({ padding: "40px", textAlign: "center" })}>
          <p>決済の準備中...</p>
        </div>
      )}
    </form>
  );
}
