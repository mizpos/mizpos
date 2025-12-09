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
        // 開局済みかどうかを確認
        const openingReport = await getTodayOpeningReport();

        if (openingReport) {
          // 開局済みの場合：開局時のイベントIDをセッションにセットしてPOSへ
          if (session.eventId !== openingReport.eventId) {
            await useAuthStore
              .getState()
              .setEventId(openingReport.eventId || "");
          }
          navigate({ to: "/pos" });
        } else {
          // 未開局の場合
          if (session.eventId) {
            // イベント紐づけ済みなら開局画面へ
            navigate({ to: "/opening" });
          } else {
            // イベント紐づけなしならイベント選択画面へ
            navigate({ to: "/select-event" });
          }
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
