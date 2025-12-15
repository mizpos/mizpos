import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { saveTransaction, updateSalesSummary } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { type AppliedCoupon, useCartStore } from "../stores/cart";
import { usePairingStore } from "../stores/pairing";
import { useSettingsStore } from "../stores/settings";
import type {
  Payment,
  PaymentMethod,
  Transaction,
  VoucherType,
} from "../types";
import { PairingModal } from "./PairingModal";
import { TerminalPaymentModal } from "./TerminalPaymentModal";
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
    gridTemplateColumns: "1fr 1fr 1fr",
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
  buttonVoucher: css({
    color: "#0f172a",
    background: "#fbbf24",
    borderColor: "#fbbf24",
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

// 商品券入力スタイル
const voucherInputStyles = {
  container: css({
    marginBottom: "24px",
    padding: "20px",
    background: "#1e293b",
    borderRadius: "12px",
  }),
  selectRow: css({
    marginBottom: "16px",
  }),
  select: css({
    width: "100%",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 500,
    color: "#f8fafc",
    background: "#0f172a",
    border: "2px solid #334155",
    borderRadius: "10px",
    cursor: "pointer",
    outline: "none",
    _focus: {
      borderColor: "#fbbf24",
    },
  }),
  amountLabel: css({
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "8px",
  }),
  amountInput: css({
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
    _focus: {
      borderColor: "#fbbf24",
    },
    _placeholder: { color: "#475569" },
  }),
  quickGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
    marginTop: "12px",
  }),
  quickButton: css({
    padding: "12px 8px",
    fontSize: "14px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
    background: "#334155",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: { background: "#475569" },
  }),
  allowChangeNote: css({
    marginTop: "12px",
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "center",
  }),
};

