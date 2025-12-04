import { css, cva } from "../../../styled-system/css";
import type { ReactNode } from "react";

const badgeStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    fontSize: "0.75rem",
    fontWeight: "600",
    borderRadius: "full",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  variants: {
    variant: {
      primary: {
        bg: "primary.100",
        color: "primary.700",
      },
      secondary: {
        bg: "secondary.100",
        color: "secondary.700",
      },
      accent: {
        bg: "accent.100",
        color: "accent.700",
      },
      success: {
        bg: "green.100",
        color: "green.700",
      },
      outline: {
        bg: "transparent",
        color: "primary.600",
        border: "1px solid",
        borderColor: "primary.300",
      },
    },
    size: {
      sm: {
        paddingX: "0.5rem",
        paddingY: "0.125rem",
      },
      md: {
        paddingX: "0.75rem",
        paddingY: "0.25rem",
      },
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

type BadgeVariant = "primary" | "secondary" | "accent" | "success" | "outline";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "primary", size = "md", children, className }: BadgeProps) {
  return <span className={css(badgeStyles({ variant, size }), className)}>{children}</span>;
}
