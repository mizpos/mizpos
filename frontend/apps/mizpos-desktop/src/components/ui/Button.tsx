import { forwardRef } from "react";
import { css, cva, type RecipeVariantProps } from "styled-system/css";

const buttonStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.5,
    },
    _active: {
      transform: "scale(0.98)",
    },
  },
  variants: {
    variant: {
      primary: {
        color: "#0f172a",
        background: "#22c55e",
        _hover: { background: "#16a34a" },
        _disabled: { background: "#334155", color: "#64748b" },
      },
      secondary: {
        color: "#f8fafc",
        background: "#3b82f6",
        _hover: { background: "#2563eb" },
        _disabled: { background: "#334155", color: "#64748b" },
      },
      danger: {
        color: "#fecaca",
        background: "#7f1d1d",
        _hover: { background: "#991b1b" },
        _disabled: { background: "#334155", color: "#64748b" },
      },
      ghost: {
        color: "#94a3b8",
        background: "transparent",
        _hover: { background: "#334155", color: "#f8fafc" },
      },
      outline: {
        color: "#94a3b8",
        background: "transparent",
        border: "1px solid #475569",
        _hover: { background: "#334155", color: "#f8fafc" },
      },
      outlineDanger: {
        color: "#f87171",
        background: "transparent",
        border: "2px solid #7f1d1d",
        _hover: { background: "#7f1d1d", color: "#fecaca" },
      },
    },
    size: {
      sm: {
        padding: "8px 12px",
        fontSize: "13px",
        borderRadius: "6px",
        gap: "6px",
      },
      md: {
        padding: "12px 20px",
        fontSize: "15px",
        borderRadius: "8px",
        gap: "8px",
      },
      lg: {
        padding: "16px 24px",
        fontSize: "17px",
        borderRadius: "10px",
        gap: "10px",
      },
      xl: {
        padding: "20px 32px",
        fontSize: "20px",
        borderRadius: "12px",
        gap: "12px",
      },
    },
    fullWidth: {
      true: { width: "100%" },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonStyleProps = RecipeVariantProps<typeof buttonStyles>;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleProps {
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, fullWidth, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={css(
          buttonStyles.raw({ variant, size, fullWidth }),
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
