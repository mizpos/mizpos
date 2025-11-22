import { css } from "styled-system/css";
import { formatPrice, useCartStore } from "../stores/cart";

const styles = {
  cart: css({
    display: "flex",
    flexDirection: "column",
    height: "100%",
  }),

  cartHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #e0e0e0",
  }),

  cartHeaderTitle: css({
    margin: 0,
    fontSize: "18px",
    fontWeight: 600,
  }),

  clearCartButton: css({
    padding: "6px 12px",
    fontSize: "12px",
    color: "#c62828",
    background: "#ffebee",
    border: "1px solid #ef9a9a",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      background: "#ffcdd2",
    },
  }),

  cartItems: css({
    flex: 1,
    overflowY: "auto",
    padding: "8px",
  }),

  cartEmpty: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "#999",
    fontSize: "14px",
  }),

  cartItem: css({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    background: "#f9f9f9",
    borderRadius: "8px",
    marginBottom: "8px",
  }),

  itemInfo: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  }),

  itemTitle: css({
    fontSize: "14px",
    fontWeight: 500,
    color: "#333",
    flex: 1,
    marginRight: "8px",
  }),

  itemPrice: css({
    fontSize: "13px",
    color: "#666",
  }),

  itemActions: css({
    display: "flex",
    alignItems: "center",
    gap: "12px",
  }),

  quantityControl: css({
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "white",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    overflow: "hidden",
  }),

  qtyButton: css({
    width: "32px",
    height: "32px",
    fontSize: "18px",
    fontWeight: 600,
    color: "#1a237e",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    transition: "background 0.2s",
    _hover: {
      background: "#e8eaf6",
    },
    _active: {
      background: "#c5cae9",
    },
  }),

  qtyValue: css({
    minWidth: "32px",
    textAlign: "center",
    fontSize: "14px",
    fontWeight: 600,
  }),

  itemSubtotal: css({
    fontSize: "15px",
    fontWeight: 600,
    color: "#1a237e",
    minWidth: "80px",
    textAlign: "right",
  }),

  removeButton: css({
    width: "28px",
    height: "28px",
    fontSize: "16px",
    color: "#999",
    background: "transparent",
    border: "1px solid #e0e0e0",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      color: "#c62828",
      borderColor: "#ef9a9a",
      background: "#ffebee",
    },
  }),

  cartFooter: css({
    padding: "16px 20px",
    borderTop: "1px solid #e0e0e0",
    background: "#fafafa",
  }),

  cartSummary: css({
    marginBottom: "16px",
  }),

  summaryRow: css({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "14px",
    color: "#666",
    marginBottom: "8px",
  }),

  summaryRowTotal: css({
    display: "flex",
    justifyContent: "space-between",
    fontSize: "18px",
    fontWeight: 600,
    color: "#333",
    marginBottom: 0,
    paddingTop: "8px",
    borderTop: "1px solid #e0e0e0",
  }),

  totalAmount: css({
    fontSize: "24px",
    color: "#1a237e",
  }),

  checkoutButton: css({
    width: "100%",
    padding: "18px",
    fontSize: "18px",
    fontWeight: 600,
    color: "white",
    background: "#4caf50",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      _enabled: {
        background: "#43a047",
      },
    },
    _active: {
      _enabled: {
        transform: "scale(0.98)",
      },
    },
    _disabled: {
      background: "#bdbdbd",
      cursor: "not-allowed",
    },
  }),
};

interface CartProps {
  onCheckout: () => void;
}

export function Cart({ onCheckout }: CartProps) {
  const { items, clearCart } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className={styles.cart}>
      <div className={styles.cartHeader}>
        <h2 className={styles.cartHeaderTitle}>カート</h2>
        {items.length > 0 && (
          <button
            type="button"
            className={styles.clearCartButton}
            onClick={clearCart}
          >
            クリア
          </button>
        )}
      </div>

      <div className={styles.cartItems}>
        {items.length === 0 ? (
          <div className={styles.cartEmpty}>
            <p>商品を選択してください</p>
          </div>
        ) : (
          items.map((item) => <CartItemRow key={item.product_id} item={item} />)
        )}
      </div>

      <div className={styles.cartFooter}>
        <div className={styles.cartSummary}>
          <div className={styles.summaryRow}>
            <span>点数</span>
            <span>{totalItems}点</span>
          </div>
          <div className={styles.summaryRowTotal}>
            <span>合計</span>
            <span className={styles.totalAmount}>
              {formatPrice(totalAmount)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={styles.checkoutButton}
          onClick={onCheckout}
          disabled={items.length === 0}
        >
          会計へ進む
        </button>
      </div>
    </div>
  );
}

interface CartItemRowProps {
  item: {
    product_id: string;
    product: {
      title: string;
      price: number;
    };
    quantity: number;
    subtotal: number;
  };
}

function CartItemRow({ item }: CartItemRowProps) {
  const { updateQuantity, removeItem } = useCartStore();

  return (
    <div className={styles.cartItem}>
      <div className={styles.itemInfo}>
        <span className={styles.itemTitle}>{item.product.title}</span>
        <span className={styles.itemPrice}>
          {formatPrice(item.product.price)}
        </span>
      </div>

      <div className={styles.itemActions}>
        <div className={styles.quantityControl}>
          <button
            type="button"
            className={styles.qtyButton}
            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
          >
            −
          </button>
          <span className={styles.qtyValue}>{item.quantity}</span>
          <button
            type="button"
            className={styles.qtyButton}
            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
          >
            +
          </button>
        </div>

        <span className={styles.itemSubtotal}>
          {formatPrice(item.subtotal)}
        </span>

        <button
          type="button"
          className={styles.removeButton}
          onClick={() => removeItem(item.product_id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
