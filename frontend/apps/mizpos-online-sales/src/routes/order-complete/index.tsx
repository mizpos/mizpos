import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { getOrder } from "../../lib/api";

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

  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", order_id],
    queryFn: () => getOrder(order_id),
    enabled: !!order_id,
  });

  if (!order_id) {
    return (
      <div className={css({ maxWidth: "800px", margin: "0 auto", padding: "40px 20px", textAlign: "center" })}>
        <h1 className={css({ fontSize: "32px", fontWeight: "bold", marginBottom: "20px" })}>
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
      <div className={css({ padding: "40px", textAlign: "center", color: "red" })}>
        <p>注文情報の読み込みに失敗しました</p>
      </div>
    );
  }

  return (
    <div className={css({ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" })}>
      <div
        className={css({
          padding: "40px",
          backgroundColor: "#dff0d8",
          borderRadius: "8px",
          marginBottom: "30px",
          textAlign: "center",
        })}
      >
        <h1 className={css({ fontSize: "32px", fontWeight: "bold", marginBottom: "16px", color: "#3c763d" })}>
          ご注文ありがとうございます！
        </h1>
        <p className={css({ fontSize: "16px", color: "#3c763d" })}>
          注文が完了しました。確認メールを {order.customer_email} に送信しました。
        </p>
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
        <h2 className={css({ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" })}>
          注文詳細
        </h2>

        <div className={css({ marginBottom: "16px" })}>
          <p className={css({ fontSize: "14px", color: "#666", marginBottom: "4px" })}>
            注文番号
          </p>
          <p className={css({ fontSize: "16px", fontWeight: "bold" })}>
            {order.order_id || order.sale_id}
          </p>
        </div>

        <div className={css({ marginBottom: "16px" })}>
          <p className={css({ fontSize: "14px", color: "#666", marginBottom: "4px" })}>
            注文日時
          </p>
          <p className={css({ fontSize: "16px", fontWeight: "bold" })}>
            {new Date(order.created_at).toLocaleString("ja-JP")}
          </p>
        </div>

        <div className={css({ marginBottom: "16px" })}>
          <p className={css({ fontSize: "14px", color: "#666", marginBottom: "4px" })}>
            配送先
          </p>
          <p className={css({ fontSize: "16px" })}>
            {order.customer_name}
            <br />
            〒{order.shipping_address?.postal_code}
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

        <div className={css({ borderTop: "1px solid #ddd", paddingTop: "16px", marginTop: "16px" })}>
          <h3 className={css({ fontSize: "18px", fontWeight: "bold", marginBottom: "12px" })}>
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

          <div className={css({ borderTop: "2px solid #ddd", paddingTop: "12px", marginTop: "12px" })}>
            <div className={css({ display: "flex", justifyContent: "space-between", marginBottom: "8px" })}>
              <span className={css({ fontSize: "14px" })}>小計:</span>
              <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥{order.subtotal.toLocaleString()}
              </span>
            </div>
            {order.discount > 0 && (
              <div className={css({ display: "flex", justifyContent: "space-between", marginBottom: "8px", color: "#c7511f" })}>
                <span className={css({ fontSize: "14px" })}>割引:</span>
                <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                  -¥{order.discount.toLocaleString()}
                </span>
              </div>
            )}
            <div className={css({ display: "flex", justifyContent: "space-between" })}>
              <span className={css({ fontSize: "18px", fontWeight: "bold" })}>合計:</span>
              <span className={css({ fontSize: "24px", fontWeight: "bold", color: "#e47911" })}>
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
            _hover: {
              backgroundColor: "#f5f5f5",
            },
          })}
        >
          注文履歴を見る
        </Link>
      </div>
    </div>
  );
}
