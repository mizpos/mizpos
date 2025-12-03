import { css, cva, type RecipeVariantProps } from "styled-system/css";

const cardStyles = cva({
  base: {
    background: "#1e293b",
    borderRadius: "12px",
    border: "1px solid #334155",
  },
  variants: {
    padding: {
      none: {},
      sm: { padding: "16px" },
      md: { padding: "20px" },
      lg: { padding: "24px" },
    },
    variant: {
      default: {},
      success: {
        background: "#14532d",
        borderColor: "#166534",
      },
      warning: {
        background: "#78350f",
        borderColor: "#92400e",
      },
      error: {
        background: "#7f1d1d",
        borderColor: "#991b1b",
      },
      highlight: {
        background: "#1e40af",
        borderColor: "#2563eb",
      },
    },
  },
  defaultVariants: {
    padding: "md",
    variant: "default",
  },
});

type CardStyleProps = NonNullable<RecipeVariantProps<typeof cardStyles>>;

export interface CardProps extends CardStyleProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ padding, variant, children, className }: CardProps) {
  const styles = cardStyles.raw({ padding, variant });
  return (
    <div className={css(styles, className as Parameters<typeof css>[0])}>
      {children}
    </div>
  );
}

// Card.Header
const headerStyles = css({
  marginBottom: "16px",
});

const titleStyles = css({
  margin: 0,
  fontSize: "16px",
  fontWeight: 600,
  color: "#f8fafc",
});

const subtitleStyles = css({
  margin: "4px 0 0 0",
  fontSize: "13px",
  color: "#94a3b8",
});

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: "16px",
      })}
    >
      <div className={headerStyles}>
        <h3 className={titleStyles}>{title}</h3>
        {subtitle && <p className={subtitleStyles}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

Card.Header = CardHeader;
