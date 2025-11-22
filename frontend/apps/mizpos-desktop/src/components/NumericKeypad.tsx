import { useCallback } from "react";
import { css } from "styled-system/css";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onEnter?: () => void;
  showDecimal?: boolean;
}

const styles = {
  keypad: css({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "16px",
    background: "#f5f5f5",
    borderRadius: "12px",
    maxWidth: "320px",
    margin: "0 auto",
  }),
  row: css({
    display: "flex",
    gap: "8px",
    justifyContent: "center",
  }),
  key: css({
    width: "80px",
    height: "80px",
    fontSize: "28px",
    fontWeight: 600,
    border: "none",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#333",
    cursor: "pointer",
    transition: "all 0.15s ease",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    userSelect: "none",
    WebkitTapHighlightColor: "transparent",
    _hover: {
      background: "#e8e8e8",
    },
    _active: {
      transform: "scale(0.95)",
      background: "#d0d0d0",
    },
  }),
  keyBackspace: css({
    background: "#ffd6d6",
    color: "#c00",
    _hover: {
      background: "#ffbcbc",
    },
  }),
  keyClear: css({
    background: "#fff3cd",
    color: "#856404",
    _hover: {
      background: "#ffe9a8",
    },
  }),
  keyDecimal: css({
    fontSize: "32px",
  }),
  keyEnter: css({
    width: "100%",
    height: "60px",
    marginTop: "8px",
    background: "#4caf50",
    color: "white",
    fontSize: "20px",
    _hover: {
      background: "#43a047",
    },
    _active: {
      background: "#388e3c",
    },
  }),
};

export function NumericKeypad({
  value,
  onChange,
  maxLength = 8,
  onEnter,
  showDecimal = false,
}: NumericKeypadProps) {
  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === "backspace") {
        onChange(value.slice(0, -1));
      } else if (key === "clear") {
        onChange("");
      } else if (key === "enter") {
        onEnter?.();
      } else if (key === ".") {
        // 小数点は1回だけ
        if (!value.includes(".")) {
          onChange(value + key);
        }
      } else {
        // 数字
        if (value.length < maxLength) {
          onChange(value + key);
        }
      }
    },
    [value, onChange, maxLength, onEnter],
  );

  const keys: Array<{ rowId: string; keys: string[] }> = [
    { rowId: "row-123", keys: ["1", "2", "3"] },
    { rowId: "row-456", keys: ["4", "5", "6"] },
    { rowId: "row-789", keys: ["7", "8", "9"] },
    { rowId: "row-0", keys: [showDecimal ? "." : "clear", "0", "backspace"] },
  ];

  const getKeyClass = (key: string) => {
    const classes = [styles.key];
    if (key === "backspace") classes.push(styles.keyBackspace);
    if (key === "clear") classes.push(styles.keyClear);
    if (key === ".") classes.push(styles.keyDecimal);
    return classes.join(" ");
  };

  return (
    <div className={styles.keypad}>
      {keys.map((row) => (
        <div key={row.rowId} className={styles.row}>
          {row.keys.map((key) => (
            <button
              key={key}
              type="button"
              className={getKeyClass(key)}
              onClick={() => handleKeyPress(key)}
            >
              {key === "backspace" ? "⌫" : key === "clear" ? "C" : key}
            </button>
          ))}
        </div>
      ))}
      {onEnter && (
        <button
          type="button"
          className={`${styles.key} ${styles.keyEnter}`}
          onClick={() => handleKeyPress("enter")}
        >
          確定
        </button>
      )}
    </div>
  );
}
