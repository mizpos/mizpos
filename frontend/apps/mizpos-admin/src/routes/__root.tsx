import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Sidebar } from "../components/Sidebar";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
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
