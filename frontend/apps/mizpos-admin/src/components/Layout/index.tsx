import type { ReactNode } from "react";
import { css } from "styled-system/css";
import { LayoutProvider, useLayout } from "./context";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

function LayoutContent({ children }: LayoutProps) {
  const { isMobile } = useLayout();

  return (
    <div
      className={css({
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "gray.50",
      })}
    >
      <Sidebar />
      <div
        className={css({
          flex: "1",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          marginLeft: isMobile ? 0 : undefined,
          transition: "margin-left 0.2s ease-in-out",
        })}
      >
        <Header />
        <main
          className={css({
            flex: "1",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          })}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return (
    <LayoutProvider>
      <LayoutContent>{children}</LayoutContent>
    </LayoutProvider>
  );
}

export { useLayout } from "./context";
