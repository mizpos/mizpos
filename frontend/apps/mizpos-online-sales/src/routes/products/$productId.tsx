import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useCart } from "../../contexts/CartContext";
import { getProduct } from "../../lib/api";

export const Route = createFileRoute("/products/$productId")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
  });

  if (isLoading) {
    return (
      <div className={css({ padding: "40px", textAlign: "center" })}>
        <p>商品を読み込み中...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div
        className={css({ padding: "40px", textAlign: "center", color: "red" })}
      >
        <p>商品の読み込みに失敗しました</p>
        <Link
          to="/products"
          className={css({ color: "blue", textDecoration: "underline" })}
        >
          商品一覧に戻る
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
    navigate({ to: "/cart" });
  };

  return (
    <div
      className={css({
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <Link
        to="/products"
        className={css({
          display: "inline-block",
          marginBottom: "20px",
          color: "blue",
          textDecoration: "underline",
        })}
      >
        ← 商品一覧に戻る
      </Link>

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
          gap: "40px",
        })}
      >
        {/* 商品画像 */}
        <div>
          <div
            className={css({
              width: "100%",
              height: "500px",
              backgroundColor: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "8px",
              overflow: "hidden",
            })}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className={css({
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                })}
              />
            ) : (
              <p className={css({ color: "#999", fontSize: "18px" })}>
                No Image
              </p>
            )}
          </div>
        </div>

        {/* 商品情報 */}
        <div>
          <h1
            className={css({
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "12px",
            })}
          >
            {product.name}
          </h1>

          <p
            className={css({
              fontSize: "16px",
              color: "#666",
              marginBottom: "8px",
            })}
          >
            著者: {product.author}
          </p>

          <p
            className={css({
              fontSize: "16px",
              color: "#666",
              marginBottom: "20px",
            })}
          >
            出版社: {product.publisher}
          </p>

          <div
            className={css({
              borderTop: "1px solid #ddd",
              borderBottom: "1px solid #ddd",
              paddingY: "16px",
              marginBottom: "20px",
            })}
          >
            <p
              className={css({
                fontSize: "32px",
                fontWeight: "bold",
                color: "#e47911",
              })}
            >
              ¥{product.price.toLocaleString()}
            </p>
          </div>

          <div className={css({ marginBottom: "20px" })}>
            <h2
              className={css({
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "8px",
              })}
            >
              商品説明
            </h2>
            <p
              className={css({
                fontSize: "14px",
                lineHeight: "1.6",
                color: "#333",
              })}
            >
              {product.description || "商品説明はありません"}
            </p>
          </div>

          <div className={css({ marginBottom: "20px" })}>
            <p className={css({ fontSize: "14px", marginBottom: "4px" })}>
              カテゴリ: {product.category}
            </p>
            <p className={css({ fontSize: "14px", marginBottom: "4px" })}>
              在庫: {product.stock_quantity}点
            </p>
            <p className={css({ fontSize: "14px", marginBottom: "4px" })}>
              種類:{" "}
              {product.variant_type === "physical"
                ? "物理商品"
                : product.variant_type === "digital"
                  ? "デジタル商品"
                  : "両方"}
            </p>
          </div>

          {/* カートに追加 */}
          <div
            className={css({
              padding: "20px",
              backgroundColor: "#f3f3f3",
              borderRadius: "8px",
            })}
          >
            <div className={css({ marginBottom: "16px" })}>
              <label
                htmlFor="quantity"
                className={css({
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  display: "block",
                })}
              >
                数量:
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={css({
                  padding: "8px",
                  borderRadius: "3px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                })}
              >
                {Array.from(
                  { length: Math.min(product.stock_quantity, 10) },
                  (_, i) => i + 1,
                ).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.stock_quantity <= 0}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "bold",
                _hover: {
                  backgroundColor: "#ddb347",
                },
                _disabled: {
                  backgroundColor: "#ddd",
                  cursor: "not-allowed",
                  borderColor: "#999",
                },
              })}
            >
              {product.stock_quantity <= 0 ? "在庫なし" : "カートに追加"}
            </button>

            <Link
              to="/cart"
              className={css({
                display: "block",
                width: "100%",
                padding: "12px",
                marginTop: "12px",
                backgroundColor: "#ff9900",
                border: "1px solid #e68a00",
                borderRadius: "3px",
                textAlign: "center",
                textDecoration: "none",
                color: "black",
                fontSize: "16px",
                fontWeight: "bold",
                _hover: {
                  backgroundColor: "#fa8900",
                },
              })}
            >
              カートを見る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
