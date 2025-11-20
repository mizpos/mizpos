import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { confirmSignIn } from "aws-amplify/auth";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInWithWebAuthn, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);

  // 既にログイン済みならリダイレクト
  if (isAuthenticated) {
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.isSignedIn) {
        navigate({ to: "/" });
      } else if (
        result.nextStep?.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        setRequiresNewPassword(true);
      } else {
        setError(
          `追加のステップが必要です: ${result.nextStep?.signInStep || "不明"}`,
        );
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("ログインに失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email) {
      setError("パスキーログインにはメールアドレスが必要です");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await signInWithWebAuthn(email);
      if (result.isSignedIn) {
        navigate({ to: "/" });
      } else {
        setError(
          `パスキーログインに失敗しました: ${result.nextStep?.signInStep || "不明"}`,
        );
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("パスキーログインに失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmNewPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (newPassword.length < 8) {
      setError("パスワードは8文字以上である必要があります");
      return;
    }

    setIsLoading(true);

    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      if (result.isSignedIn) {
        navigate({ to: "/" });
      } else {
        setError("パスワードの設定に失敗しました");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("パスワードの設定に失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
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
        <div className={css({ textAlign: "center", marginBottom: "6" })}>
          <h1
            className={css({
              fontSize: "2xl",
              fontWeight: "bold",
              color: "gray.900",
              marginBottom: "2",
            })}
          >
            MizPOS Admin
          </h1>
          <p className={css({ color: "gray.600", fontSize: "sm" })}>
            {requiresNewPassword
              ? "新しいパスワードを設定してください"
              : "管理システムにログイン"}
          </p>
        </div>

        {error && (
          <div
            className={css({
              backgroundColor: "red.50",
              border: "1px solid",
              borderColor: "red.200",
              color: "red.700",
              padding: "3",
              borderRadius: "md",
              marginBottom: "4",
              fontSize: "sm",
            })}
          >
            {error}
          </div>
        )}

        {requiresNewPassword ? (
          <form onSubmit={handleNewPasswordSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label
                  htmlFor="newPassword"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  新しいパスワード
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={css({
                    width: "100%",
                    padding: "3",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                    },
                  })}
                  placeholder="8文字以上"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  新しいパスワード（確認）
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className={css({
                    width: "100%",
                    padding: "3",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                    },
                  })}
                  placeholder="パスワードを再入力"
                />
              </div>

              <Button type="submit" disabled={isLoading} size="lg">
                {isLoading ? "設定中..." : "パスワードを設定"}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label
                  htmlFor="email"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={css({
                    width: "100%",
                    padding: "3",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                    },
                  })}
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  パスワード
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={css({
                    width: "100%",
                    padding: "3",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                    },
                  })}
                  placeholder="••••••••"
                />
              </div>

              <Button type="submit" disabled={isLoading} size="lg">
                {isLoading ? "ログイン中..." : "ログイン"}
              </Button>

              <div
                className={css({
                  position: "relative",
                  textAlign: "center",
                  marginY: "4",
                })}
              >
                <div
                  className={css({
                    position: "absolute",
                    left: "0",
                    right: "0",
                    top: "50%",
                    borderTop: "1px solid",
                    borderColor: "gray.300",
                  })}
                />
                <span
                  className={css({
                    position: "relative",
                    backgroundColor: "white",
                    paddingX: "2",
                    color: "gray.500",
                    fontSize: "sm",
                  })}
                >
                  または
                </span>
              </div>

              <Button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={isLoading}
                size="lg"
                variant="secondary"
              >
                {isLoading ? "認証中..." : "パスキーでログイン"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
