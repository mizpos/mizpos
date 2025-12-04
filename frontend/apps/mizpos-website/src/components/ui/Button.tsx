import { css, cva } from "../../../styled-system/css";
import type { ReactNode, ButtonHTMLAttributes } from "react";

const buttonStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    fontWeight: "600",
    borderRadius: "button",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textDecoration: "none",
    border: "none",
    outline: "none",
    _disabled: {
      opacity: 0.5,
      cursor: "not-allowed",
    },
    _focus: {
      boxShadow: "0 0 0 3px rgba(99, 102, 241, 0.3)",
    },
  },
  variants: {
    variant: {
      primary: {
        bg: "primary.600",
        color: "white",
        _hover: {
          bg: "primary.700",
          transform: "translateY(-1px)",
        },
        _active: {
          bg: "primary.800",
          transform: "translateY(0)",
        },
      },
      secondary: {
        bg: "white",
        color: "primary.600",
        border: "2px solid",
        borderColor: "primary.600",
        _hover: {
          bg: "primary.50",
          transform: "translateY(-1px)",
        },
        _active: {
          bg: "primary.100",
          transform: "translateY(0)",
        },
      },
      ghost: {
        bg: "transparent",
        color: "gray.700",
        _hover: {
          bg: "gray.100",
        },
        _active: {
          bg: "gray.200",
        },
      },
      accent: {
        bg: "accent.500",
        color: "white",
        _hover: {
          bg: "accent.600",
          transform: "translateY(-1px)",
        },
        _active: {
          bg: "accent.700",
          transform: "translateY(0)",
        },
      },
    },
    size: {
      sm: {
        fontSize: "0.875rem",
        paddingX: "1rem",
        paddingY: "0.5rem",
      },
      md: {
        fontSize: "1rem",
        paddingX: "1.5rem",
        paddingY: "0.75rem",
      },
      lg: {
        fontSize: "1.125rem",
        paddingX: "2rem",
        paddingY: "1rem",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  as?: "button" | "a";
  href?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  as = "button",
  href,
  className,
  ...props
}: ButtonProps) {
  const styles = buttonStyles({ variant, size });

  if (as === "a" && href) {
    return (
      <a href={href} className={css(styles, className)}>
        {children}
      </a>
    );
  }

  return (
    <button className={css(styles, className)} {...props}>
      {children}
    </button>
  );
}
