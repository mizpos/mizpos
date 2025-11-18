import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../../contexts/AuthContext";
import { getOrdersByEmail } from "../../lib/api";

export const Route = createFileRoute("/my-orders/")({
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [searchEmail, setSearchEmail] = useState("");

  // ログイン済みの場合は自動的にユーザーのメールアドレスで検索
  useEffect(() => {
    if (user?.email) {
      setSearchEmail(user.email);
      setEmail(user.email);
    }
  }, [user]);

  const {
    data: orders,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["orders", searchEmail],
    queryFn: async () => {
      const ordersList = await getOrdersByEmail(searchEmail);
      // 日時順（新しい順）でソート
      return ordersList.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    },
    enabled: !!searchEmail,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchEmail(email);
  };

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
        注文履歴
      </h1>

      {!user && (
        <div
          className={css({
            padding: "24px",
            backgroundColor: "white",
            borderRadius: "8px",
            border: "1px solid #ddd",
            marginBottom: "30px",
          })}
        >
          <p
            className={css({
              marginBottom: "16px",
              fontSize: "14px",
              color: "#666",
            })}
          >
            ご登録のメールアドレスを入力して注文履歴を確認できます
          </p>
          <form
            onSubmit={handleSearch}
            className={css({ display: "flex", gap: "12px" })}
          >
            <input
              type="email"
              placeholder="メールアドレスを入力"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={css({
                flex: 1,
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                fontSize: "14px",
              })}
            />
            <button
              type="submit"
              className={css({
                padding: "10px 24px",
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
              検索
            </button>
          </form>
        </div>
      )}

      {user && (
        <div
          className={css({
            padding: "16px 24px",
            backgroundColor: "#dff0d8",
            borderRadius: "8px",
            marginBottom: "30px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <p className={css({ fontSize: "14px", color: "#3c763d" })}>
            <strong>{user.email}</strong> の注文履歴を表示しています
          </p>
          <Link
            to="/login"
            className={css({
              fontSize: "14px",
              color: "#3c763d",
              textDecoration: "underline",
              _hover: {
                color: "#2b542c",
              },
            })}
          >
            別のアカウントで確認する
          </Link>
        </div>
      )}

      {isLoading && (
        <div className={css({ padding: "40px", textAlign: "center" })}>
          <p>注文履歴を読み込み中...</p>
        </div>
      )}

      {error && (
        <div
          className={css({
            padding: "20px",
            backgroundColor: "#f8d7da",
            borderRadius: "4px",
            color: "#721c24",
          })}
        >
          <p>注文履歴の読み込みに失敗しました</p>
        </div>
      )}

      {orders && orders.length === 0 && (
        <div
          className={css({
            padding: "40px",
            textAlign: "center",
            color: "#666",
          })}
        >
          <p>注文履歴がありません</p>
        </div>
      )}

      {orders && orders.length > 0 && (
        <div>
          {orders.map((order) => (
            <div
              key={order.order_id || order.sale_id}
              className={css({
                padding: "24px",
                backgroundColor: "white",
                borderRadius: "8px",
                border: "1px solid #ddd",
                marginBottom: "20px",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  marginBottom: "16px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid #ddd",
                })}
              >
                <div>
                  <p
                    className={css({
                      fontSize: "14px",
                      color: "#666",
                      marginBottom: "4px",
                    })}
                  >
                    注文番号: {order.order_id || order.sale_id}
                  </p>
                  <p className={css({ fontSize: "14px", color: "#666" })}>
                    注文日時:{" "}
                    {new Date(order.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
                <div>
                  <span
                    className={css({
                      display: "inline-block",
                      padding: "4px 12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      backgroundColor:
                        order.status === "completed" ||
                        order.status === "shipped"
                          ? "#dff0d8"
                          : order.status === "pending"
                            ? "#fcf8e3"
                            : "#f8d7da",
                      color:
                        order.status === "completed" ||
                        order.status === "shipped"
                          ? "#3c763d"
                          : order.status === "pending"
                            ? "#8a6d3b"
                            : "#721c24",
                    })}
                  >
                    {order.status === "shipped"
                      ? "発送済み"
                      : order.status === "completed"
                        ? "完了"
                        : order.status === "pending"
                          ? "処理中"
                          : order.status === "cancelled"
                            ? "キャンセル"
                            : "返金済み"}
                  </span>
                </div>
              </div>

              <div className={css({ marginBottom: "16px" })}>
                {order.items.map((item, index) => (
                  <div
                    key={`${item.product_id}-${index}`}
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    })}
                  >
                    <div>
                      <p
                        className={css({
                          fontSize: "14px",
                          fontWeight: "bold",
                        })}
                      >
                        {item.product_name}
                      </p>
                      <p className={css({ fontSize: "12px", color: "#666" })}>
                        数量: {item.quantity}
                      </p>
                    </div>
                    <p
                      className={css({ fontSize: "14px", fontWeight: "bold" })}
                    >
                      ¥{item.subtotal.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: "16px",
                  borderTop: "1px solid #ddd",
                })}
              >
                <div>
                  <p className={css({ fontSize: "18px", fontWeight: "bold" })}>
                    合計:{" "}
                    <span className={css({ color: "#e47911" })}>
                      ¥{order.total.toLocaleString()}
                    </span>
                  </p>
                </div>
                <Link
                  to="/order-complete"
                  search={{ order_id: order.order_id || order.sale_id || "" }}
                  className={css({
                    display: "inline-block",
                    padding: "8px 16px",
                    backgroundColor: "#f0c14b",
                    border: "1px solid #a88734",
                    borderRadius: "3px",
                    textDecoration: "none",
                    color: "black",
                    fontSize: "14px",
                    fontWeight: "bold",
                    _hover: {
                      backgroundColor: "#ddb347",
                    },
                  })}
                >
                  詳細を見る
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
