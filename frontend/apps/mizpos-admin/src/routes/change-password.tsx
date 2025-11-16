import { IconLock } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { updatePassword } from "aws-amplify/auth";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("新しいパスワードが一致しません");
      }
      if (newPassword.length < 8) {
        throw new Error("パスワードは8文字以上である必要があります");
      }
      await updatePassword({ oldPassword, newPassword });
    },
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(false), 5000);
    },
    onError: (err: Error) => {
      setSuccess(false);
      if (err.message.includes("Incorrect")) {
        setError("現在のパスワードが正しくありません");
      } else if (err.message.includes("policy")) {
        setError(
          "新しいパスワードは大文字・小文字・数字・特殊文字を含む必要があります"
        );
      } else {
        setError(err.message);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    passwordMutation.mutate();
  };

  const inputClass = css({
    width: "100%",
    padding: "3",
    borderRadius: "md",
    border: "1px solid",
    borderColor: "gray.300",
    fontSize: "sm",
    _focus: {
      outline: "none",
      borderColor: "primary.500",
      boxShadow: "0 0 0 1px var(--colors-primary-500)",
    },
  });

  const labelClass = css({
    display: "block",
    fontSize: "sm",
    fontWeight: "medium",
    color: "gray.700",
    marginBottom: "2",
  });

  return (
    <>
      <Header title="パスワード変更" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
        })}
      >
        <div
          className={css({
            width: "100%",
            maxWidth: "500px",
          })}
        >
          {/* Current User Info */}
          <div
            className={css({
              backgroundColor: "gray.50",
              padding: "4",
              borderRadius: "md",
              marginBottom: "6",
            })}
          >
            <p className={css({ fontSize: "sm", color: "gray.600" })}>
              ログイン中:{" "}
              <strong>{user?.email || user?.username || "不明"}</strong>
            </p>
          </div>

          {/* Password Change Form */}
          <div
            className={css({
              backgroundColor: "white",
              padding: "6",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <h2
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                marginBottom: "6",
              })}
            >
              パスワードを変更
            </h2>

            {error && (
              <div
                className={css({
                  backgroundColor: "red.50",
                  border: "1px solid",
                  borderColor: "red.200",
                  borderRadius: "md",
                  padding: "3",
                  marginBottom: "4",
                  color: "red.700",
                  fontSize: "sm",
                })}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className={css({
                  backgroundColor: "green.50",
                  border: "1px solid",
                  borderColor: "green.200",
                  borderRadius: "md",
                  padding: "3",
                  marginBottom: "4",
                  color: "green.700",
                  fontSize: "sm",
                })}
              >
                パスワードを変更しました
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "4",
                })}
              >
                <div>
                  <label htmlFor="oldPassword" className={labelClass}>
                    現在のパスワード
                  </label>
                  <input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newPassword" className={labelClass}>
                    新しいパスワード
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <p
                    className={css({
                      fontSize: "xs",
                      color: "gray.500",
                      marginTop: "1",
                    })}
                  >
                    8文字以上、大文字・小文字・数字・特殊文字を含む必要があります
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    新しいパスワード（確認）
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>

                <div className={css({ marginTop: "2" })}>
                  <Button
                    type="submit"
                    disabled={
                      passwordMutation.isPending ||
                      !oldPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                  >
                    <IconLock size={18} />
                    {passwordMutation.isPending
                      ? "変更中..."
                      : "パスワードを変更"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
