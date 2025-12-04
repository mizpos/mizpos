import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";

function IndexPage() {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
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
  }, [session, navigate]);

  return null;
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
