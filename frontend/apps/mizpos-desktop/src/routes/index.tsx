import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getTodayOpeningReport } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useTerminalStore } from "../stores/terminal";

function IndexPage() {
  const { session } = useAuthStore();
  const { status: terminalStatus, isRegisteredOnServer } = useTerminalStore();
  const navigate = useNavigate();

  useEffect(() => {
    const checkAndNavigate = async () => {
      // まず端末登録状態を確認
      if (
        terminalStatus === "uninitialized" ||
        terminalStatus === "initialized"
      ) {
        // 端末が未登録の場合は登録画面へ
        if (!isRegisteredOnServer) {
          navigate({ to: "/register-terminal" });
          return;
        }
      }

      if (terminalStatus === "revoked") {
        // revokeされた端末は再登録が必要
        navigate({ to: "/register-terminal" });
        return;
      }

      // 端末が登録済みの場合、通常のフローへ
      if (session) {
        // イベント紐づけ済みの場合
        if (session.eventId) {
          // 開局済みならPOSへ、未開局なら開局画面へ
          const openingReport = await getTodayOpeningReport();
          if (openingReport) {
            navigate({ to: "/pos" });
          } else {
            navigate({ to: "/opening" });
          }
        } else {
          navigate({ to: "/select-event" });
        }
      } else {
        navigate({ to: "/login" });
      }
    };

    checkAndNavigate();
  }, [session, terminalStatus, isRegisteredOnServer, navigate]);

  return null;
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
