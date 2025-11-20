import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../../contexts/AuthContext";

export const Route = createFileRoute("/login/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signInWithHostedUI, isAuthenticated } = useAuth();

  // 既にログイン済みならリダイレクト
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    await signInWithHostedUI();
  };

  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "gray.100",
        padding: "4",
      })}
    >
      <div
        className={css({
          backgroundColor: "white",
          padding: "8",
          borderRadius: "lg",
          boxShadow: "lg",
          width: "100%",
          maxWidth: "md",
        })}
      >
        <div className={css({ textAlign: "center", marginBottom: "8" })}>
          <h1
            className={css({
              fontSize: "3xl",
              fontWeight: "bold",
              color: "gray.900",
              marginBottom: "2",
            })}
          >
            MizPOS Online Sales
          </h1>
          <p className={css({ color: "gray.600", fontSize: "md" })}>
            オンラインストアにログイン
          </p>
        </div>

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "6",
          })}
        >
          <div
            className={css({
              padding: "4",
              backgroundColor: "blue.50",
              borderRadius: "md",
              border: "1px solid",
              borderColor: "blue.200",
            })}
          >
            <p className={css({ color: "blue.700", fontSize: "sm" })}>
              安全なログインのため、Cognitoのホストされた認証画面を使用しています。
              <br />
              パスキー・パスワードでのログインに対応しています。
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className={css({
              width: "100%",
              padding: "12px 24px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              _hover: {
                backgroundColor: "#ddb347",
              },
            })}
          >
            ログインページへ
          </button>

          <p
            className={css({
              textAlign: "center",
              fontSize: "14px",
              color: "#666",
            })}
          >
            ※
            会員登録は任意です。注文時にメールアドレスを入力すれば購入できます。
          </p>

          <Link
            to="/products"
            className={css({
              display: "block",
              textAlign: "center",
              color: "#007185",
              textDecoration: "underline",
              fontSize: "14px",
              _hover: {
                color: "#c45500",
              },
            })}
          >
            ログインせずに商品を見る
          </Link>
        </div>
      </div>
    </div>
  );
}
