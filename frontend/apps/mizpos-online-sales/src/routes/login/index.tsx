import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../../contexts/AuthContext";

export const Route = createFileRoute("/login/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp, confirmSignUp, user, isLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "confirm">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className={css({ padding: "40px", textAlign: "center" })}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div
        className={css({
          maxWidth: "600px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "20px",
          })}
        >
          ログイン済み
        </h1>
        <p className={css({ marginBottom: "20px" })}>
          {user.email} としてログインしています
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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "ログインに失敗しました";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await signUp(email, password, name);
      setMode("confirm");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "サインアップに失敗しました";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await confirmSignUp(email, confirmationCode);
      await signIn(email, password);
      navigate({ to: "/" });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "確認に失敗しました";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={css({
        maxWidth: "500px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <div
        className={css({
          padding: "32px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #ddd",
        })}
      >
        <h1
          className={css({
            fontSize: "28px",
            fontWeight: "bold",
            marginBottom: "24px",
            textAlign: "center",
          })}
        >
          {mode === "signin"
            ? "ログイン"
            : mode === "signup"
              ? "新規登録"
              : "確認コード入力"}
        </h1>

        {error && (
          <div
            className={css({
              padding: "12px",
              marginBottom: "16px",
              backgroundColor: "#f8d7da",
              borderRadius: "4px",
              color: "#721c24",
              fontSize: "14px",
            })}
          >
            {error}
          </div>
        )}

        {mode === "signin" && (
          <form onSubmit={handleSignIn}>
            <div className={css({ marginBottom: "16px" })}>
              <label
                htmlFor="email"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
            </div>

            <div className={css({ marginBottom: "24px" })}>
              <label
                htmlFor="password"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                パスワード
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "16px",
                _hover: {
                  backgroundColor: "#ddb347",
                },
                _disabled: {
                  backgroundColor: "#ddd",
                  cursor: "not-allowed",
                },
              })}
            >
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </button>

            <button
              type="button"
              onClick={() => setMode("signup")}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "3px",
                fontSize: "14px",
                cursor: "pointer",
                _hover: {
                  backgroundColor: "#f5f5f5",
                },
              })}
            >
              新規登録はこちら
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp}>
            <div className={css({ marginBottom: "16px" })}>
              <label
                htmlFor="name"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                お名前
              </label>
              <input
                type="text"
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
            </div>

            <div className={css({ marginBottom: "16px" })}>
              <label
                htmlFor="email"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
            </div>

            <div className={css({ marginBottom: "24px" })}>
              <label
                htmlFor="password"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                パスワード
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
              <p
                className={css({
                  fontSize: "12px",
                  color: "#666",
                  marginTop: "4px",
                })}
              >
                8文字以上、大文字・小文字・数字・記号を含む
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "16px",
                _hover: {
                  backgroundColor: "#ddb347",
                },
                _disabled: {
                  backgroundColor: "#ddd",
                  cursor: "not-allowed",
                },
              })}
            >
              {isSubmitting ? "登録中..." : "新規登録"}
            </button>

            <button
              type="button"
              onClick={() => setMode("signin")}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "3px",
                fontSize: "14px",
                cursor: "pointer",
                _hover: {
                  backgroundColor: "#f5f5f5",
                },
              })}
            >
              ログインはこちら
            </button>
          </form>
        )}

        {mode === "confirm" && (
          <form onSubmit={handleConfirm}>
            <p
              className={css({
                fontSize: "14px",
                marginBottom: "16px",
                color: "#666",
              })}
            >
              {email} に確認コードを送信しました。メールをご確認ください。
            </p>

            <div className={css({ marginBottom: "24px" })}>
              <label
                htmlFor="code"
                className={css({
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                })}
              >
                確認コード
              </label>
              <input
                type="text"
                id="code"
                required
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                })}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={css({
                width: "100%",
                padding: "12px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: "pointer",
                _hover: {
                  backgroundColor: "#ddb347",
                },
                _disabled: {
                  backgroundColor: "#ddd",
                  cursor: "not-allowed",
                },
              })}
            >
              {isSubmitting ? "確認中..." : "確認"}
            </button>
          </form>
        )}
      </div>

      <p
        className={css({
          marginTop: "20px",
          textAlign: "center",
          fontSize: "14px",
          color: "#666",
        })}
      >
        ※ 会員登録は任意です。注文時にメールアドレスを入力すれば購入できます。
      </p>
    </div>
  );
}
