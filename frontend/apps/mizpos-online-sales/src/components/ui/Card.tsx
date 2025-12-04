import type { ReactNode } from "react";
import { css, cva } from "styled-system/css";

const cardStyles = cva({
  base: {
    backgroundColor: "white",
    borderRadius: "8px",
    border: "1px solid #ddd",
  },
  variants: {
    padding: {
      none: {},
      sm: { padding: "16px" },
      md: { padding: "24px" },
      lg: { padding: "32px" },
    },
  },
  defaultVariants: {
    padding: "md",
  },
});

interface CardProps {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
}

export function Card({ children, padding = "md", className }: CardProps) {
  return (
    <div className={`${cardStyles({ padding })} ${className || ""}`}>
      {children}
    </div>
  );
}

const cardHeaderStyles = css({
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "20px",
});

export function CardHeader({ children }: { children: ReactNode }) {
  return <h2 className={cardHeaderStyles}>{children}</h2>;
}
