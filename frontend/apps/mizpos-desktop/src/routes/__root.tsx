import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import { useTerminalStore } from "../stores/terminal";

function RootLayout() {
  const [isInitialized, setIsInitialized] = useState(false);
  const { initialize: initAuth } = useAuthStore();
  const { initialize: initSettings } = useSettingsStore();
  const { initialize: initTerminal } = useTerminalStore();

  useEffect(() => {
    const init = async () => {
      await Promise.all([initAuth(), initSettings(), initTerminal()]);

      // Keychain の端末ID を Settings に同期
      const terminalId = useTerminalStore.getState().terminalId;
      const settingsTerminalId =
        useSettingsStore.getState().settings.terminalId;
      if (terminalId && !settingsTerminalId) {
        await useSettingsStore.getState().updateSettings({ terminalId });
      }

      setIsInitialized(true);
    };
    init();
  }, [initAuth, initSettings, initTerminal]);

  if (!isInitialized) {
    return (
      <div
        className={css({
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1a237e 0%, #3949ab 100%)",
        })}
      >
        <div className={css({ textAlign: "center", color: "white" })}>
          <h1
            className={css({
              fontSize: "48px",
              fontWeight: 700,
              margin: "0 0 16px 0",
            })}
          >
            mizPOS
          </h1>
          <p className={css({ fontSize: "18px", opacity: 0.8, margin: 0 })}>
            起動中...
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

export const Route = createRootRoute({
  component: RootLayout,
});
