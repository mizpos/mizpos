import { css } from "styled-system/css";
import { useCachedImage } from "../hooks/useCachedImage";
import { formatPrice, useCartStore } from "../stores/cart";
import type { Product } from "../types";

const styles = {
  productGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
    padding: "4px",
    overflowY: "auto",
    flex: 1,
    "@media (pointer: coarse)": {
      gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
      gap: "8px",
    },
  }),

  productCard: css({
    display: "flex",
    flexDirection: "column",
    background: "white",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "pointer",
    transition: "all 0.2s",
    textAlign: "left",
    fontFamily: "inherit",
    position: "relative",
    _hover: {
      _enabled: {
        borderColor: "#1a237e",
        transform: "translateY(-2px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      },
    },
    _active: {
      _enabled: {
        transform: "scale(0.98)",
      },
    },
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.7,
    },
  }),

  productCardOutOfStock: css({
    display: "flex",
    flexDirection: "column",
    background: "#f5f5f5",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    overflow: "hidden",
    cursor: "not-allowed",
    transition: "all 0.2s",
    textAlign: "left",
    fontFamily: "inherit",
    position: "relative",
    opacity: 0.7,
  }),

  productImage: css({
    width: "100%",
    aspectRatio: "1",
    objectFit: "cover",
    background: "#f5f5f5",
  }),

  productImagePlaceholder: css({
    width: "100%",
    aspectRatio: "1",
    background: "linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#7986cb",
    fontSize: "12px",
  }),

  productInfo: css({
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),

  productTitle: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#333",
    margin: 0,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),

  productMeta: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),

  productPrice: css({
    fontSize: "16px",
    fontWeight: 700,
    color: "#1a237e",
  }),

  productStock: css({
    fontSize: "11px",
    color: "#666",
    padding: "2px 6px",
    background: "#f5f5f5",
    borderRadius: "4px",
  }),

  productStockZero: css({
    fontSize: "11px",
    color: "#c62828",
    padding: "2px 6px",
    background: "#ffebee",
    borderRadius: "4px",
  }),

  outOfStockOverlay: css({
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "14px",
    fontWeight: 600,
  }),
};

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const { addItem } = useCartStore();

  return (
    <div className={styles.productGrid}>
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
      className={
        isOutOfStock ? styles.productCardOutOfStock : styles.productCard
      }
      onClick={onSelect}
      disabled={isOutOfStock}
    >
      {cachedImageUrl ? (
        <img
          src={cachedImageUrl}
          alt={product.title}
          className={styles.productImage}
          loading="lazy"
        />
      ) : (
        <div className={styles.productImagePlaceholder}>
          <span>No Image</span>
        </div>
      )}

      <div className={styles.productInfo}>
        <h3 className={styles.productTitle}>{product.title}</h3>
        <div className={styles.productMeta}>
          <span className={styles.productPrice}>
            {formatPrice(product.price)}
          </span>
          <span
            className={
              isOutOfStock ? styles.productStockZero : styles.productStock
            }
          >
            在庫: {product.quantity}
          </span>
        </div>
      </div>

      {isOutOfStock && (
        <div className={styles.outOfStockOverlay}>
          <span>在庫切れ</span>
        </div>
      )}
    </button>
  );
}
