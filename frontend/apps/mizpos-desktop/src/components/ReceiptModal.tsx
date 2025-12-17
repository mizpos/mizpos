import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import type { FullReceiptData } from "../lib/printer";
import {
  getPlatform,
  UnifiedPrinter,
  type UnifiedPrinterConfig,
} from "../lib/printer";
import { useSettingsStore } from "../stores/settings";
import type { PaymentMethod, Transaction } from "../types";
import { Button } from "./ui";

/**
 * 支払い方法を日本語表示名に変換
 */
function getPaymentMethodDisplayName(
  method: PaymentMethod,
  voucherConfigs?: Array<{ type: string; name: string }>,
): string {
  switch (method) {
    case "cash":
      return "現金";
    case "oya_cashless":
      return "大家キャッシュレス";
    case "stripe_terminal":
      return "クレジット";
    case "voucher_department": {
      const config = voucherConfigs?.find(
        (c) => c.type === "voucher_department",
      );
      return config?.name ?? "百貨店商品券";
    }
    case "voucher_event": {
      const config = voucherConfigs?.find((c) => c.type === "voucher_event");
      return config?.name ?? "イベント主催者発行商品券";
    }
    default:
      return method;
  }
}

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
}

// 成功ヘッダースタイル
const headerStyles = {
  container: css({
    background: "#16a34a",
    padding: "44px 24px",
    textAlign: "center",
  }),
  containerTraining: css({
    background: "linear-gradient(135deg, #dc2626 0%, #ea580c 100%)",
    padding: "44px 24px",
    textAlign: "center",
  }),
  iconWrapper: css({
    width: "80px",
    height: "80px",
    margin: "0 auto 16px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "42px",
    fontWeight: 700,
    color: "#f8fafc",
  }),
  title: css({
    margin: "0 0 8px 0",
    fontSize: "30px",
    fontWeight: 700,
    color: "#f8fafc",
  }),
  subtitle: css({
    margin: 0,
    fontSize: "15px",
    color: "rgba(255,255,255,0.9)",
  }),
};

// コンテンツスタイル
const contentStyles = {
  container: css({
    padding: "24px",
  }),
  card: css({
    background: "#0f172a",
    borderRadius: "14px",
    padding: "24px",
    marginBottom: "20px",
  }),
  row: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  label: css({
    fontSize: "14px",
    color: "#94a3b8",
  }),
  totalAmount: css({
    fontSize: "32px",
    fontWeight: 700,
    fontFamily: "monospace",
  }),
  divider: css({
    borderTop: "1px solid #334155",
    marginTop: "16px",
    paddingTop: "16px",
  }),
  detailRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  }),
  detailRowLast: css({
    marginBottom: 0,
  }),
  amount: css({
    fontSize: "20px",
    fontFamily: "monospace",
  }),
  changeAmount: css({
    fontSize: "28px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#4ade80",
  }),
  error: css({
    background: "#7f1d1d",
    color: "#fecaca",
    padding: "14px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    marginBottom: "16px",
    textAlign: "center",
    fontWeight: 500,
  }),
  buttons: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  }),
};

// オーバーレイスタイル
const overlayStyles = css({
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.15s ease-out",
});

const modalStyles = css({
  background: "#1e293b",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "440px",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  overflow: "hidden",
  color: "#f8fafc",
  animation: "scaleIn 0.2s ease-out",
});

