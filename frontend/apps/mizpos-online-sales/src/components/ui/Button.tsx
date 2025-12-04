import type { ButtonHTMLAttributes } from "react";
import { css, cva } from "styled-system/css";

const buttonStyles = cva({
  base: {
    padding: "12px 20px",
    borderRadius: "4px",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },
  variants: {
    variant: {
      primary: {
        backgroundColor: "#f0c14b",
        border: "1px solid #a88734",
        color: "#111",
        "&:hover:not(:disabled)": {
          backgroundColor: "#ddb347",
        },
      },
      secondary: {
        backgroundColor: "#fff",
        border: "1px solid #ddd",
        color: "#111",
        "&:hover:not(:disabled)": {
          backgroundColor: "#f5f5f5",
        },
      },
      link: {
        backgroundColor: "transparent",
        border: "none",
        color: "#007185",
        padding: "0",
        textDecoration: "underline",
        "&:hover:not(:disabled)": {
          color: "#c7511f",
        },
      },
      danger: {
        backgroundColor: "#d32f2f",
        border: "1px solid #c62828",
        color: "#fff",
        "&:hover:not(:disabled)": {
          backgroundColor: "#c62828",
        },
      },
    },
    size: {
      sm: {
        padding: "8px 16px",
        fontSize: "12px",
      },
      md: {
        padding: "12px 20px",
        fontSize: "14px",
      },
      lg: {
        padding: "14px 24px",
        fontSize: "16px",
      },
    },
    fullWidth: {
      true: {
        width: "100%",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "link" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${buttonStyles({ variant, size, fullWidth })} ${className || ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
