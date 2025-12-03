import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { useCartStore } from "../stores/cart";
import type { Product } from "../types";
import { Button, Input, Modal } from "./ui";

interface ManualProductEntryProps {
  onClose: () => void;
}

// スタイル定義
const priceInputStyles = {
  wrapper: css({
    position: "relative",
  }),
  prefix: css({
    position: "absolute",
    left: "16px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "20px",
    fontWeight: 600,
    color: "#64748b",
    pointerEvents: "none",
  }),
  input: css({
    width: "100%",
    padding: "16px 16px 16px 36px",
    fontSize: "26px",
    fontWeight: 700,
    fontFamily: "monospace",
    textAlign: "right",
    color: "#f8fafc",
    background: "#0f172a",
    border: "2px solid #334155",
    borderRadius: "12px",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    _focus: {
      borderColor: "#3b82f6",
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
    },
    _placeholder: { color: "#475569" },
  }),
};

const quickPriceStyles = {
  grid: css({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    marginBottom: "24px",
  }),
  button: css({
    padding: "14px 8px",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
    background: "#334155",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: { background: "#475569" },
    _active: { transform: "scale(0.97)" },
  }),
};

const fieldStyles = {
  container: css({
    marginBottom: "20px",
  }),
  containerLast: css({
    marginBottom: "24px",
  }),
};

export function ManualProductEntry({ onClose }: ManualProductEntryProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      if (value === "" || Number.parseInt(value, 10) <= 1000000) {
        setPrice(value);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !price) return;

      const product: Product = {
        id: `manual-${Date.now()}`,
        jan: "",
        name: name.trim(),
        price: Number.parseInt(price, 10),
      };

      addItem(product);
      onClose();
    },
    [name, price, addItem, onClose],
  );

  const priceValue = price ? Number.parseInt(price, 10) : 0;
  const isValid = name.trim() && price && priceValue > 0;

  const quickPrices = [100, 300, 500, 1000];

  return (
    <Modal open onClose={onClose} title="手動登録" maxWidth="460px">
      <form onSubmit={handleSubmit}>
        {/* 商品名 */}
        <div className={fieldStyles.container}>
          <Input
            ref={nameRef}
            label="商品名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="商品名を入力"
          />
        </div>

        {/* 価格 */}
        <div className={fieldStyles.containerLast}>
          <label
            className={css({
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "8px",
            })}
          >
            価格
          </label>
          <div className={priceInputStyles.wrapper}>
            <span className={priceInputStyles.prefix}>¥</span>
            <input
              type="text"
              inputMode="numeric"
              value={price ? Number.parseInt(price, 10).toLocaleString() : ""}
              onChange={handlePriceChange}
              placeholder="0"
              className={priceInputStyles.input}
            />
          </div>
        </div>

        {/* クイック価格ボタン */}
        <div className={quickPriceStyles.grid}>
          {quickPrices.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setPrice(String(amount))}
              className={quickPriceStyles.button}
            >
              ¥{amount.toLocaleString()}
            </button>
          ))}
        </div>

        {/* 登録ボタン */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={!isValid}
        >
          カートに追加
        </Button>
      </form>
    </Modal>
  );
}
