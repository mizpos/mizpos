import { IconFingerprint, IconLock, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  deleteWebAuthnCredential,
  listWebAuthnCredentials,
  updatePassword,
} from "aws-amplify/auth";
import { useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../contexts/AuthContext";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user, registerPasskey, isAuthenticated } = useAuth();

  // パスワード変更用の状態
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // パスキー関連の状態
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeySuccess, setPasskeySuccess] = useState(false);

  // パスキー一覧取得
  const {
    data: passkeys,
    isLoading: isLoadingPasskeys,
    refetch: refetchPasskeys,
  } = useQuery({
    queryKey: ["passkeys"],
    queryFn: async () => {
      const result = await listWebAuthnCredentials();
      return result.credentials || [];
    },
    enabled: isAuthenticated,
  });

  // パスワード変更
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
      setPasswordSuccess(true);
      setPasswordError(null);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: Error) => {
      setPasswordSuccess(false);
      if (error.message.includes("Incorrect")) {
        setPasswordError("現在のパスワードが正しくありません");
      } else if (error.message.includes("policy")) {
        setPasswordError(
          "新しいパスワードは大文字・小文字・数字・特殊文字を含む必要があります",
        );
      } else {
        setPasswordError(error.message);
      }
    },
  });

  // パスキー登録
  const passkeyRegisterMutation = useMutation({
    mutationFn: async () => {
      await registerPasskey();
    },
    onSuccess: () => {
      setPasskeySuccess(true);
      setPasskeyError(null);
      refetchPasskeys();
      setTimeout(() => setPasskeySuccess(false), 3000);
    },
    onError: (error: Error) => {
      setPasskeySuccess(false);
      setPasskeyError(error.message);
    },
  });

  // パスキー削除
  const passkeyDeleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await deleteWebAuthnCredential({ credentialId });
    },
    onSuccess: () => {
      refetchPasskeys();
    },
    onError: (error: Error) => {
      setPasskeyError(error.message);
    },
  });

  const handlePasswordChange = () => {
    setPasswordError(null);
    passwordMutation.mutate();
  };

  if (!isAuthenticated) {
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
          ログインが必要です
        </h1>
        <p className={css({ marginBottom: "20px" })}>
          設定を表示するにはログインしてください
        </p>
        <Link
          to="/login"
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
          ログイン
        </Link>
      </div>
    );
  }

  const inputClass = css({
    width: "100%",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #ddd",
    fontSize: "14px",
    _focus: {
      outline: "none",
      borderColor: "#e47911",
      boxShadow: "0 0 0 2px rgba(228, 121, 17, 0.2)",
    },
  });

  const labelClass = css({
    display: "block",
    fontSize: "14px",
    fontWeight: "bold",
    marginBottom: "8px",
  });

  return (
    <div
      className={css({
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <h1
        className={css({
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "8px",
        })}
      >
        アカウント設定
      </h1>
      <p
        className={css({
          fontSize: "14px",
          color: "#666",
          marginBottom: "32px",
        })}
      >
        アカウント情報とセキュリティ設定を管理します
      </p>

      {/* User Info */}
      <div
        className={css({
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginBottom: "24px",
        })}
      >
        <h2
          className={css({
            fontSize: "20px",
            fontWeight: "bold",
            marginBottom: "16px",
          })}
        >
          ユーザー情報
        </h2>
        <div
          className={css({
            backgroundColor: "#f7f7f7",
            padding: "16px",
            borderRadius: "4px",
          })}
        >
          <p className={css({ fontSize: "14px", marginBottom: "8px" })}>
            <strong>メールアドレス:</strong> {user?.email || "不明"}
          </p>
          {user?.name && (
            <p className={css({ fontSize: "14px" })}>
              <strong>名前:</strong> {user.name}
            </p>
          )}
        </div>
      </div>

      {/* Password Change */}
      <div
        className={css({
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginBottom: "24px",
        })}
      >
        <h2
          className={css({
            fontSize: "20px",
            fontWeight: "bold",
            marginBottom: "16px",
          })}
        >
          パスワード変更
        </h2>

        {passwordError && (
          <div
            className={css({
              backgroundColor: "#f8d7da",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              color: "#721c24",
              fontSize: "14px",
            })}
          >
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div
            className={css({
              backgroundColor: "#d4edda",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              color: "#155724",
              fontSize: "14px",
            })}
          >
            パスワードを変更しました
          </div>
        )}

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "16px",
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
            />
            <p
              className={css({
                fontSize: "12px",
                color: "#666",
                marginTop: "4px",
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
            />
          </div>

          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={
              passwordMutation.isPending ||
              !oldPassword ||
              !newPassword ||
              !confirmPassword
            }
            className={css({
              padding: "12px 24px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
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
            <IconLock size={18} />
            {passwordMutation.isPending ? "変更中..." : "パスワードを変更"}
          </button>
        </div>
      </div>

      {/* Passkey Management */}
      <div
        className={css({
          backgroundColor: "white",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #ddd",
        })}
      >
        <h2
          className={css({
            fontSize: "20px",
            fontWeight: "bold",
            marginBottom: "8px",
          })}
        >
          パスキー管理
        </h2>
        <p
          className={css({
            fontSize: "14px",
            color: "#666",
            marginBottom: "16px",
          })}
        >
          パスキーを使用すると、パスワードなしで安全にログインできます
        </p>

        {passkeyError && (
          <div
            className={css({
              backgroundColor: "#f8d7da",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              color: "#721c24",
              fontSize: "14px",
            })}
          >
            {passkeyError}
          </div>
        )}

        {passkeySuccess && (
          <div
            className={css({
              backgroundColor: "#d4edda",
              borderRadius: "4px",
              padding: "12px",
              marginBottom: "16px",
              color: "#155724",
              fontSize: "14px",
            })}
          >
            パスキーを登録しました
          </div>
        )}

        {/* Passkey List */}
        {isLoadingPasskeys ? (
          <div
            className={css({
              textAlign: "center",
              padding: "20px",
              color: "#666",
            })}
          >
            読み込み中...
          </div>
        ) : passkeys && passkeys.length > 0 ? (
          <div className={css({ marginBottom: "16px" })}>
            <h3
              className={css({
                fontSize: "16px",
                fontWeight: "bold",
                marginBottom: "12px",
              })}
            >
              登録済みパスキー
            </h3>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              })}
            >
              {passkeys.map((passkey) => (
                <div
                  key={passkey.credentialId}
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    backgroundColor: "#f7f7f7",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  })}
                >
                  <div>
                    <p
                      className={css({ fontSize: "14px", fontWeight: "bold" })}
                    >
                      {passkey.friendlyCredentialName || "パスキー"}
                    </p>
                    <p className={css({ fontSize: "12px", color: "#666" })}>
                      登録日:{" "}
                      {new Date(passkey.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("このパスキーを削除しますか？")) {
                        passkeyDeleteMutation.mutate(passkey.credentialId);
                      }
                    }}
                    disabled={passkeyDeleteMutation.isPending}
                    className={css({
                      padding: "8px",
                      color: "#c7254e",
                      cursor: "pointer",
                      _hover: { color: "#a01d3a" },
                      _disabled: { color: "#999", cursor: "not-allowed" },
                    })}
                  >
                    <IconTrash size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "16px",
            })}
          >
            登録済みのパスキーはありません
          </p>
        )}

        <button
          type="button"
          onClick={() => passkeyRegisterMutation.mutate()}
          disabled={passkeyRegisterMutation.isPending}
          className={css({
            padding: "12px 24px",
            backgroundColor: "#f0c14b",
            border: "1px solid #a88734",
            borderRadius: "3px",
            fontSize: "14px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
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
          <IconFingerprint size={18} />
          {passkeyRegisterMutation.isPending
            ? "登録中..."
            : "新しいパスキーを登録"}
        </button>
      </div>

      <div className={css({ marginTop: "24px", textAlign: "center" })}>
        <Link
          to="/products"
          className={css({
            color: "#007185",
            textDecoration: "underline",
            fontSize: "14px",
            _hover: {
              color: "#c45500",
            },
          })}
        >
          商品一覧に戻る
        </Link>
      </div>
    </div>
  );
}
