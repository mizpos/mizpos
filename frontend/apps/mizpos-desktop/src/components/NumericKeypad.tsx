/**
 * タッチパネル向け数字キーパッド
 */

import { useCallback } from "react";
import "./NumericKeypad.css";

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onEnter?: () => void;
  showDecimal?: boolean;
}

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

  return (
    <div className="numeric-keypad">
      {keys.map((row) => (
        <div key={row.rowId} className="keypad-row">
          {row.keys.map((key) => (
            <button
              key={key}
              type="button"
              className={`keypad-key ${key === "backspace" ? "key-backspace" : ""} ${key === "clear" ? "key-clear" : ""} ${key === "." ? "key-decimal" : ""}`}
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
          className="keypad-key key-enter"
          onClick={() => handleKeyPress("enter")}
        >
          確定
        </button>
      )}
    </div>
  );
}
