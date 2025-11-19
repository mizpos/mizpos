import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import {
  getOrder,
  getOrderPaymentStatus,
  getOrderReceipt,
} from "../../lib/api";

export const Route = createFileRoute("/order-complete/")({
  component: OrderCompletePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      order_id: (search.order_id as string) || "",
    };
  },
});

function OrderCompletePage() {
  const { order_id } = Route.useSearch();

  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["order", order_id],
    queryFn: () => getOrder(order_id),
    enabled: !!order_id,
  });

  const { data: paymentStatus, isLoading: isLoadingPayment } = useQuery({
    queryKey: ["payment-status", order_id],
    queryFn: () => getOrderPaymentStatus(order_id),
    enabled: !!order_id,
    refetchInterval: (query) => {
      const data = query.state.data;
      // succeeded または failed になるまで5秒ごとにポーリング
      if (
        data &&
        (data.payment_status === "succeeded" ||
          data.payment_status === "canceled" ||
          data.payment_status === "failed")
      ) {
        return false; // ポーリング停止
      }
      return 5000; // 5秒ごと
    },
  });

  // 領収書URLを取得
  const { data: receiptData } = useQuery({
    queryKey: ["receipt", order_id],
    queryFn: () => getOrderReceipt(order_id),
    enabled: !!order_id && paymentStatus?.payment_status === "succeeded",
    retry: false, // 領収書がない場合はリトライしない
  });

  if (!order_id) {
    return (
      <div
        className={css({
          maxWidth: "800px",
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
          注文情報が見つかりません
        </h1>
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

  if (isLoading) {
    return (
      <div className={css({ padding: "40px", textAlign: "center" })}>
        <p>注文情報を読み込み中...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        className={css({ padding: "40px", textAlign: "center", color: "red" })}
      >
        <p>注文情報の読み込みに失敗しました</p>
      </div>
    );
  }

  // PaymentIntentステータスに応じたメッセージ
  const getStatusMessage = () => {
    if (isLoadingPayment) {
      return {
        bgColor: "#d9edf7",
        textColor: "#31708f",
        title: "決済処理中...",
        message: "決済を確認しています。少々お待ちください。",
      };
    }

    if (
      !paymentStatus ||
      paymentStatus.payment_status === "processing" ||
      paymentStatus.payment_status === "requires_capture"
    ) {
      return {
        bgColor: "#d9edf7",
        textColor: "#31708f",
        title: "決済処理中...",
        message: "決済を確認しています。少々お待ちください。",
      };
    }

    if (paymentStatus.payment_status === "succeeded") {
      return {
        bgColor: "#dff0d8",
        textColor: "#3c763d",
        title: "ご注文ありがとうございます！",
        message: `注文が完了しました。確認メールを ${order.customer_email} に送信しました。`,
      };
    }

    if (
      paymentStatus.payment_status === "canceled" ||
      paymentStatus.payment_status === "failed"
    ) {
      return {
        bgColor: "#f2dede",
        textColor: "#a94442",
        title: "決済に失敗しました",
        message:
          "申し訳ございません。決済処理に失敗しました。再度お試しいただくか、別の支払い方法をお試しください。",
      };
    }

    return {
      bgColor: "#d9edf7",
      textColor: "#31708f",
      title: "決済を確認中",
      message: "決済の確認を行っています。しばらくお待ちください。",
    };
  };

  const statusMessage = getStatusMessage();

  return (
    <div
      className={css({
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <div
        className={css({
          padding: "40px",
          backgroundColor: statusMessage.bgColor,
          borderRadius: "8px",
          marginBottom: "30px",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "16px",
            color: statusMessage.textColor,
          })}
        >
          {statusMessage.title}
        </h1>
        <p
          className={css({ fontSize: "16px", color: statusMessage.textColor })}
        >
          {statusMessage.message}
        </p>
        {paymentStatus?.payment_status &&
          paymentStatus.payment_status !== "succeeded" && (
            <p
              className={css({
                fontSize: "14px",
                color: statusMessage.textColor,
                marginTop: "12px",
              })}
            >
              決済ステータス: {paymentStatus.payment_status}
            </p>
          )}
      </div>

      <div
        className={css({
          padding: "24px",
          backgroundColor: "white",
          borderRadius: "8px",
          border: "1px solid #ddd",
          marginBottom: "20px",
        })}
      >
        <h2
          className={css({
            fontSize: "24px",
            fontWeight: "bold",
            marginBottom: "20px",
          })}
        >
          注文詳細
        </h2>

        <div className={css({ marginBottom: "16px" })}>
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "4px",
            })}
          >
            注文番号
          </p>
          <p className={css({ fontSize: "16px", fontWeight: "bold" })}>
            {order.order_id || order.sale_id}
          </p>
        </div>

        <div className={css({ marginBottom: "16px" })}>
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "4px",
            })}
          >
            注文日時
          </p>
          <p className={css({ fontSize: "16px", fontWeight: "bold" })}>
            {new Date(order.created_at).toLocaleString("ja-JP")}
          </p>
        </div>

        <div className={css({ marginBottom: "16px" })}>
          <p
            className={css({
              fontSize: "14px",
              color: "#666",
              marginBottom: "4px",
            })}
          >
            配送先
          </p>
          <p className={css({ fontSize: "16px" })}>
            {order.customer_name}
            <br />〒{order.shipping_address?.postal_code}
            <br />
            {order.shipping_address?.prefecture} {order.shipping_address?.city}
            <br />
            {order.shipping_address?.address_line1}
            {order.shipping_address?.address_line2 && (
              <>
                <br />
                {order.shipping_address.address_line2}
              </>
            )}
          </p>
        </div>

        {/* 配送追跡情報 */}
        {order.status === "shipped" && order.tracking_number && (
          <div className={css({ marginBottom: "16px" })}>
            <p
              className={css({
                fontSize: "14px",
                color: "#666",
                marginBottom: "4px",
              })}
            >
              配送状況
            </p>
            <div
              className={css({
                backgroundColor: "#f0f8ff",
                padding: "12px",
                borderRadius: "4px",
                marginBottom: "12px",
              })}
            >
              {order.carrier && (
                <p className={css({ fontSize: "14px", marginBottom: "4px" })}>
                  <strong>配送業者:</strong> {order.carrier}
                </p>
              )}
              <p className={css({ fontSize: "14px", marginBottom: "8px" })}>
                <strong>追跡番号:</strong> {order.tracking_number}
              </p>
              {order.shipped_at && (
                <p className={css({ fontSize: "12px", color: "#666" })}>
                  発送登録日:{" "}
                  {new Date(order.shipped_at).toLocaleString("ja-JP")}
                </p>
              )}
            </div>
            {/* 17track iframe */}
            <iframe
              src={`https://t.17track.net/ja#nums=${order.tracking_number}`}
              style={{
                width: "100%",
                height: "400px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
              title="配送追跡情報"
            />
          </div>
        )}

        <div
          className={css({
            borderTop: "1px solid #ddd",
            paddingTop: "16px",
            marginTop: "16px",
          })}
        >
          <h3
            className={css({
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "12px",
            })}
          >
            注文商品
          </h3>
          {order.items.map((item) => (
            <div
              key={item.product_id}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
                paddingBottom: "8px",
                borderBottom: "1px solid #eee",
              })}
            >
              <div>
                <p className={css({ fontSize: "14px", fontWeight: "bold" })}>
                  {item.product_name}
                </p>
                <p className={css({ fontSize: "12px", color: "#666" })}>
                  数量: {item.quantity}
                </p>
              </div>
              <p className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥{item.subtotal.toLocaleString()}
              </p>
            </div>
          ))}

          <div
            className={css({
              borderTop: "2px solid #ddd",
              paddingTop: "12px",
              marginTop: "12px",
            })}
          >
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              })}
            >
              <span className={css({ fontSize: "14px" })}>小計:</span>
              <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥{order.subtotal.toLocaleString()}
              </span>
            </div>
            {order.discount > 0 && (
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "8px",
                  color: "#c7511f",
                })}
              >
                <span className={css({ fontSize: "14px" })}>割引:</span>
                <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                  -¥{order.discount.toLocaleString()}
                </span>
              </div>
            )}
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
              })}
            >
              <span className={css({ fontSize: "18px", fontWeight: "bold" })}>
                合計:
              </span>
              <span
                className={css({
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#e47911",
                })}
              >
                ¥{order.total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={css({ textAlign: "center" })}>
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
            marginRight: "12px",
            _hover: {
              backgroundColor: "#ddb347",
            },
          })}
        >
          買い物を続ける
        </Link>
        <Link
          to="/my-orders"
          className={css({
            display: "inline-block",
            padding: "12px 24px",
            backgroundColor: "white",
            border: "1px solid #ddd",
            borderRadius: "3px",
            textDecoration: "none",
            color: "black",
            fontWeight: "bold",
            marginRight: "12px",
            _hover: {
              backgroundColor: "#f5f5f5",
            },
          })}
        >
          注文履歴を見る
        </Link>
        {receiptData?.receipt_url && (
          <a
            href={receiptData.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className={css({
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#0066c0",
              border: "1px solid #004d99",
              borderRadius: "3px",
              textDecoration: "none",
              color: "white",
              fontWeight: "bold",
              _hover: {
                backgroundColor: "#005299",
              },
            })}
          >
            領収書を表示
          </a>
        )}
      </div>
    </div>
  );
}
