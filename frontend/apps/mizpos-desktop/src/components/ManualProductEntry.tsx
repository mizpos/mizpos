import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { useCartStore } from "../stores/cart";
import type { Product } from "../types";

interface ManualProductEntryProps {
  onClose: () => void;
}

export function ManualProductEntry({ onClose }: ManualProductEntryProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const { addItem } = useCartStore();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "");
    if (value === "" || Number.parseInt(value, 10) <= 1000000) {
      setPrice(value);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
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
  }, [name, price, addItem, onClose]);

  const priceValue = price ? Number.parseInt(price, 10) : 0;
  const isValid = name.trim() && price && priceValue > 0;

  return (
    <div className={css({
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
    })}>
      <div className={css({
        background: "#1e293b",
        borderRadius: "16px",
        width: "100%",
        maxWidth: "440px",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "#f8fafc",
      })}>
        {/* ヘッダー */}
        <div className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 24px",
          borderBottom: "1px solid #334155",
        })}>
          <h2 className={css({ margin: 0, fontSize: "20px", fontWeight: 700 })}>
            手動登録
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={css({
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#334155",
              border: "none",
              borderRadius: "8px",
              color: "#94a3b8",
              fontSize: "20px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { background: "#475569", color: "#f8fafc" },
            })}
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <form onSubmit={handleSubmit} className={css({ padding: "24px" })}>
          {/* 商品名 */}
          <div className={css({ marginBottom: "20px" })}>
            <label className={css({
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "10px",
            })}>
              商品名
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="商品名を入力"
              className={css({
                width: "100%",
                padding: "14px 16px",
                fontSize: "16px",
                color: "#f8fafc",
                background: "#0f172a",
                border: "2px solid #334155",
                borderRadius: "10px",
                outline: "none",
                transition: "border-color 0.15s",
                "&:focus": { borderColor: "#3b82f6" },
                "&::placeholder": { color: "#475569" },
              })}
            />
          </div>

          {/* 価格 */}
          <div className={css({ marginBottom: "24px" })}>
            <label className={css({
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "10px",
            })}>
              価格
            </label>
            <div className={css({ position: "relative" })}>
              <span className={css({
                position: "absolute",
                left: "16px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "20px",
                fontWeight: 600,
                color: "#64748b",
              })}>
                ¥
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={price ? Number.parseInt(price, 10).toLocaleString() : ""}
                onChange={handlePriceChange}
                placeholder="0"
                className={css({
                  width: "100%",
                  padding: "14px 16px 14px 36px",
                  fontSize: "24px",
                  fontWeight: 700,
                  fontFamily: "monospace",
                  textAlign: "right",
                  color: "#f8fafc",
                  background: "#0f172a",
                  border: "2px solid #334155",
                  borderRadius: "10px",
                  outline: "none",
                  transition: "border-color 0.15s",
                  "&:focus": { borderColor: "#3b82f6" },
                  "&::placeholder": { color: "#475569" },
                })}
              />
            </div>
          </div>

          {/* クイック価格ボタン */}
          <div className={css({
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "24px",
          })}>
            {[100, 300, 500, 1000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setPrice(String(amount))}
                className={css({
                  padding: "12px 8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  color: "#f8fafc",
                  background: "#334155",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  "&:hover": { background: "#475569" },
                })}
              >
                ¥{amount}
              </button>
            ))}
          </div>

          {/* 登録ボタン */}
          <button
            type="submit"
            disabled={!isValid}
            className={css({
              width: "100%",
              padding: "18px",
              fontSize: "18px",
              fontWeight: 700,
              color: "#0f172a",
              background: "#22c55e",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover:not(:disabled)": { background: "#16a34a" },
              "&:active:not(:disabled)": { transform: "scale(0.98)" },
              "&:disabled": {
                background: "#334155",
                color: "#64748b",
                cursor: "not-allowed",
              },
            })}
          >
            カートに追加
          </button>
        </form>
      </div>
    </div>
  );
}
