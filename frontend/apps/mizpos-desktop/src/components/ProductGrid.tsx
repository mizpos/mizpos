/**
 * 商品グリッド
 * タッチパネルで選択しやすい商品カード一覧
 */

import { useCartStore, formatPrice } from "../stores/cart";
import type { Product } from "../types";
import "./ProductGrid.css";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addItem } = useCartStore();

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.product_id}
          product={product}
          onSelect={() => addItem(product, 1)}
        />
      ))}
    </div>
  );
}

interface ProductCardProps {
  product: Product;
  onSelect: () => void;
}

function ProductCard({ product, onSelect }: ProductCardProps) {
  const isOutOfStock = product.quantity <= 0;

  return (
    <button
      type="button"
      className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`}
      onClick={onSelect}
      disabled={isOutOfStock}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.title}
          className="product-image"
          loading="lazy"
        />
      ) : (
        <div className="product-image-placeholder">
          <span>No Image</span>
        </div>
      )}

      <div className="product-info">
        <h3 className="product-title">{product.title}</h3>
        <div className="product-meta">
          <span className="product-price">{formatPrice(product.price)}</span>
          <span className={`product-stock ${isOutOfStock ? "zero" : ""}`}>
            在庫: {product.quantity}
          </span>
        </div>
      </div>

      {isOutOfStock && (
        <div className="out-of-stock-overlay">
          <span>在庫切れ</span>
        </div>
      )}
    </button>
  );
}
