import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { getAllProducts } from "../lib/db";
import type { Product } from "../types";
import { Button, Input, Modal } from "./ui";

interface ProductSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
}

const styles = {
  searchContainer: css({
    marginBottom: "16px",
  }),
  productList: css({
    maxHeight: "400px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),
  productItem: css({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#1e293b",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background 0.15s",
    "&:hover": {
      background: "#334155",
    },
  }),
  productImage: css({
    width: "48px",
    height: "48px",
    borderRadius: "6px",
    objectFit: "cover",
    background: "#0f172a",
  }),
  productInfo: css({
    flex: 1,
    minWidth: 0,
  }),
  productName: css({
    fontSize: "15px",
    fontWeight: 600,
    color: "#f8fafc",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }),
  productMeta: css({
    fontSize: "13px",
    color: "#94a3b8",
    marginTop: "2px",
  }),
  productPrice: css({
    fontSize: "16px",
    fontWeight: 700,
    color: "#22d3ee",
  }),
  emptyMessage: css({
    textAlign: "center",
    color: "#94a3b8",
    padding: "32px",
    fontSize: "15px",
  }),
  footer: css({
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "16px",
  }),
};

export function ProductSelectModal({
  isOpen,
  onClose,
  onSelect,
}: ProductSelectModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // 商品を読み込む
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getAllProducts()
        .then((items) => {
          setProducts(items);
        })
        .finally(() => {
          setLoading(false);
        });
      setSearchQuery("");
    }
  }, [isOpen]);

  // 検索でフィルタ
  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      p.circleName?.toLowerCase().includes(query) ||
      p.jan.includes(query)
    );
  });

  const handleSelect = useCallback(
    (product: Product) => {
      onSelect(product);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <Modal open={isOpen} onClose={onClose} title="商品を選択" maxWidth="600px">
      <div className={styles.searchContainer}>
        <Input
          placeholder="商品名・サークル名で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className={styles.productList}>
        {loading ? (
          <div className={styles.emptyMessage}>読み込み中...</div>
        ) : filteredProducts.length === 0 ? (
          <div className={styles.emptyMessage}>
            {searchQuery ? "該当する商品がありません" : "商品がありません"}
          </div>
        ) : (
          filteredProducts.map((product) => (
            <button
              type="button"
              key={product.id}
              className={styles.productItem}
              onClick={() => handleSelect(product)}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className={styles.productImage}
                />
              ) : (
                <div className={styles.productImage} />
              )}
              <div className={styles.productInfo}>
                <div className={styles.productName}>{product.name}</div>
                {product.circleName && (
                  <div className={styles.productMeta}>{product.circleName}</div>
                )}
              </div>
              <div className={styles.productPrice}>
                ¥{product.price.toLocaleString()}
              </div>
            </button>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
      </div>
    </Modal>
  );
}
