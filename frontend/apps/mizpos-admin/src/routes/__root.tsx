import type { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { css } from "styled-system/css";
import { Sidebar } from "../components/Sidebar";
import { useAuth } from "../lib/auth";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const isLoginPage = currentPath === "/login";

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isLoginPage) {
      navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, isLoginPage, navigate]);

  // ログインページは特別なレイアウト
  if (isLoginPage) {
    return <Outlet />;
  }

  // ローディング中
  if (isLoading) {
    return (
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "gray.50",
        })}
      >
        <p className={css({ color: "gray.500" })}>読み込み中...</p>
      </div>
    );
  }

  // 未認証
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div
      className={css({
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "gray.50",
      })}
    >
      <Sidebar />
      <main
        className={css({
          flex: "1",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        })}
      >
        <Outlet />
      </main>
    </div>
  );
}
