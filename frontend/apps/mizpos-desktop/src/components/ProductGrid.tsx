/**
 * 商品グリッド
 * タッチパネルで選択しやすい商品カード一覧
 */

import { useCachedImage } from "../hooks/useCachedImage";
import { formatPrice, useCartStore } from "../stores/cart";
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
  const cachedImageUrl = useCachedImage(product.image_url);

  return (
    <button
      type="button"
      className={`product-card ${isOutOfStock ? "out-of-stock" : ""}`}
      onClick={onSelect}
      disabled={isOutOfStock}
    >
      {cachedImageUrl ? (
        <img
          src={cachedImageUrl}
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