export function ReceiptModal({ transaction, onClose }: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const { settings } = useSettingsStore();

  const isTraining = transaction.isTraining ?? false;

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPrinting) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isPrinting]);

  const handlePrint = useCallback(async () => {
    // デバッグ: cardDetailsの確認
    console.log(
      "[ReceiptModal] transaction.cardDetails:",
      transaction.cardDetails,
    );
    console.log(
      "[ReceiptModal] transaction.paymentIntentId:",
      transaction.paymentIntentId,
    );

    if (!settings.printer) {
      setPrintError("プリンターが設定されていません");
      return;
    }

    setIsPrinting(true);
    setPrintError(null);

    try {
      const platform = await getPlatform();
      const printerConfig: UnifiedPrinterConfig = {
        platform,
        vendorId: settings.printer.vendorId,
        deviceId: settings.printer.deviceId,
        bluetoothAddress: settings.printer.bluetoothAddress,
        name: settings.printer.name,
        paperWidth: settings.printer.paperWidth,
      };

      const printer = new UnifiedPrinter(printerConfig);

      const connectResult = await printer.connect();
      if (!connectResult.success) {
        throw new Error(connectResult.error || "プリンター接続に失敗しました");
      }

      // 取引日時をフォーマット（例: 2025年12月31日 10:30）
      const now = new Date();
      const saleDateTime = `${now.getFullYear()}/${
        now.getMonth() + 1
      }/${now.getDate()} ${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;

      const receiptData: FullReceiptData = {
        event_name: isTraining
          ? `【トレーニング】${settings.eventName}`
          : settings.eventName,
        circle_name: settings.circleName || "",
        venue_address: settings.venueAddress || "",
        sale_start_date_time: saleDateTime,
        staff_id: transaction.staffId,
        items: transaction.items.map((item) => ({
          circle_name: item.product.circleName || "",
          name: item.product.name,
          jan: item.product.jan,
          isbn: item.product.isbn || "",
          isdn: item.product.isdn,
          jan2: item.product.jan2,
          is_book: item.product.isBook,
          quantity: item.quantity,
          price: item.product.price * item.quantity,
        })),
        total: transaction.total,
        payments: transaction.payments.map((p) => ({
          method: getPaymentMethodDisplayName(
            p.method,
            settings.voucherConfigs,
          ),
          amount: p.amount,
        })),
        tax_rate: transaction.taxRate,
        tax_amount: transaction.taxAmount,
        receipt_number: isTraining
          ? `TRAINING-${transaction.id}`
          : transaction.id,
        // カード詳細（クレジット決済時）
        card_details: transaction.cardDetails
          ? {
              brand: transaction.cardDetails.brand,
              last4: transaction.cardDetails.last4,
              exp_month: transaction.cardDetails.expMonth,
              exp_year: transaction.cardDetails.expYear,
              cardholder_name: transaction.cardDetails.cardholderName,
              funding: transaction.cardDetails.funding,
              terminal_serial_number:
                transaction.cardDetails.terminalSerialNumber,
              transaction_type: transaction.cardDetails.transactionType,
              payment_type: transaction.cardDetails.paymentType,
              transaction_at: transaction.cardDetails.transactionAt,
            }
          : undefined,
        payment_intent_id: transaction.paymentIntentId,
      };

      const printResult = await printer.printFullReceipt(receiptData);
      if (!printResult.success) {
        throw new Error(printResult.error || "印刷に失敗しました");
      }

      onClose();
    } catch (error) {
      console.error("Print failed:", error);
      setPrintError(
        error instanceof Error ? error.message : "印刷に失敗しました",
      );
    } finally {
      setIsPrinting(false);
    }
  }, [settings, transaction, onClose, isTraining]);

  const cashPayment = transaction.payments.find((p) => p.method === "cash");
  const change = cashPayment ? cashPayment.amount - transaction.total : 0;

  return (
    <div className={overlayStyles}>
      <div className={modalStyles}>
        {/* 成功ヘッダー */}
        <div
          className={
            isTraining ? headerStyles.containerTraining : headerStyles.container
          }
        >
          <div className={headerStyles.iconWrapper}>
            {isTraining ? "📝" : "✓"}
          </div>
          <h2 className={headerStyles.title}>
            {isTraining ? "トレーニング完了" : "会計完了"}
          </h2>
          <p className={headerStyles.subtitle}>
            {isTraining
              ? "この取引は記録されていません"
              : "ありがとうございました"}
          </p>
        </div>

        {/* レシート内容 */}
        <div className={contentStyles.container}>
          <div className={contentStyles.card}>
            <div className={contentStyles.row}>
              <span className={contentStyles.label}>合計</span>
              <span className={contentStyles.totalAmount}>
                ¥{transaction.total.toLocaleString()}
              </span>
            </div>

            <div className={contentStyles.divider}>
              {/* 支払い情報を表示 */}
              {transaction.payments.map((payment, index) => (
                <div
                  key={`${payment.method}-${index}`}
                  className={contentStyles.detailRow}
                >
                  <span className={contentStyles.label}>
                    {getPaymentMethodDisplayName(
                      payment.method,
                      settings.voucherConfigs,
                    )}
                  </span>
                  <span className={contentStyles.amount}>
                    ¥{payment.amount.toLocaleString()}
                  </span>
                </div>
              ))}

              {/* 現金支払いがある場合はおつりを表示 */}
              {cashPayment && change > 0 && (
                <div
                  className={`${contentStyles.detailRow} ${contentStyles.detailRowLast}`}
                >
                  <span className={contentStyles.label}>おつり</span>
                  <span className={contentStyles.changeAmount}>
                    ¥{change.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {printError && (
            <div className={contentStyles.error}>{printError}</div>
          )}

          {/* ボタン */}
          <div className={contentStyles.buttons}>
            <Button
              variant="secondary"
              size="lg"
              onClick={handlePrint}
              disabled={isPrinting || !settings.printer}
            >
              {isPrinting ? "印刷中..." : "レシート印刷"}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={onClose}
              disabled={isPrinting}
            >
              閉じる (Esc)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
