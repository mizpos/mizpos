import { loadStripe } from "@stripe/stripe-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import {
  AddressSelector,
  EmptyCart,
  OrderSummary,
  PaymentStep,
  ShippingForm,
  type CustomerInfo,
} from "../../components/checkout";
import { Card, CardHeader } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import {
  type CartItem as ApiCartItem,
  createOrder,
  createOrderPaymentIntent,
  getUserAddresses,
  type SavedAddress,
} from "../../lib/api";

// Stripe公開可能キーを読み込み
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "payment">("info");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    email: user?.email || "",
    name: user?.displayName || "",
    postalCode: "",
    prefecture: "",
    city: "",
    address_line1: "",
    address_line2: "",
    phone_number: "",
  });

  // ログインチェック
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/checkout" } });
    }
  }, [user, navigate]);

  // ユーザー情報が読み込まれたらフォームに自動入力
  useEffect(() => {
    if (user) {
      setCustomerInfo((prev) => ({
        ...prev,
        email: user.email || prev.email,
        name: user.displayName || prev.name,
      }));
    }
  }, [user]);

  // 登録済み住所を取得（ログイン済みユーザーのみ）
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ["addresses", user?.userId],
    queryFn: () => getUserAddresses(user?.userId || ""),
    enabled: !!user?.userId,
  });

  // 選択された住所を自動入力
  const handleAddressSelect = (address: SavedAddress) => {
    setSelectedAddressId(address.address_id);
    setUseManualAddress(false);
    setCustomerInfo({
      ...customerInfo,
      name: address.name,
      postalCode: address.postal_code,
      prefecture: address.prefecture,
      city: address.city,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || "",
      phone_number: address.phone_number,
    });
  };

  // 手動入力モードに切り替え
  const handleUseManualAddress = () => {
    setUseManualAddress(true);
    setSelectedAddressId(null);
  };

  // 注文作成mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const cartItems: ApiCartItem[] = items.map((item) => ({
        product_id: item.product.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      // 登録済み住所を使用する場合と手動入力の場合で分岐
      const orderRequest: Parameters<typeof createOrder>[0] = {
        cart_items: cartItems,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
      };

      if (selectedAddressId && !useManualAddress && user?.userId) {
        // 登録済み住所を使用
        orderRequest.saved_address_id = selectedAddressId;
        orderRequest.user_id = user.userId;
      } else {
        // 手動入力の住所を使用
        orderRequest.shipping_address = {
          name: customerInfo.name,
          postal_code: customerInfo.postalCode,
          prefecture: customerInfo.prefecture,
          city: customerInfo.city,
          address_line1: customerInfo.address_line1,
          address_line2: customerInfo.address_line2,
          phone_number: customerInfo.phone_number,
        };
      }

      const order = await createOrder(orderRequest);
      return order;
    },
    onSuccess: async (order) => {
      const newOrderId = order.order_id || order.sale_id || "";
      setOrderId(newOrderId);

      // PaymentIntent作成
      try {
        const paymentIntent = await createOrderPaymentIntent(newOrderId);
        setClientSecret(paymentIntent.client_secret);
      } catch (error) {
        console.error("PaymentIntent creation failed:", error);
      }
    },
  });

  if (items.length === 0) {
    return <EmptyCart />;
  }

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 注文を作成してPaymentIntentを取得
    createOrderMutation.mutate();
    setStep("payment");
  };

  const isReadOnly = !!selectedAddressId && !useManualAddress;

  return (
    <div
      className={css({
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <h1
        className={css({
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "30px",
        })}
      >
        チェックアウト
      </h1>

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "2fr 1fr" },
          gap: "30px",
        })}
      >
        {/* メインコンテンツ */}
        <div>
          {step === "info" ? (
            <Card>
              <CardHeader>配送先情報</CardHeader>

              {/* 登録済み住所の選択（ログイン済みユーザーのみ） */}
              {!!user?.userId && savedAddresses.length > 0 && (
                <AddressSelector
                  addresses={savedAddresses}
                  selectedAddressId={selectedAddressId}
                  useManualAddress={useManualAddress}
                  onSelectAddress={handleAddressSelect}
                  onUseManualAddress={handleUseManualAddress}
                />
              )}

              <ShippingForm
                customerInfo={customerInfo}
                onChange={setCustomerInfo}
                onSubmit={handleInfoSubmit}
                isReadOnly={isReadOnly}
              />
            </Card>
          ) : (
            <PaymentStep
              stripePromise={stripePromise}
              clientSecret={clientSecret}
              orderId={orderId || ""}
              onBack={() => setStep("info")}
            />
          )}
        </div>

        {/* 注文サマリー */}
        <OrderSummary items={items} subtotal={subtotal} />
      </div>
    </div>
  );
}
