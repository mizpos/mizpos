import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className={css({ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" })}>
      {/* ヒーローセクション */}
      <div
        className={css({
          padding: "60px 40px",
          backgroundColor: "#f0f2f5",
          borderRadius: "12px",
          marginBottom: "40px",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "48px",
            fontWeight: "bold",
            marginBottom: "20px",
            color: "#232f3e",
          })}
        >
          mizpos Online Sales
        </h1>
        <p className={css({ fontSize: "20px", color: "#666", marginBottom: "30px" })}>
          同人誌・書籍のオンライン販売
        </p>
        <Link
          to="/products"
          className={css({
            display: "inline-block",
            padding: "16px 32px",
            backgroundColor: "#f0c14b",
            border: "1px solid #a88734",
            borderRadius: "3px",
            textDecoration: "none",
            color: "black",
            fontSize: "18px",
            fontWeight: "bold",
            _hover: {
              backgroundColor: "#ddb347",
            },
          })}
        >
          商品を見る
        </Link>
      </div>

      {/* 特徴セクション */}
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "repeat(3, 1fr)" },
          gap: "30px",
          marginBottom: "40px",
        })}
      >
        <div className={css({ padding: "24px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" })}>
          <h2 className={css({ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" })}>
            豊富な品揃え
          </h2>
          <p className={css({ fontSize: "14px", color: "#666", lineHeight: "1.6" })}>
            様々なジャンルの同人誌・書籍を取り揃えています
          </p>
        </div>

        <div className={css({ padding: "24px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" })}>
          <h2 className={css({ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" })}>
            安全な決済
          </h2>
          <p className={css({ fontSize: "14px", color: "#666", lineHeight: "1.6" })}>
            Stripeによる安全なクレジットカード決済に対応
          </p>
        </div>

        <div className={css({ padding: "24px", backgroundColor: "white", borderRadius: "8px", border: "1px solid #ddd" })}>
          <h2 className={css({ fontSize: "20px", fontWeight: "bold", marginBottom: "12px" })}>
            迅速な配送
          </h2>
          <p className={css({ fontSize: "14px", color: "#666", lineHeight: "1.6" })}>
            ご注文後、迅速に配送いたします
          </p>
        </div>
      </div>

      {/* クイックリンク */}
      <div
        className={css({
          padding: "32px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #ddd",
        })}
      >
        <h2 className={css({ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" })}>
          クイックリンク
        </h2>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", sm: "repeat(2, 1fr)" },
            gap: "16px",
          })}
        >
          <Link
            to="/products"
            className={css({
              padding: "16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#007185",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#e9ecef",
                textDecoration: "underline",
              },
            })}
          >
            → 商品一覧
          </Link>
          <Link
            to="/delivery"
            className={css({
              padding: "16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#007185",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#e9ecef",
                textDecoration: "underline",
              },
            })}
          >
            → 配送のご案内
          </Link>
          <Link
            to="/my-orders"
            className={css({
              padding: "16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#007185",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#e9ecef",
                textDecoration: "underline",
              },
            })}
          >
            → 注文履歴
          </Link>
          <Link
            to="/cart"
            className={css({
              padding: "16px",
              backgroundColor: "#f8f9fa",
              borderRadius: "4px",
              textDecoration: "none",
              color: "#007185",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#e9ecef",
                textDecoration: "underline",
              },
            })}
          >
            → カート
          </Link>
        </div>
      </div>
    </div>
  );
}
