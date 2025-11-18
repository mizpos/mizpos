import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { useCart } from "../../contexts/CartContext";

export const Route = createFileRoute("/cart/")({
  component: CartPage,
});

function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, totalItems } = useCart();

  if (items.length === 0) {
    return (
      <div
        className={css({
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        })}
      >
        <h1 className={css({ fontSize: "32px", fontWeight: "bold", marginBottom: "20px" })}>
          ショッピングカート
        </h1>
        <p className={css({ fontSize: "18px", marginBottom: "30px", color: "#666" })}>
          カートは空です
        </p>
        <Link
          to="/products"
          className={css({
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#f0c14b",
            border: "1px solid #a88734",
            borderRadius: "3px",
            textDecoration: "none",
            color: "black",
            fontWeight: "bold",
            _hover: {
              backgroundColor: "#ddb347",
            },
          })}
        >
          商品を見る
        </Link>
      </div>
    );
  }

  return (
    <div className={css({ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" })}>
      <h1 className={css({ fontSize: "32px", fontWeight: "bold", marginBottom: "30px" })}>
        ショッピングカート ({totalItems}点)
      </h1>

      <div className={css({ display: "grid", gridTemplateColumns: { base: "1fr", md: "2fr 1fr" }, gap: "30px" })}>
        {/* カートアイテム一覧 */}
        <div>
          {items.map((item) => (
            <div
              key={item.product.product_id}
              className={css({
                display: "grid",
                gridTemplateColumns: "120px 1fr auto",
                gap: "20px",
                padding: "20px",
                borderBottom: "1px solid #ddd",
              })}
            >
              {/* 商品画像 */}
              <div
                className={css({
                  width: "120px",
                  height: "160px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                {item.product.image_url ? (
                  <img
                    src={item.product.image_url}
                    alt={item.product.name}
                    className={css({
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    })}
                  />
                ) : (
                  <p className={css({ color: "#999", fontSize: "12px" })}>No Image</p>
                )}
              </div>

              {/* 商品情報 */}
              <div>
                <Link
                  to="/products/$productId"
                  params={{ productId: item.product.product_id }}
                  className={css({
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                    display: "block",
                    color: "#007185",
                    textDecoration: "none",
                    _hover: {
                      color: "#c7511f",
                      textDecoration: "underline",
                    },
                  })}
                >
                  {item.product.name}
                </Link>
                <p className={css({ fontSize: "14px", color: "#666", marginBottom: "4px" })}>
                  著者: {item.product.author}
                </p>
                <p className={css({ fontSize: "14px", color: "#666", marginBottom: "12px" })}>
                  在庫: {item.product.stock_quantity}点
                </p>

                {/* 数量選択 */}
                <div className={css({ display: "flex", alignItems: "center", gap: "12px" })}>
                  <label htmlFor={`qty-${item.product.product_id}`} className={css({ fontSize: "14px" })}>
                    数量:
                  </label>
                  <select
                    id={`qty-${item.product.product_id}`}
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product.product_id, Number(e.target.value))}
                    className={css({
                      padding: "6px",
                      borderRadius: "3px",
                      border: "1px solid #ddd",
                      fontSize: "14px",
                    })}
                  >
                    {Array.from({ length: Math.min(item.product.stock_quantity, 10) }, (_, i) => i + 1).map(
                      (num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      )
                    )}
                  </select>
                  <button
                    onClick={() => removeItem(item.product.product_id)}
                    className={css({
                      fontSize: "14px",
                      color: "#007185",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      _hover: {
                        color: "#c7511f",
                      },
                    })}
                  >
                    削除
                  </button>
                </div>
              </div>

              {/* 価格 */}
              <div className={css({ textAlign: "right" })}>
                <p className={css({ fontSize: "20px", fontWeight: "bold", color: "#e47911" })}>
                  ¥{(item.product.price * item.quantity).toLocaleString()}
                </p>
                <p className={css({ fontSize: "14px", color: "#666" })}>
                  単価: ¥{item.product.price.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 注文サマリー */}
        <div
          className={css({
            padding: "20px",
            backgroundColor: "#f3f3f3",
            borderRadius: "8px",
            height: "fit-content",
          })}
        >
          <h2 className={css({ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" })}>
            注文内容
          </h2>
          <div
            className={css({
              borderBottom: "1px solid #ddd",
              paddingBottom: "16px",
              marginBottom: "16px",
            })}
          >
            <div className={css({ display: "flex", justifyContent: "space-between", marginBottom: "8px" })}>
              <span className={css({ fontSize: "14px" })}>小計 ({totalItems}点):</span>
              <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥{subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          <div className={css({ marginBottom: "16px" })}>
            <div className={css({ display: "flex", justifyContent: "space-between" })}>
              <span className={css({ fontSize: "18px", fontWeight: "bold" })}>合計:</span>
              <span className={css({ fontSize: "24px", fontWeight: "bold", color: "#e47911" })}>
                ¥{subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          <Link
            to="/checkout"
            className={css({
              display: "block",
              width: "100%",
              padding: "12px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              textAlign: "center",
              textDecoration: "none",
              color: "black",
              fontSize: "16px",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#ddb347",
              },
            })}
          >
            レジに進む
          </Link>

          <Link
            to="/products"
            className={css({
              display: "block",
              width: "100%",
              padding: "12px",
              marginTop: "12px",
              textAlign: "center",
              textDecoration: "none",
              color: "#007185",
              fontSize: "14px",
              _hover: {
                color: "#c7511f",
                textDecoration: "underline",
              },
            })}
          >
            買い物を続ける
          </Link>
        </div>
      </div>
    </div>
  );
}
