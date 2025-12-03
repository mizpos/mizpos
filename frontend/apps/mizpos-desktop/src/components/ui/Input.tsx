import { forwardRef } from "react";
import { css, cva, type RecipeVariantProps } from "styled-system/css";

const inputStyles = cva({
  base: {
    width: "100%",
    color: "#f8fafc",
    background: "#0f172a",
    border: "2px solid #334155",
    outline: "none",
    transition: "border-color 0.15s ease",
    fontFamily: "inherit",
    _focus: { borderColor: "#3b82f6" },
    _placeholder: { color: "#475569" },
    _disabled: { opacity: 0.6, cursor: "not-allowed" },
  },
  variants: {
    size: {
      sm: {
        padding: "10px 12px",
        fontSize: "14px",
        borderRadius: "6px",
      },
      md: {
        padding: "14px 16px",
        fontSize: "16px",
        borderRadius: "8px",
      },
      lg: {
        padding: "18px 16px",
        fontSize: "20px",
        borderRadius: "10px",
      },
      xl: {
        padding: "18px 16px",
        fontSize: "28px",
        borderRadius: "10px",
      },
    },
    variant: {
      default: {},
      numeric: {
        fontFamily: "monospace",
        fontWeight: 600,
        textAlign: "center",
        letterSpacing: "0.15em",
      },
      price: {
        fontFamily: "monospace",
        fontWeight: 700,
        textAlign: "right",
      },
    },
  },
  defaultVariants: {
    size: "md",
    variant: "default",
  },
});

const labelStyles = css({
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "8px",
});

type InputStyleProps = NonNullable<RecipeVariantProps<typeof inputStyles>>;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    InputStyleProps {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size, variant, label, className, ...props }, ref) => {
    const styles = inputStyles.raw({ size, variant });
    return (
      <div>
        {label && <label className={labelStyles}>{label}</label>}
        <input
          ref={ref}
          className={css(styles, className as Parameters<typeof css>[0])}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = "Input";
