import { css } from "../../../styled-system/css";
import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const containerSizes = {
  sm: "768px",
  md: "1024px",
  lg: "1280px",
  xl: "1440px",
};

export function Container({ children, className, size = "lg" }: ContainerProps) {
  return (
    <div
      className={css(
        {
          maxWidth: containerSizes[size],
          marginX: "auto",
          paddingX: { base: "1rem", md: "2rem" },
          width: "100%",
        },
        className
      )}
    >
      {children}
    </div>
  );
}
