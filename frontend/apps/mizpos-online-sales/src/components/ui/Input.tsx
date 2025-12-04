import type { InputHTMLAttributes } from "react";
import { css } from "styled-system/css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const inputStyles = css({
  width: "100%",
  padding: "10px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "14px",
  "&:focus": {
    outline: "none",
    borderColor: "#007185",
    boxShadow: "0 0 0 2px rgba(0, 113, 133, 0.2)",
  },
  "&:read-only": {
    backgroundColor: "#f5f5f5",
    cursor: "not-allowed",
  },
});

const labelStyles = css({
  display: "block",
  marginBottom: "8px",
  fontWeight: "bold",
  fontSize: "14px",
});

const errorStyles = css({
  marginTop: "4px",
  fontSize: "12px",
  color: "#d32f2f",
});

const containerStyles = css({
  marginBottom: "16px",
});

export function Input({ label, error, required, ...props }: InputProps) {
  return (
    <div className={containerStyles}>
      <label htmlFor={props.id} className={labelStyles}>
        {label} {required && "*"}
      </label>
      <input className={inputStyles} required={required} {...props} />
      {error && <p className={errorStyles}>{error}</p>}
    </div>
  );
}
