import { css } from "styled-system/css";

interface CartItem {
  product: {
    product_id: string;
    name: string;
    price: number;
    image_url?: string;
  };
  quantity: number;
}

interface OrderSummaryProps {
  items: CartItem[];
  subtotal: number;
}

const containerStyles = css({
  padding: "20px",
  backgroundColor: "#f3f3f3",
  borderRadius: "8px",
  height: "fit-content",
});

const titleStyles = css({
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "16px",
});

const itemContainerStyles = css({
  display: "flex",
  gap: "12px",
  marginBottom: "12px",
  paddingBottom: "12px",
  borderBottom: "1px solid #ddd",
});

const imageContainerStyles = css({
  width: "60px",
  height: "80px",
  backgroundColor: "#fff",
  borderRadius: "4px",
  overflow: "hidden",
  flexShrink: 0,
});

const imageStyles = css({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

const noImageStyles = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#999",
  fontSize: "10px",
});

const itemNameStyles = css({
  fontSize: "14px",
  fontWeight: "bold",
  marginBottom: "4px",
});

const itemQuantityStyles = css({
  fontSize: "12px",
  color: "#666",
});

const itemPriceStyles = css({
  fontSize: "14px",
  fontWeight: "bold",
  color: "#e47911",
});

const summaryRowStyles = css({
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
});

const labelStyles = css({
  fontSize: "14px",
});

const valueStyles = css({
  fontSize: "14px",
  fontWeight: "bold",
});

const totalLabelStyles = css({
  fontSize: "18px",
  fontWeight: "bold",
});

const totalValueStyles = css({
  fontSize: "24px",
  fontWeight: "bold",
  color: "#e47911",
});

export function OrderSummary({ items, subtotal }: OrderSummaryProps) {
  return (
    <div className={containerStyles}>
      <h2 className={titleStyles}>注文内容</h2>

      <div className={css({ marginBottom: "16px" })}>
        {items.map((item) => (
          <div key={item.product.product_id} className={itemContainerStyles}>
            <div className={imageContainerStyles}>
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className={imageStyles}
                />
              ) : (
                <div className={noImageStyles}>No Image</div>
              )}
            </div>
            <div className={css({ flex: 1 })}>
              <p className={itemNameStyles}>{item.product.name}</p>
              <p className={itemQuantityStyles}>数量: {item.quantity}</p>
              <p className={itemPriceStyles}>
                ¥{(item.product.price * item.quantity).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className={css({
          borderTop: "1px solid #ddd",
          paddingTop: "16px",
          marginBottom: "16px",
        })}
      >
        <div className={summaryRowStyles}>
          <span className={labelStyles}>小計:</span>
          <span className={valueStyles}>¥{subtotal.toLocaleString()}</span>
        </div>
        <div className={summaryRowStyles}>
          <span className={labelStyles}>配送料:</span>
          <span className={valueStyles}>¥0</span>
        </div>
      </div>

      <div className={css({ borderTop: "2px solid #ddd", paddingTop: "16px" })}>
        <div className={css({ display: "flex", justifyContent: "space-between" })}>
          <span className={totalLabelStyles}>合計:</span>
          <span className={totalValueStyles}>¥{subtotal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
