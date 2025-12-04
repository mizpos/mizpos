import { Elements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { css } from "styled-system/css";
import CheckoutForm from "../CheckoutForm";
import { Button } from "../ui";
import { Card, CardHeader } from "../ui";

interface PaymentStepProps {
  stripePromise: Promise<Stripe | null>;
  clientSecret: string | null;
  orderId: string;
  onBack: () => void;
}

export function PaymentStep({
  stripePromise,
  clientSecret,
  orderId,
  onBack,
}: PaymentStepProps) {
  return (
    <Card>
      <CardHeader>お支払い情報</CardHeader>
      <Button variant="link" onClick={onBack} className={css({ marginBottom: "16px" })}>
        ← 配送先情報を編集
      </Button>
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm orderId={orderId} />
        </Elements>
      ) : (
        <div className={css({ padding: "40px", textAlign: "center" })}>
          <p>決済の準備中...</p>
        </div>
      )}
    </Card>
  );
}
