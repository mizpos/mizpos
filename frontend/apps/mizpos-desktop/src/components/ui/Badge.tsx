import { css, cva, type RecipeVariantProps } from "styled-system/css";

const badgeStyles = cva({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  variants: {
    variant: {
      default: {
        color: "#94a3b8",
        background: "#334155",
      },
      success: {
        color: "#86efac",
        background: "#14532d",
      },
      warning: {
        color: "#fcd34d",
        background: "#78350f",
      },
      error: {
        color: "#fecaca",
        background: "#7f1d1d",
      },
      info: {
        color: "#93c5fd",
        background: "#1e40af",
      },
    },
    size: {
      sm: {
        padding: "2px 8px",
        fontSize: "11px",
        borderRadius: "4px",
      },
      md: {
        padding: "4px 10px",
        fontSize: "13px",
        borderRadius: "4px",
      },
      lg: {
        padding: "6px 12px",
        fontSize: "14px",
        borderRadius: "6px",
      },
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

type BadgeStyleProps = NonNullable<RecipeVariantProps<typeof badgeStyles>>;

export interface BadgeProps extends BadgeStyleProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, size, children, className }: BadgeProps) {
  const styles = badgeStyles.raw({ variant, size });
  return (
    <span className={css(styles, className as Parameters<typeof css>[0])}>
      {children}
    </span>
  );
}