// 複数決済の内訳スタイル
const paymentBreakdownStyles = {
  container: css({
    marginBottom: "16px",
    padding: "16px",
    background: "#1e293b",
    borderRadius: "10px",
  }),
  title: css({
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "12px",
  }),
  row: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #334155",
    _last: {
      borderBottom: "none",
    },
  }),
  label: css({
    fontSize: "14px",
    color: "#f8fafc",
  }),
  amount: css({
    fontSize: "16px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
  }),
  remaining: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "2px solid #475569",
  }),
  remainingLabel: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#f87171",
  }),
  remainingAmount: css({
    fontSize: "20px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f87171",
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

// 支払いモード（単一 or 混合）
type PaymentMode = "single" | "mixed";

export function CheckoutModal({
  onClose,
  onComplete,
  isTrainingMode = false,
}: CheckoutModalProps) {
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("single");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // 商品券関連の状態
  const [selectedVoucherType, setSelectedVoucherType] =
    useState<VoucherType>("voucher_department");
  const [voucherAmount, setVoucherAmount] = useState("");

  // Terminal決済関連の状態
  const [showTerminalPayment, setShowTerminalPayment] = useState(false);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const { status: pairingStatus, pairingInfo, currentPaymentRequest } = usePairingStore();

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
  const voucherInputRef = useRef<HTMLInputElement>(null);

  const taxRate = settings.taxRate;
  const subtotal = getSubtotal();
  const discountAmount = getDiscountAmount();
  const taxAmount = getTaxAmount(taxRate);
  const total = getTotal(taxRate);
  const received = receivedAmount ? Number.parseInt(receivedAmount, 10) : 0;

  // 商品券設定を取得
  const voucherConfigs = settings.voucherConfigs ?? [
    {
      type: "voucher_department" as VoucherType,
      name: "百貨店商品券",
      allowChange: true,
    },
    {
      type: "voucher_event" as VoucherType,
      name: "イベント主催者発行商品券",
      allowChange: false,
    },
  ];
  const currentVoucherConfig = voucherConfigs.find(
    (c) => c.type === selectedVoucherType,
  );
  const voucherAmountNum = voucherAmount
    ? Number.parseInt(voucherAmount, 10)
    : 0;

  // 商品券決済時の残額計算
  const isVoucherPayment =
    paymentMethod === "voucher_department" || paymentMethod === "voucher_event";
  const remainingAfterVoucher = isVoucherPayment
    ? Math.max(0, total - voucherAmountNum)
    : 0;

  // おつり計算（商品券でおつりを出す場合も考慮）
  const voucherChange =
    isVoucherPayment && currentVoucherConfig?.allowChange
      ? Math.max(0, voucherAmountNum - total)
      : 0;
  const cashChange =
    paymentMode === "mixed" && remainingAfterVoucher > 0
      ? received - remainingAfterVoucher
      : paymentMethod === "cash"
        ? received - total
        : 0;
  const change = isVoucherPayment
    ? voucherChange > 0
      ? voucherChange
      : cashChange
    : cashChange;

  // 入力フィールドにフォーカス
  useEffect(() => {
    if (paymentMethod === "cash") {
      inputRef.current?.focus();
    } else if (isVoucherPayment) {
      voucherInputRef.current?.focus();
    }
  }, [paymentMethod, isVoucherPayment]);

  // 支払い方法切り替え時のリセット
  const handlePaymentMethodChange = useCallback((method: PaymentMethod) => {
    setPaymentMethod(method);
    setReceivedAmount("");
    setVoucherAmount("");
    if (method === "voucher_department" || method === "voucher_event") {
      setSelectedVoucherType(method);
      setPaymentMode("single");
    } else {
      setPaymentMode("single");
    }
  }, []);

  // 商品券金額入力
  const handleVoucherAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      if (value === "" || Number.parseInt(value, 10) <= 10000000) {
        setVoucherAmount(value);
        // 残額がある場合は混合モードに切り替え
        const numValue = value ? Number.parseInt(value, 10) : 0;
        if (numValue > 0 && numValue < total) {
          setPaymentMode("mixed");
        } else {
          setPaymentMode("single");
        }
      }
    },
    [total],
  );

  // 商品券クイック金額
  const handleVoucherQuickAmount = useCallback(
    (amount: number) => {
      setVoucherAmount(String(amount));
      if (amount < total) {
        setPaymentMode("mixed");
      } else {
        setPaymentMode("single");
      }
    },
    [total],
  );

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
      const response = await fetch(`${API_BASE_URL}/pos/coupons/apply`, {
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

    // 決済可能かチェック
    if (paymentMethod === "cash" && change < 0) return;
    if (isVoucherPayment) {
      if (voucherAmountNum <= 0) return;
      // 残額がある場合は現金が必要
      if (remainingAfterVoucher > 0 && cashChange < 0) return;
    }

    setIsProcessing(true);

    try {
      // 支払い情報を構築
      const payments: Payment[] = [];

      if (isVoucherPayment) {
        // 商品券決済
        payments.push({
          method: selectedVoucherType,
          amount: Math.min(voucherAmountNum, total),
        });
        // 残額がある場合は現金を追加
        if (remainingAfterVoucher > 0) {
          payments.push({
            method: "cash",
            amount: received,
          });
        }
      } else if (paymentMethod === "cash") {
        payments.push({
          method: "cash",
          amount: received,
        });
      } else {
        // キャッシュレス
        payments.push({
          method: paymentMethod,
          amount: total,
        });
      }

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

          const response = await fetch(`${API_BASE_URL}/pos/sales`, {
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
    isVoucherPayment,
    voucherAmountNum,
    remainingAfterVoucher,
    cashChange,
    selectedVoucherType,
  ]);

  // Terminal決済完了後の処理
  const handleTerminalPaymentComplete = useCallback(
    async (paymentIntentId: string) => {
      if (!session) return;

      setIsProcessing(true);

      try {
        const payments: Payment[] = [
          {
            method: "stripe_terminal",
            amount: total,
          },
        ];

        // cardDetailsをcurrentPaymentRequestから取得
        const cardDetails = currentPaymentRequest?.cardDetails ? {
          brand: currentPaymentRequest.cardDetails.brand,
          last4: currentPaymentRequest.cardDetails.last4,
          expMonth: currentPaymentRequest.cardDetails.expMonth,
          expYear: currentPaymentRequest.cardDetails.expYear,
          cardholderName: currentPaymentRequest.cardDetails.cardholderName,
          funding: currentPaymentRequest.cardDetails.funding,
          terminalSerialNumber: currentPaymentRequest.cardDetails.terminalSerialNumber,
          transactionType: currentPaymentRequest.cardDetails.transactionType,
          paymentType: currentPaymentRequest.cardDetails.paymentType,
          transactionAt: currentPaymentRequest.cardDetails.transactionAt,
        } : undefined;

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
          paymentIntentId, // Stripe PaymentIntent IDを保存
          cardDetails, // カード詳細を保存
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

            const saleBody: Record<string, unknown> = {
              items: saleItems,
              total_amount: total,
              payment_method: "stripe_terminal",
              event_id: session.eventId,
              terminal_id: settings.terminalId,
              payment_intent_id: paymentIntentId,
            };

            if (appliedCoupon) {
              saleBody.coupon_code = appliedCoupon.code;
              saleBody.subtotal = subtotal;
            }

            const response = await fetch(`${API_BASE_URL}/pos/sales`, {
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
            } else {
              console.log("Sale successfully sent to backend");
            }
          } catch (apiError) {
            console.error("Error sending sale to backend:", apiError);
          }
        } else {
          console.log("Training mode: Transaction not saved");
        }

        clear();
        onComplete(transaction);
      } catch (error) {
        console.error("Terminal payment completion failed:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      session,
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
      currentPaymentRequest,
    ],
  );

  // Enterキーで会計完了
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        // 現金のみの場合
        if (paymentMethod === "cash" && change >= 0) {
          e.preventDefault();
          handleComplete();
        }
        // 商品券の場合
        else if (isVoucherPayment) {
          if (voucherAmountNum > 0) {
            // 残額がない or 残額を現金で支払い済み
            if (remainingAfterVoucher === 0 || cashChange >= 0) {
              e.preventDefault();
              handleComplete();
            }
          }
        }
        // キャッシュレスの場合
        else if (paymentMethod === "oya_cashless") {
          e.preventDefault();
          handleComplete();
        }
      }
    },
    [
      paymentMethod,
      change,
      handleComplete,
      isVoucherPayment,
      voucherAmountNum,
      remainingAfterVoucher,
      cashChange,
    ],
  );

  const quickAmounts = [1000, 2000, 3000, 5000, 10000];
  const voucherQuickAmounts = [500, 1000, 2000, 3000, 5000];

  // 決済可能かどうかの判定
  const canComplete = (() => {
    if (paymentMethod === "cash") {
      return change >= 0;
    }
    if (isVoucherPayment) {
      if (voucherAmountNum <= 0) return false;
      // おつりを出せる場合、または残額がない
      if (currentVoucherConfig?.allowChange && voucherAmountNum >= total)
        return true;
      // 残額がある場合は現金で支払い済みか確認
      if (remainingAfterVoucher > 0) return cashChange >= 0;
      // 商品券で全額支払い
      return voucherAmountNum >= total;
    }
    // キャッシュレス
    return true;
  })();

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
        <div className={totalDisplayStyles.label}>お会計(税込)</div>
        <div className={totalDisplayStyles.amount}>
          ¥{total.toLocaleString()}
        </div>
        {/* 内税表示 */}
        <div
          className={css({
            marginTop: "8px",
            fontSize: "12px",
            color: "#64748b",
          })}
        >
          (内 {taxRate}%税 ¥{taxAmount.toLocaleString()})
        </div>
        {/* 割引がある場合は内訳を表示 */}
        {discountAmount > 0 && (
          <div
            className={css({
              marginTop: "8px",
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
            onClick={() => handlePaymentMethodChange("cash")}
            className={`${paymentMethodStyles.button} ${paymentMethod === "cash" ? paymentMethodStyles.buttonCash : paymentMethodStyles.buttonInactive}`}
          >
            現金
          </button>
          <button
            type="button"
            onClick={() => handlePaymentMethodChange("oya_cashless")}
            className={`${paymentMethodStyles.button} ${paymentMethod === "oya_cashless" ? paymentMethodStyles.buttonCashless : paymentMethodStyles.buttonInactive}`}
          >
            キャッシュレス
          </button>
          <button
            type="button"
            onClick={() => handlePaymentMethodChange("voucher_department")}
            className={`${paymentMethodStyles.button} ${isVoucherPayment ? paymentMethodStyles.buttonVoucher : paymentMethodStyles.buttonInactive}`}
          >
            商品券
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

      {/* 商品券入力 */}
      {isVoucherPayment && (
        <div className={voucherInputStyles.container}>
          {/* 商品券種別選択 */}
          <div className={voucherInputStyles.selectRow}>
            <select
              value={selectedVoucherType}
              onChange={(e) =>
                setSelectedVoucherType(e.target.value as VoucherType)
              }
              className={voucherInputStyles.select}
            >
              {voucherConfigs.map((config) => (
                <option key={config.type} value={config.type}>
                  {config.name}
                  {config.allowChange ? " (おつり有)" : " (おつり無)"}
                </option>
              ))}
            </select>
          </div>

          {/* 商品券金額入力 */}
          <div className={voucherInputStyles.amountLabel}>商品券金額</div>
          <input
            ref={voucherInputRef}
            type="text"
            inputMode="numeric"
            value={
              voucherAmount
                ? `¥${Number.parseInt(voucherAmount, 10).toLocaleString()}`
                : ""
            }
            onChange={handleVoucherAmountChange}
            onKeyDown={handleKeyDown}
            placeholder="¥0"
            className={voucherInputStyles.amountInput}
          />

          {/* クイック金額ボタン */}
          <div className={voucherInputStyles.quickGrid}>
            {voucherQuickAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleVoucherQuickAmount(amount)}
                className={voucherInputStyles.quickButton}
              >
                ¥{amount.toLocaleString()}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleVoucherQuickAmount(total)}
              className={voucherInputStyles.quickButton}
            >
              全額
            </button>
          </div>

          {/* おつり or 残額表示 */}
          {voucherAmountNum > 0 && (
            <>
              {voucherChange > 0 && currentVoucherConfig?.allowChange && (
                <div
                  className={`${changeDisplayStyles.container} ${changeDisplayStyles.valid}`}
                  style={{ marginTop: "16px", marginBottom: 0 }}
                >
                  <span
                    className={`${changeDisplayStyles.label} ${changeDisplayStyles.labelValid}`}
                  >
                    商品券おつり
                  </span>
                  <span className={changeDisplayStyles.amount}>
                    ¥{voucherChange.toLocaleString()}
                  </span>
                </div>
              )}

              {remainingAfterVoucher > 0 && (
                <div
                  className={paymentBreakdownStyles.container}
                  style={{ marginTop: "16px" }}
                >
                  <div className={paymentBreakdownStyles.title}>支払い内訳</div>
                  <div className={paymentBreakdownStyles.row}>
                    <span className={paymentBreakdownStyles.label}>
                      {currentVoucherConfig?.name}
                    </span>
                    <span className={paymentBreakdownStyles.amount}>
                      ¥{voucherAmountNum.toLocaleString()}
                    </span>
                  </div>
                  <div className={paymentBreakdownStyles.remaining}>
                    <span className={paymentBreakdownStyles.remainingLabel}>
                      残額（現金で支払い）
                    </span>
                    <span className={paymentBreakdownStyles.remainingAmount}>
                      ¥{remainingAfterVoucher.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className={voucherInputStyles.allowChangeNote}>
            {currentVoucherConfig?.allowChange
              ? "この商品券はおつりを出せます"
              : "この商品券はおつりを出せません（使い切りのみ）"}
          </div>
        </div>
      )}

      {/* 残額の現金支払い（商品券+現金の混合時） */}
      {isVoucherPayment && remainingAfterVoucher > 0 && (
        <>
          <div className={css({ marginBottom: "16px" })}>
            <div className={cashInputStyles.label}>現金お預かり金額</div>
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
              onClick={() => handleQuickAmount(remainingAfterVoucher)}
              className={`${cashInputStyles.quickButton} ${cashInputStyles.quickButtonExact}`}
            >
              ぴったり
            </button>
          </div>

          {/* おつり表示 */}
          <div
            className={`${changeDisplayStyles.container} ${cashChange >= 0 ? changeDisplayStyles.valid : changeDisplayStyles.invalid}`}
          >
            <span
              className={`${changeDisplayStyles.label} ${cashChange >= 0 ? changeDisplayStyles.labelValid : changeDisplayStyles.labelInvalid}`}
            >
              おつり
            </span>
            <span className={changeDisplayStyles.amount}>
              {cashChange >= 0 ? `¥${cashChange.toLocaleString()}` : "−"}
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

          {/* Terminal接続状態 */}
          <div
            className={css({
              marginTop: "16px",
              padding: "12px 16px",
              background:
                pairingStatus === "connected" || pairingStatus === "waiting"
                  ? "#14532d"
                  : "#334155",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "8px",
              })}
            >
              <span
                className={css({
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background:
                    pairingStatus === "connected" || pairingStatus === "waiting"
                      ? "#4ade80"
                      : "#64748b",
                })}
              />
              <span className={css({ fontSize: "13px", color: "#f8fafc" })}>
                {pairingStatus === "connected" || pairingStatus === "waiting"
                  ? `Terminal接続中 (PIN: ${pairingInfo?.pinCode})`
                  : "Terminal未接続"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPairingModal(true)}
              className={css({
                fontSize: "12px",
                color: "#93c5fd",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              })}
            >
              {pairingStatus === "connected" || pairingStatus === "waiting"
                ? "設定"
                : "接続"}
            </button>
          </div>
        </div>
      )}

      {/* 完了ボタン */}
      {paymentMethod === "oya_cashless" &&
      (pairingStatus === "connected" || pairingStatus === "waiting") ? (
        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={() => setShowTerminalPayment(true)}
          disabled={isProcessing}
        >
          Terminal決済を開始
        </Button>
      ) : (
        <Button
          variant="primary"
          size="xl"
          fullWidth
          onClick={handleComplete}
          disabled={isProcessing || !canComplete}
        >
          {isProcessing ? "処理中..." : "会計完了 (Enter)"}
        </Button>
      )}

      {/* ペアリングモーダル */}
      <PairingModal
        open={showPairingModal}
        onClose={() => setShowPairingModal(false)}
      />

      {/* Terminal決済モーダル */}
      {showTerminalPayment && (
        <TerminalPaymentModal
          open={showTerminalPayment}
          amount={total}
          items={items.map((item) => ({
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
          }))}
          saleId={undefined}
          description={`${settings.eventName || "イベント"} - ${items.length}点`}
          onComplete={(paymentIntentId) => {
            setShowTerminalPayment(false);
            // Terminal決済完了後の処理
            handleTerminalPaymentComplete(paymentIntentId);
          }}
          onCancel={() => setShowTerminalPayment(false)}
        />
      )}
    </Modal>
  );
}
