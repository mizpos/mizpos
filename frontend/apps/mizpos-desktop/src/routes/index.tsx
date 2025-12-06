import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";
import { useTerminalStore } from "../stores/terminal";

function IndexPage() {
  const { session } = useAuthStore();
  const { status: terminalStatus, isRegisteredOnServer } = useTerminalStore();
  const navigate = useNavigate();

  useEffect(() => {
    // まず端末登録状態を確認
    if (terminalStatus === "uninitialized" || terminalStatus === "initialized") {
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
      // イベント紐づけ済みならPOS画面へ、なければイベント選択画面へ
      if (session.eventId) {
        navigate({ to: "/pos" });
      } else {
        navigate({ to: "/select-event" });
      }
    } else {
      navigate({ to: "/login" });
    }
  }, [session, terminalStatus, isRegisteredOnServer, navigate]);

  return null;
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
