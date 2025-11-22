/**
 * レシートモーダル
 * 販売完了後のレシート表示
 */

import { formatPrice } from "../stores/cart";
import type { SaleRecord } from "../types";
import "./ReceiptModal.css";

interface ReceiptModalProps {
  sale: SaleRecord;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const saleDate = new Date(sale.timestamp);

  const handlePrint = () => {
    // TODO: Tauri経由でレシートプリンターに印刷
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="receipt-content">
          {/* レシートヘッダー */}
          <div className="receipt-header">
            <h2>mizPOS</h2>
            <p className="receipt-subtitle">ご購入ありがとうございます</p>
          </div>

          {/* 販売情報 */}
          <div className="receipt-info">
            <div className="info-row">
              <span>日時</span>
              <span>
                {saleDate.toLocaleDateString("ja-JP")} {saleDate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="info-row">
              <span>担当</span>
              <span>{sale.employee_number}</span>
            </div>
            <div className="info-row">
              <span>支払方法</span>
              <span>
                {sale.payment_method === "cash" && "現金"}
                {sale.payment_method === "card" && "カード"}
                {sale.payment_method === "other" && "その他"}
              </span>
            </div>
            {!sale.synced && (
              <div className="info-row offline-badge">
                <span>オフライン販売</span>
              </div>
            )}
          </div>

          {/* 明細 */}
          <div className="receipt-items">
            <div className="items-header">
              <span>商品名</span>
              <span>金額</span>
            </div>
            {sale.items.map((item) => (
              <div key={item.product_id} className="receipt-item">
                <div className="item-detail">
                  <span className="item-name">{item.product.title}</span>
                  {item.quantity > 1 && (
                    <span className="item-qty">
                      {formatPrice(item.product.price)} × {item.quantity}
                    </span>
                  )}
                </div>
                <span className="item-subtotal">{formatPrice(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* 合計 */}
          <div className="receipt-total">
            <span>合計</span>
            <span className="total-amount">{formatPrice(sale.total_amount)}</span>
          </div>

          {/* フッター */}
          <div className="receipt-footer">
            <p>またのご来店をお待ちしております</p>
            <p className="receipt-id">No. {sale.sale_id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="receipt-actions">
          <button type="button" className="print-button" onClick={handlePrint}>
            印刷
          </button>
          <button type="button" className="done-button" onClick={onClose}>
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
