import { useState } from "react";
import { css } from "styled-system/css";
import type { FullReceiptData } from "../lib/printer";
import { formatPrice } from "../stores/cart";
import { usePrinterStore } from "../stores/printer";
import type { SaleRecord } from "../types";

interface ReceiptModalProps {
  sale: SaleRecord;
  onClose: () => void;
  eventName?: string;
}

/**
 * SaleRecord を FullReceiptData に変換
 */
function convertToFullReceiptData(
  sale: SaleRecord,
  eventName: string,
): FullReceiptData {
  // 消費税計算（内税10%として計算）
  const taxRate = 10;
  const taxAmount = Math.floor(sale.total_amount - sale.total_amount / 1.1);

  // 支払方法の日本語名
  const paymentMethodName = (() => {
    switch (sale.payment_method) {
      case "cash":
        return "現金";
      case "card":
        return "カード";
      case "other":
        return "その他";
      default:
        return sale.payment_method;
    }
  })();

  return {
    event_name: eventName,
    staff_id: sale.employee_number,
    customer_name: undefined, // 必要に応じて設定可能
    items: sale.items.map((item) => ({
      circle_name: item.product.publisher_id || "",
      jan: item.product.barcode || "",
      isbn: item.product.isdn || "",
      quantity: item.quantity,
      price: item.subtotal,
    })),
    total: sale.total_amount,
    payments: [
      {
        method: paymentMethodName,
        amount: sale.received_amount,
      },
    ],
    tax_rate: taxRate,
    tax_amount: taxAmount,
    receipt_number: sale.sale_id.slice(0, 8).toUpperCase(),
  };
}

const styles = {
  modalOverlay: css({
    "@media print": {
      position: "static",
      background: "none",
    },
  }),
  modalBackdrop: css({}),
  receiptModal: css({
    position: "relative",
    background: "white",
    borderRadius: "20px",
    width: "90%",
    maxWidth: "400px",
    maxHeight: "90vh",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    display: "flex",
    flexDirection: "column",
    zIndex: 1,
    "@media print": {
      boxShadow: "none",
      maxWidth: "none",
      width: "80mm",
    },
  }),
  receiptContent: css({
    flex: 1,
    padding: "32px 24px",
    overflowY: "auto",
    background: "#fafafa",
    "@media print": {
      padding: 0,
      background: "white",
    },
  }),
  receiptHeader: css({
    textAlign: "center",
    paddingBottom: "20px",
    borderBottom: "2px dashed #ccc",
    marginBottom: "20px",
    "& h2": {
      margin: 0,
      fontSize: "28px",
      fontWeight: 700,
      color: "#1a237e",
    },
  }),
  receiptSubtitle: css({
    margin: "8px 0 0 0",
    fontSize: "14px",
    color: "#666",
  }),
  receiptInfo: css({
    padding: "16px 0",
    borderBottom: "1px dashed #ccc",
    marginBottom: "16px",
  }),
  infoRow: css({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#666",
    marginBottom: "6px",
    "&:last-child": {
      marginBottom: 0,
    },
  }),
  offlineBadge: css({
    display: "flex",
    justifyContent: "center",
    fontSize: "13px",
    color: "#666",
    marginTop: "8px",
    marginBottom: "6px",
    "&:last-child": {
      marginBottom: 0,
    },
    "& span": {
      padding: "4px 12px",
      background: "#fff3e0",
      color: "#e65100",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 600,
    },
  }),
  receiptItems: css({
    paddingBottom: "16px",
    borderBottom: "1px dashed #ccc",
    marginBottom: "16px",
  }),
  itemsHeader: css({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#999",
    marginBottom: "12px",
    paddingBottom: "8px",
    borderBottom: "1px solid #eee",
  }),
  receiptItem: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "10px",
    "&:last-child": {
      marginBottom: 0,
    },
  }),
  itemDetail: css({
    flex: 1,
    marginRight: "12px",
  }),
  itemName: css({
    display: "block",
    fontSize: "14px",
    color: "#333",
    lineHeight: 1.3,
  }),
  itemQty: css({
    display: "block",
    fontSize: "12px",
    color: "#999",
    marginTop: "2px",
  }),
  itemSubtotal: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#333",
  }),
  receiptSubtotal: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    fontSize: "14px",
    color: "#666",
  }),
  receiptDiscount: css({
    padding: "8px 0 12px 0",
  }),
  discountRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "14px",
    "& span:first-child": {
      color: "#666",
    },
  }),
  discountAmount: css({
    color: "#d32f2f",
    fontWeight: 600,
  }),
  receiptTotal: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderTop: "1px dashed #ccc",
    borderBottom: "2px solid #333",
    "& span:first-child": {
      fontSize: "16px",
      fontWeight: 600,
      color: "#333",
    },
  }),
  totalAmount: css({
    fontSize: "28px",
    fontWeight: 700,
    color: "#1a237e",
  }),
  receiptPaymentDetail: css({
    padding: "12px 0",
    borderBottom: "1px dashed #ccc",
  }),
  paymentRow: css({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: "#666",
    marginBottom: "4px",
    "&:last-child": {
      marginBottom: 0,
    },
  }),
  receiptFooter: css({
    textAlign: "center",
    paddingTop: "20px",
    "& p": {
      margin: "0 0 8px 0",
      fontSize: "13px",
      color: "#666",
    },
  }),
  receiptId: css({
    fontSize: "11px",
    color: "#999",
    fontFamily: "monospace",
  }),
  receiptActions: css({
    display: "flex",
    gap: "12px",
    padding: "20px 24px",
    background: "white",
    borderTop: "1px solid #e0e0e0",
    "@media print": {
      display: "none",
    },
  }),
  printButton: css({
    flex: 1,
    padding: "16px",
    fontSize: "16px",
    fontWeight: 600,
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#1a237e",
    background: "#e8eaf6",
    border: "1px solid #c5cae9",
    "&:hover": {
      background: "#c5cae9",
    },
    "&:disabled": {
      cursor: "not-allowed",
      opacity: 0.6,
    },
  }),
  printError: css({
    color: "#d32f2f",
    fontSize: "12px",
    textAlign: "center",
    padding: "8px",
  }),
  printSuccess: css({
    color: "#4caf50",
    fontSize: "12px",
    textAlign: "center",
    padding: "8px",
  }),
  doneButton: css({
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
    "&:hover": {
      background: "#43a047",
    },
  }),
};

