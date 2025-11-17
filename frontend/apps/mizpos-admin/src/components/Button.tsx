import type { ReactNode } from "react";
import { css, cva } from "styled-system/css";

const buttonStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "2",
    borderRadius: "md",
    fontWeight: "medium",
    transition: "all 0.2s",
    cursor: "pointer",
    border: "none",
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  variants: {
    variant: {
      primary: {
        backgroundColor: "primary.600",
        color: "white",
        _hover: {
          backgroundColor: "primary.700",
        },
      },
      secondary: {
        backgroundColor: "gray.200",
        color: "gray.900",
        _hover: {
          backgroundColor: "gray.300",
        },
      },
      danger: {
        backgroundColor: "error",
        color: "white",
        _hover: {
          opacity: 0.9,
        },
      },
      ghost: {
        backgroundColor: "transparent",
        color: "gray.700",
        _hover: {
          backgroundColor: "gray.100",
        },
      },
    },
    size: {
      sm: {
        fontSize: "sm",
        paddingX: "3",
        paddingY: "1.5",
      },
      md: {
        fontSize: "sm",
        paddingX: "4",
        paddingY: "2",
      },
      lg: {
        fontSize: "base",
        paddingX: "6",
        paddingY: "3",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className,
  ...props
}: ButtonProps) {
  const baseClassName = css(buttonStyles.raw({ variant, size }));
  const combinedClassName = className
    ? `${baseClassName} ${className}`
    : baseClassName;

  return (
    <button type="button" className={combinedClassName} {...props}>
      {children}
    </button>
  );
}
