import { Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import type { Product } from "../lib/api";

interface AddToCartModalProps {
  product: Product;
  quantity: number;
  onClose: () => void;
}

export default function AddToCartModal({
  product,
  quantity,
  onClose,
}: AddToCartModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      })}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        role="document"
        className={css({
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "32px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        })}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className={css({
            textAlign: "center",
            marginBottom: "24px",
          })}
        >
          <div
            className={css({
              width: "48px",
              height: "48px",
              backgroundColor: "#d1f2eb",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            })}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-label="成功"
            >
              <title>成功アイコン</title>
              <path
                d="M9 11l3 3L22 4"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2
            id="modal-title"
            className={css({
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "8px",
            })}
          >
            カートに追加しました
          </h2>
          <p className={css({ fontSize: "14px", color: "#666" })}>
            {product.name} × {quantity}
          </p>
        </div>

        <div
          className={css({
            borderTop: "1px solid #ddd",
            borderBottom: "1px solid #ddd",
            paddingY: "16px",
            marginBottom: "24px",
          })}
        >
          <div
            className={css({
              display: "flex",
              gap: "16px",
              alignItems: "center",
            })}
          >
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                className={css({
                  width: "80px",
                  height: "80px",
                  objectFit: "cover",
                  borderRadius: "4px",
                })}
              />
            )}
            <div className={css({ flex: 1 })}>
              <p
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                  marginBottom: "4px",
                })}
              >
                {product.name}
              </p>
              <p className={css({ fontSize: "14px", color: "#666" })}>
                ¥{product.price.toLocaleString()} × {quantity}
              </p>
              <p
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "#e47911",
                  marginTop: "4px",
                })}
              >
                小計: ¥{(product.price * quantity).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          })}
        >
          <Link
            to="/cart"
            className={css({
              display: "block",
              width: "100%",
              padding: "14px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              textAlign: "center",
              textDecoration: "none",
              color: "#111",
              fontSize: "16px",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#ddb347",
              },
            })}
          >
            カートを見る
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={css({
              width: "100%",
              padding: "14px",
              backgroundColor: "white",
              border: "1px solid #ddd",
              borderRadius: "3px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              _hover: {
                backgroundColor: "#f7f7f7",
              },
            })}
          >
            買い物を続ける
          </button>
        </div>
      </div>
    </div>
  );
}
