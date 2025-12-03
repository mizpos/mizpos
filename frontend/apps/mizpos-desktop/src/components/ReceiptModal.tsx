import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import type { FullReceiptData } from "../lib/printer";
import {
  getPlatform,
  UnifiedPrinter,
  type UnifiedPrinterConfig,
} from "../lib/printer";
import { useSettingsStore } from "../stores/settings";
import type { Transaction } from "../types";
import { Button } from "./ui";

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
  cashlessLabel: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#60a5fa",
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

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPrinting) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isPrinting]);

  const handlePrint = useCallback(async () => {
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

      const receiptData: FullReceiptData = {
        event_name: settings.eventName,
        staff_id: transaction.staffId,
        items: transaction.items.map((item) => ({
          circle_name: item.product.circleName || "",
          jan: item.product.jan,
          isbn: item.product.isbn || "",
          quantity: item.quantity,
          price: item.product.price * item.quantity,
        })),
        total: transaction.total,
        payments: transaction.payments.map((p) => ({
          method: p.method === "cash" ? "現金" : "大家キャッシュレス",
          amount: p.amount,
        })),
        tax_rate: transaction.taxRate,
        tax_amount: transaction.taxAmount,
        receipt_number: transaction.id,
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
  }, [settings, transaction, onClose]);

  const cashPayment = transaction.payments.find((p) => p.method === "cash");
  const change = cashPayment ? cashPayment.amount - transaction.total : 0;

  return (
    <div className={overlayStyles}>
      <div className={modalStyles}>
        {/* 成功ヘッダー */}
        <div className={headerStyles.container}>
          <div className={headerStyles.iconWrapper}>✓</div>
          <h2 className={headerStyles.title}>会計完了</h2>
          <p className={headerStyles.subtitle}>ありがとうございました</p>
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

            {cashPayment && (
              <div className={contentStyles.divider}>
                <div className={contentStyles.detailRow}>
                  <span className={contentStyles.label}>お預かり</span>
                  <span className={contentStyles.amount}>
                    ¥{cashPayment.amount.toLocaleString()}
                  </span>
                </div>
                <div
                  className={`${contentStyles.detailRow} ${contentStyles.detailRowLast}`}
                >
                  <span className={contentStyles.label}>おつり</span>
                  <span className={contentStyles.changeAmount}>
                    ¥{change.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {!cashPayment && (
              <div className={contentStyles.divider}>
                <div
                  className={`${contentStyles.detailRow} ${contentStyles.detailRowLast}`}
                >
                  <span className={contentStyles.label}>支払方法</span>
                  <span className={contentStyles.cashlessLabel}>
                    大家キャッシュレス
                  </span>
                </div>
              </div>
            )}
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
