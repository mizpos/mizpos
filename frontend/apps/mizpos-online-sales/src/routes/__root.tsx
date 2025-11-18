import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import Header from "../components/Header";
import { useCart } from "../contexts/CartContext";

function RootComponent() {
  const { totalItems } = useCart();

  return (
    <>
      <div>
        <Header cartItemCount={totalItems} />
        <Link to="/cart">カートへ</Link>
      </div>
      <Outlet />
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