export function ReceiptModal({
  sale,
  onClose,
  eventName = "mizPOS",
}: ReceiptModalProps) {
  const saleDate = new Date(sale.timestamp);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState(false);

  const { printFullReceipt, printerConfig } = usePrinterStore();

  const handlePrint = async () => {
    // プリンターが設定されていない場合はブラウザ印刷にフォールバック
    if (!printerConfig) {
      window.print();
      return;
    }

    setIsPrinting(true);
    setPrintError(null);
    setPrintSuccess(false);

    try {
      const receiptData = convertToFullReceiptData(sale, eventName);
      const result = await printFullReceipt(receiptData);

      if (result.success) {
        setPrintSuccess(true);
        // 3秒後に成功メッセージを消す
        setTimeout(() => setPrintSuccess(false), 3000);
      } else {
        setPrintError(result.error || "印刷に失敗しました");
      }
    } catch (error) {
      setPrintError(
        error instanceof Error ? error.message : "印刷中にエラーが発生しました",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className={`modal-overlay ${styles.modalOverlay}`}>
      <button
        type="button"
        className="modal-backdrop"
        onClick={onClose}
        aria-label="モーダルを閉じる"
      />
      <div
        className={styles.receiptModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
      >
        <div className={styles.receiptContent}>
          {/* レシートヘッダー */}
          <div className={styles.receiptHeader}>
            <h2 id="receipt-modal-title">mizPOS</h2>
            <p className={styles.receiptSubtitle}>ご購入ありがとうございます</p>
          </div>

          {/* 販売情報 */}
          <div className={styles.receiptInfo}>
            <div className={styles.infoRow}>
              <span>日時</span>
              <span>
                {saleDate.toLocaleDateString("ja-JP")}{" "}
                {saleDate.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>担当</span>
              <span>{sale.employee_number}</span>
            </div>
            <div className={styles.infoRow}>
              <span>支払方法</span>
              <span>
                {sale.payment_method === "cash" && "現金"}
                {sale.payment_method === "card" && "カード"}
                {sale.payment_method === "other" && "その他"}
              </span>
            </div>
            {!sale.synced && (
              <div className={styles.offlineBadge}>
                <span>同期待ち</span>
              </div>
            )}
          </div>

          {/* 明細 */}
          <div className={styles.receiptItems}>
            <div className={styles.itemsHeader}>
              <span>商品名</span>
              <span>金額</span>
            </div>
            {sale.items.map((item) => (
              <div key={item.product_id} className={styles.receiptItem}>
                <div className={styles.itemDetail}>
                  <span className={styles.itemName}>{item.product.title}</span>
                  {item.quantity > 1 && (
                    <span className={styles.itemQty}>
                      {formatPrice(item.product.price)} × {item.quantity}
                    </span>
                  )}
                </div>
                <span className={styles.itemSubtotal}>
                  {formatPrice(item.subtotal)}
                </span>
              </div>
            ))}
          </div>

          {/* 小計 */}
          <div className={styles.receiptSubtotal}>
            <span>小計</span>
            <span>{formatPrice(sale.subtotal)}</span>
          </div>

          {/* クーポン割引 */}
          {sale.coupon && sale.discount_amount > 0 && (
            <div className={styles.receiptDiscount}>
              <div className={styles.discountRow}>
                <span>クーポン: {sale.coupon.name}</span>
                <span className={styles.discountAmount}>
                  -{formatPrice(sale.discount_amount)}
                </span>
              </div>
            </div>
          )}

          {/* 合計 */}
          <div className={styles.receiptTotal}>
            <span>合計</span>
            <span className={styles.totalAmount}>
              {formatPrice(sale.total_amount)}
            </span>
          </div>

          {/* 現金の場合は受領額を表示 */}
          {sale.payment_method === "cash" && (
            <div className={styles.receiptPaymentDetail}>
              <div className={styles.paymentRow}>
                <span>お預かり</span>
                <span>{formatPrice(sale.received_amount)}</span>
              </div>
              <div className={styles.paymentRow}>
                <span>お釣り</span>
                <span>
                  {formatPrice(sale.received_amount - sale.total_amount)}
                </span>
              </div>
            </div>
          )}

          {/* フッター */}
          <div className={styles.receiptFooter}>
            <p>またのご来店をお待ちしております</p>
            <p className={styles.receiptId}>No. {sale.sale_id.slice(0, 8)}</p>
          </div>
        </div>

        <div className={styles.receiptActions}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <button
              type="button"
              className={styles.printButton}
              onClick={handlePrint}
              disabled={isPrinting}
            >
              {isPrinting ? "印刷中..." : "印刷"}
            </button>
            {printError && (
              <div className={styles.printError}>{printError}</div>
            )}
            {printSuccess && (
              <div className={styles.printSuccess}>印刷完了</div>
            )}
          </div>
          <button type="button" className={styles.doneButton} onClick={onClose}>
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
