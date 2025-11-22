/**
 * カートコンポーネント
 * 選択した商品の一覧と合計を表示
 */

import { useCartStore, formatPrice } from "../stores/cart";
import "./Cart.css";

interface CartProps {
  onCheckout: () => void;
}

export function Cart({ onCheckout }: CartProps) {
  const { items, clearCart } = useCartStore();

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div className="cart">
      <div className="cart-header">
        <h2>カート</h2>
        {items.length > 0 && (
          <button
            type="button"
            className="clear-cart-button"
            onClick={clearCart}
          >
            クリア
          </button>
        )}
      </div>

      <div className="cart-items">
        {items.length === 0 ? (
          <div className="cart-empty">
            <p>商品を選択してください</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItemRow key={item.product_id} item={item} />
          ))
        )}
      </div>

      <div className="cart-footer">
        <div className="cart-summary">
          <div className="summary-row">
            <span>点数</span>
            <span>{totalItems}点</span>
          </div>
          <div className="summary-row total">
            <span>合計</span>
            <span className="total-amount">{formatPrice(totalAmount)}</span>
          </div>
        </div>

        <button
          type="button"
          className="checkout-button"
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
    <div className="cart-item">
      <div className="item-info">
        <span className="item-title">{item.product.title}</span>
        <span className="item-price">{formatPrice(item.product.price)}</span>
      </div>

      <div className="item-actions">
        <div className="quantity-control">
          <button
            type="button"
            className="qty-button"
            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
          >
            −
          </button>
          <span className="qty-value">{item.quantity}</span>
          <button
            type="button"
            className="qty-button"
            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
          >
            +
          </button>
        </div>

        <span className="item-subtotal">{formatPrice(item.subtotal)}</span>

        <button
          type="button"
          className="remove-button"
          onClick={() => removeItem(item.product_id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
