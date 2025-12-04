import type { ReactNode } from "react";
import { css, cx } from "styled-system/css";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  hover?: boolean;
}

const paddingMap = {
  none: "0",
  sm: "3",
  md: "5",
  lg: "6",
} as const;

export function Card({
  children,
  variant = "default",
  padding = "md",
  className,
  hover = false,
}: CardProps) {
  return (
    <div
      className={cx(
        css({
          backgroundColor: "white",
          borderRadius: "xl",
          padding: paddingMap[padding],
          ...(variant === "default" && {
            border: "1px solid",
            borderColor: "gray.200",
            boxShadow: "card",
          }),
          ...(variant === "outlined" && {
            border: "1px solid",
            borderColor: "gray.200",
          }),
          ...(variant === "elevated" && {
            boxShadow: "card",
          }),
          ...(hover && {
            transition: "all 0.15s ease",
            cursor: "pointer",
            _hover: {
              boxShadow: "card-hover",
              transform: "translateY(-2px)",
            },
          }),
        }),
        className,
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "4",
        marginBottom: "4",
      })}
    >
      <div>
        <h3
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            color: "gray.900",
          })}
        >
          {title}
        </h3>
        {description && (
          <p
            className={css({
              fontSize: "sm",
              color: "gray.500",
              marginTop: "1",
            })}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
