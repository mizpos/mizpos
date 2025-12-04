import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { css } from "styled-system/css";
import { Layout } from "../components/Layout";
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

  // Login page has its own layout
  if (isLoginPage) {
    return <Outlet />;
  }

  // Loading state
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
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4",
          })}
        >
          <div
            className={css({
              width: "10",
              height: "10",
              border: "3px solid",
              borderColor: "gray.200",
              borderTopColor: "primary.500",
              borderRadius: "full",
              animation: "spin 1s linear infinite",
            })}
          />
          <p className={css({ color: "gray.500", fontSize: "sm" })}>
            読み込み中...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
