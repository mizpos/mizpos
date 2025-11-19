import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchUserAttributes, updatePassword } from "aws-amplify/auth";
import { useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../../contexts/AuthContext";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // ユーザー属性を取得
  const { data: userAttributes, isLoading } = useQuery({
    queryKey: ["userAttributes"],
    queryFn: fetchUserAttributes,
  });

  // パスワード変更mutation
  const changePasswordMutation = useMutation({
    mutationFn: async ({
      oldPassword,
      newPassword,
    }: {
      oldPassword: string;
      newPassword: string;
    }) => {
      await updatePassword({ oldPassword, newPassword });
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setPasswordData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setTimeout(() => {
        setShowPasswordForm(false);
        setPasswordSuccess(false);
      }, 2000);
    },
    onError: (error: Error) => {
      console.error("Password change error:", error);
      if (error.message.includes("Incorrect")) {
        setPasswordError("現在のパスワードが正しくありません");
      } else if (error.message.includes("password")) {
        setPasswordError(
          "新しいパスワードは8文字以上で、大文字・小文字・数字を含む必要があります",
        );
      } else {
        setPasswordError("パスワードの変更に失敗しました");
      }
      setPasswordSuccess(false);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("新しいパスワードが一致しません");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("新しいパスワードは8文字以上にしてください");
      return;
    }

    changePasswordMutation.mutate({
      oldPassword: passwordData.oldPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (!user) {
    return (
      <div
        className={css({
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "20px",
          })}
        >
          ログインが必要です
        </h1>
        <Link
          to="/login"
          className={css({
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "#f0c14b",
            border: "1px solid #a88734",
            borderRadius: "3px",
            fontSize: "16px",
            fontWeight: "bold",
            color: "#111",
            textDecoration: "none",
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
        アカウント設定
      </h1>

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
          gap: "20px",
        })}
      >
        {/* アカウント情報 */}
        <div
          className={css({
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd",
          })}
        >
          <h2
            className={css({
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "20px",
            })}
          >
            アカウント情報
          </h2>
          {isLoading ? (
            <p>読み込み中...</p>
          ) : (
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              })}
            >
              <div>
                <p
                  className={css({
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#666",
                    marginBottom: "4px",
                  })}
                >
                  ユーザー名
                </p>
                <p className={css({ fontSize: "16px" })}>
                  {userAttributes?.name || "未設定"}
                </p>
              </div>
              <div>
                <p
                  className={css({
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#666",
                    marginBottom: "4px",
                  })}
                >
                  メールアドレス
                </p>
                <p className={css({ fontSize: "16px" })}>
                  {userAttributes?.email || user.email}
                </p>
              </div>
              <div>
                <p
                  className={css({
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#666",
                    marginBottom: "4px",
                  })}
                >
                  ユーザーID
                </p>
                <p
                  className={css({
                    fontSize: "12px",
                    color: "#666",
                    fontFamily: "monospace",
                  })}
                >
                  {userAttributes?.sub || ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* パスワード変更 */}
        <div
          className={css({
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd",
          })}
        >
          <h2
            className={css({
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "20px",
            })}
          >
            パスワード変更
          </h2>

          {!showPasswordForm ? (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className={css({
                padding: "12px 24px",
                backgroundColor: "#f0c14b",
                border: "1px solid #a88734",
                borderRadius: "3px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                _hover: {
                  backgroundColor: "#ddb347",
                },
              })}
            >
              パスワードを変更する
            </button>
          ) : (
            <form onSubmit={handlePasswordSubmit}>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                })}
              >
                {passwordError && (
                  <div
                    className={css({
                      padding: "12px",
                      backgroundColor: "#f8d7da",
                      border: "1px solid #f5c2c7",
                      borderRadius: "4px",
                      color: "#842029",
                      fontSize: "14px",
                    })}
                  >
                    {passwordError}
                  </div>
                )}

                {passwordSuccess && (
                  <div
                    className={css({
                      padding: "12px",
                      backgroundColor: "#d1e7dd",
                      border: "1px solid #badbcc",
                      borderRadius: "4px",
                      color: "#0f5132",
                      fontSize: "14px",
                    })}
                  >
                    パスワードを変更しました
                  </div>
                )}

                <div>
                  <label
                    htmlFor="oldPassword"
                    className={css({
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginBottom: "4px",
                    })}
                  >
                    現在のパスワード
                  </label>
                  <input
                    type="password"
                    id="oldPassword"
                    value={passwordData.oldPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        oldPassword: e.target.value,
                      })
                    }
                    required
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    })}
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className={css({
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginBottom: "4px",
                    })}
                  >
                    新しいパスワード
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        newPassword: e.target.value,
                      })
                    }
                    required
                    minLength={8}
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
                    8文字以上、大文字・小文字・数字を含む
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className={css({
                      display: "block",
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginBottom: "4px",
                    })}
                  >
                    新しいパスワード（確認）
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        confirmPassword: e.target.value,
                      })
                    }
                    required
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    })}
                  />
                </div>

                <div
                  className={css({
                    display: "flex",
                    gap: "12px",
                  })}
                >
                  <button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    className={css({
                      padding: "12px 24px",
                      backgroundColor: "#f0c14b",
                      border: "1px solid #a88734",
                      borderRadius: "3px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: changePasswordMutation.isPending
                        ? "not-allowed"
                        : "pointer",
                      opacity: changePasswordMutation.isPending ? 0.6 : 1,
                      _hover: {
                        backgroundColor: changePasswordMutation.isPending
                          ? "#f0c14b"
                          : "#ddb347",
                      },
                    })}
                  >
                    {changePasswordMutation.isPending
                      ? "変更中..."
                      : "変更する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordError("");
                      setPasswordSuccess(false);
                      setPasswordData({
                        oldPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                    }}
                    className={css({
                      padding: "12px 24px",
                      backgroundColor: "#fff",
                      border: "1px solid #ddd",
                      borderRadius: "3px",
                      fontSize: "14px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      _hover: {
                        backgroundColor: "#f7f7f7",
                      },
                    })}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* 住所管理へのリンク */}
        <div
          className={css({
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd",
          })}
        >
          <h2
            className={css({
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "20px",
            })}
          >
            配送先住所管理
          </h2>
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "16px",
            })}
          >
            登録済みの配送先住所を管理できます
          </p>
          <Link
            to="/my-addresses"
            className={css({
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#111",
              textDecoration: "none",
              _hover: {
                backgroundColor: "#ddb347",
              },
            })}
          >
            住所管理へ
          </Link>
        </div>

        {/* 注文履歴へのリンク */}
        <div
          className={css({
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd",
          })}
        >
          <h2
            className={css({
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "20px",
            })}
          >
            注文履歴
          </h2>
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "16px",
            })}
          >
            過去の注文を確認できます
          </p>
          <Link
            to="/my-orders"
            className={css({
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#f0c14b",
              border: "1px solid #a88734",
              borderRadius: "3px",
              fontSize: "14px",
              fontWeight: "bold",
              color: "#111",
              textDecoration: "none",
              _hover: {
                backgroundColor: "#ddb347",
              },
            })}
          >
            注文履歴へ
          </Link>
        </div>
      </div>

      {/* ログアウト */}
      <div
        className={css({
          marginTop: "40px",
          padding: "24px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #ddd",
          textAlign: "center",
        })}
      >
        <h2
          className={css({
            fontSize: "20px",
            fontWeight: "bold",
            marginBottom: "16px",
          })}
        >
          アカウントからログアウト
        </h2>
        <button
          type="button"
          onClick={handleSignOut}
          className={css({
            padding: "12px 24px",
            backgroundColor: "#dc3545",
            border: "1px solid #dc3545",
            borderRadius: "3px",
            fontSize: "14px",
            fontWeight: "bold",
            color: "white",
            cursor: "pointer",
            _hover: {
              backgroundColor: "#c82333",
            },
          })}
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
