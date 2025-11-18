import React from "react";

export interface CartIconProps {
  /** アイコンのサイズ（幅と高さ） */
  size?: number;
  /** アイコンの色 */
  color?: string;
  /** カート内のアイテム数（表示する場合） */
  itemCount?: number;
  /** カスタムクラス名 */
  className?: string;
}

export const CartIcon: React.FC<CartIconProps> = ({
  size = 51,
  color = "#ffffff",
  itemCount = 0,
  className = "",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 51 51"
      width={size}
      height={size}
      className={className}
      aria-label="ショッピングカート"
      role="img"
    >
      <g>
        <path
          fill={color}
          d="M21.3,42c1.6,0,2.9,1.3,2.9,2.9s-1.3,2.9-2.9,2.9-2.9-1.3-2.9-2.9,1.3-2.9,2.9-2.9ZM45.6,42c1.6,0,2.9,1.3,2.9,2.9s-1.3,2.9-2.9,2.9-2.9-1.3-2.9-2.9,1.3-2.9,2.9-2.9ZM11.2,13.1l5.9,21.6h33.4v4.6H13.2l-5.8-21H.5v-5.2s10.7,0,10.7,0Z"
        />
        {itemCount !== undefined && (
          <text
            fill={color}
            fontFamily="'Noto Sans JP', sans-serif"
            fontSize="25"
            fontWeight="700"
            textAnchor="middle"
            transform="translate(32 28)"
            style={{ isolation: "isolate" }}
          >
            <tspan x="0" y="0">
              {itemCount}
            </tspan>
          </text>
        )}
      </g>
    </svg>
  );
};

export default CartIcon;
