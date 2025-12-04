import { css } from "../../../styled-system/css";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

export function Card({ children, className, hover = false, gradient = false }: CardProps) {
  return (
    <div
      className={css(
        {
          bg: "white",
          borderRadius: "card",
          padding: { base: "1.5rem", md: "2rem" },
          shadow: "card",
          transition: "all 0.3s ease",
          ...(hover && {
            _hover: {
              shadow: "card-hover",
              transform: "translateY(-4px)",
            },
          }),
          ...(gradient && {
            position: "relative",
            overflow: "hidden",
            _before: {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: "linear-gradient(90deg, #6366f1, #06b6d4, #f97316)",
            },
          }),
        },
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={css(
        {
          marginBottom: "1rem",
        },
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3
      className={css(
        {
          fontSize: "1.25rem",
          fontWeight: "700",
          color: "gray.900",
        },
        className
      )}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p
      className={css(
        {
          fontSize: "0.875rem",
          color: "gray.600",
          marginTop: "0.25rem",
        },
        className
      )}
    >
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={css({}, className)}>{children}</div>;
}
