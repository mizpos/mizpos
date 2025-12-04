import { type ReactNode, useEffect } from "react";
import { css, cx } from "styled-system/css";
import { useLayout } from "../Layout";

interface PageContainerProps {
  children: ReactNode;
  title: string;
  className?: string;
}

export function PageContainer({
  children,
  title,
  className,
}: PageContainerProps) {
  const { setPageTitle } = useLayout();

  useEffect(() => {
    setPageTitle(title);
  }, [title, setPageTitle]);

  return (
    <div
      className={cx(
        css({
          flex: "1",
          padding: { base: "4", md: "6" },
          overflowY: "auto",
        }),
        className,
      )}
    >
      {children}
    </div>
  );
}
