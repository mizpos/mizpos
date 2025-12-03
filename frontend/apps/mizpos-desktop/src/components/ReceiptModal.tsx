import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import type { FullReceiptData } from "../lib/printer";
import {
  UnifiedPrinter,
  getPlatform,
  type UnifiedPrinterConfig,
} from "../lib/printer";
import { useSettingsStore } from "../stores/settings";
import type { Transaction } from "../types";

interface ReceiptModalProps {
  transaction: Transaction;
  onClose: () => void;
}

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
      setPrintError(error instanceof Error ? error.message : "印刷に失敗しました");
    } finally {
      setIsPrinting(false);
    }
  }, [settings, transaction, onClose]);

  const cashPayment = transaction.payments.find((p) => p.method === "cash");
  const change = cashPayment ? cashPayment.amount - transaction.total : 0;

  return (
    <div className={css({
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    })}>
      <div className={css({
        background: "#1e293b",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "420px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        overflow: "hidden",
        color: "#f8fafc",
      })}>
        {/* 成功ヘッダー */}
        <div className={css({
          background: "#16a34a",
          padding: "40px 24px",
          textAlign: "center",
        })}>
          <div className={css({
            width: "72px",
            height: "72px",
            margin: "0 auto 16px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
          })}>
            ✓
          </div>
          <h2 className={css({ margin: "0 0 8px 0", fontSize: "28px", fontWeight: 700 })}>
            会計完了
          </h2>
          <p className={css({ margin: 0, fontSize: "14px", opacity: 0.9 })}>
            ありがとうございました
          </p>
        </div>

        {/* レシート内容 */}
        <div className={css({ padding: "24px" })}>
          <div className={css({
            background: "#0f172a",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
          })}>
            <div className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            })}>
              <span className={css({ fontSize: "14px", color: "#94a3b8" })}>合計</span>
              <span className={css({
                fontSize: "28px",
                fontWeight: 700,
                fontFamily: "monospace",
              })}>
                ¥{transaction.total.toLocaleString()}
              </span>
            </div>

            {cashPayment && (
              <>
                <div className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                  paddingTop: "12px",
                  borderTop: "1px solid #334155",
                })}>
                  <span className={css({ fontSize: "14px", color: "#94a3b8" })}>お預かり</span>
                  <span className={css({ fontSize: "18px", fontFamily: "monospace" })}>
                    ¥{cashPayment.amount.toLocaleString()}
                  </span>
                </div>
                <div className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}>
                  <span className={css({ fontSize: "14px", color: "#94a3b8" })}>おつり</span>
                  <span className={css({
                    fontSize: "24px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: "#4ade80",
                  })}>
                    ¥{change.toLocaleString()}
                  </span>
                </div>
              </>
            )}

            {!cashPayment && (
              <div className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "12px",
                borderTop: "1px solid #334155",
              })}>
                <span className={css({ fontSize: "14px", color: "#94a3b8" })}>支払方法</span>
                <span className={css({
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#60a5fa",
                })}>
                  大家キャッシュレス
                </span>
              </div>
            )}
          </div>

          {printError && (
            <div className={css({
              background: "#7f1d1d",
              color: "#fecaca",
              padding: "14px 16px",
              borderRadius: "8px",
              fontSize: "14px",
              marginBottom: "16px",
              textAlign: "center",
            })}>
              {printError}
            </div>
          )}

          {/* ボタン */}
          <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" })}>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting || !settings.printer}
              className={css({
                padding: "16px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#f8fafc",
                background: "#3b82f6",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.15s",
                "&:hover:not(:disabled)": { background: "#2563eb" },
                "&:disabled": {
                  background: "#334155",
                  color: "#64748b",
                  cursor: "not-allowed",
                },
              })}
            >
              {isPrinting ? "印刷中..." : "レシート印刷"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPrinting}
              className={css({
                padding: "16px",
                fontSize: "15px",
                fontWeight: 600,
                color: "#f8fafc",
                background: "#334155",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.15s",
                "&:hover:not(:disabled)": { background: "#475569" },
                "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
              })}
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
