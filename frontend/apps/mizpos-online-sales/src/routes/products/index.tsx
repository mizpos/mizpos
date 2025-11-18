import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { useCart } from "../../contexts/CartContext";
import { getProducts } from "../../lib/api";

export const Route = createFileRoute("/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const { addItem } = useCart();
  const {
    data: products,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  });

  if (isLoading) {
    return (
      <div className={css({ padding: "40px", textAlign: "center" })}>
        <p>商品を読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={css({ padding: "40px", textAlign: "center", color: "red" })}
      >
        <p>商品の読み込みに失敗しました</p>
        <p>{error.message}</p>
      </div>
    );
  }

  const activeProducts = products?.filter((p) => p.is_active) || [];

  return (
    <div
      className={css({
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <h1
        className={css({
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "30px",
        })}
      >
        商品一覧
      </h1>

      {activeProducts.length === 0 ? (
        <p className={css({ textAlign: "center", color: "#666" })}>
          商品がありません
        </p>
      ) : (
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "30px",
          })}
        >
          {activeProducts.map((product) => (
            <div
              key={product.product_id}
              className={css({
                border: "1px solid #ddd",
                borderRadius: "8px",
                overflow: "hidden",
                transition: "transform 0.2s",
                _hover: {
                  transform: "translateY(-4px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                },
              })}
            >
              <Link
                to="/products/$productId"
                params={{ productId: product.product_id }}
                className={css({
                  display: "block",
                  textDecoration: "none",
                  color: "inherit",
                })}
              >
                <div
                  className={css({
                    width: "100%",
                    height: "250px",
                    backgroundColor: "#f5f5f5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                    <p className={css({ color: "#999" })}>No Image</p>
                  )}
                </div>

                <div className={css({ padding: "16px" })}>
                  <h2
                    className={css({
                      fontSize: "18px",
                      fontWeight: "bold",
                      marginBottom: "8px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    })}
                  >
                    {product.name}
                  </h2>
                  <p
                    className={css({
                      fontSize: "14px",
                      color: "#666",
                      marginBottom: "8px",
                    })}
                  >
                    {product.author}
                  </p>
                  <p
                    className={css({
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: "#e47911",
                      marginBottom: "12px",
                    })}
                  >
                    ¥{product.price.toLocaleString()}
                  </p>
                  <p className={css({ fontSize: "14px", color: "#666" })}>
                    在庫: {product.stock_quantity}点
                  </p>
                </div>
              </Link>

              <div className={css({ padding: "0 16px 16px" })}>
                <button
                  type="button"
                  onClick={() => addItem(product, 1)}
                  disabled={product.stock_quantity <= 0}
                  className={css({
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#f0c14b",
                    border: "1px solid #a88734",
                    borderRadius: "3px",
                    cursor: "pointer",
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
