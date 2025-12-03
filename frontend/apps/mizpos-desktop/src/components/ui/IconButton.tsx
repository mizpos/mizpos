import { forwardRef } from "react";
import { css, cva, type RecipeVariantProps } from "styled-system/css";

const iconButtonStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    cursor: "pointer",
    transition: "all 0.15s ease",
    userSelect: "none",
    fontFamily: "inherit",
    flexShrink: 0,
    _disabled: {
      cursor: "not-allowed",
      opacity: 0.5,
    },
    _active: {
      transform: "scale(0.95)",
    },
  },
  variants: {
    variant: {
      default: {
        color: "#f8fafc",
        background: "#334155",
        _hover: { background: "#475569" },
      },
      danger: {
        color: "#fecaca",
        background: "#7f1d1d",
        _hover: { background: "#991b1b" },
      },
      ghost: {
        color: "#94a3b8",
        background: "transparent",
        _hover: { background: "#334155", color: "#f8fafc" },
      },
      success: {
        color: "#bbf7d0",
        background: "#166534",
        _hover: { background: "#15803d" },
      },
    },
    size: {
      sm: {
        width: "32px",
        height: "32px",
        fontSize: "16px",
        borderRadius: "6px",
      },
      md: {
        width: "40px",
        height: "40px",
        fontSize: "18px",
        borderRadius: "8px",
      },
      lg: {
        width: "48px",
        height: "48px",
        fontSize: "22px",
        borderRadius: "10px",
      },
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

type IconButtonStyleProps = RecipeVariantProps<typeof iconButtonStyles>;

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    IconButtonStyleProps {
  children: React.ReactNode;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant, size, label, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        className={css(iconButtonStyles.raw({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
