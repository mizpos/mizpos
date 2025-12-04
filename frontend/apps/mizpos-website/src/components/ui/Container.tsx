import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";

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

export function Container({
  children,
  className,
  size = "lg",
}: ContainerProps) {
  const baseStyles = css({
    maxWidth: containerSizes[size],
    marginX: "auto",
    paddingX: { base: "1.5rem", md: "2.5rem", lg: "3rem" },
    width: "100%",
  });

  return (
    <div className={className ? `${baseStyles} ${className}` : baseStyles}>
      {children}
    </div>
  );
}
