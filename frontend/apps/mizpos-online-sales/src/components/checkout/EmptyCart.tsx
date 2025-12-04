import { css } from "styled-system/css";

const containerStyles = css({
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "40px 20px",
  textAlign: "center",
});

const titleStyles = css({
  fontSize: "32px",
  fontWeight: "bold",
  marginBottom: "20px",
});

const messageStyles = css({
  fontSize: "18px",
  marginBottom: "30px",
  color: "#666",
});

export function EmptyCart() {
  return (
    <div className={containerStyles}>
      <h1 className={titleStyles}>チェックアウト</h1>
      <p className={messageStyles}>カートが空です</p>
    </div>
  );
}
