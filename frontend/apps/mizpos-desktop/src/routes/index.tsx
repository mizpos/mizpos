import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthStore } from "../stores/auth";

function IndexPage() {
  const { session } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate({ to: "/pos" });
    } else {
      navigate({ to: "/login" });
    }
  }, [session, navigate]);

  return null;
}

export const Route = createFileRoute("/")({
  component: IndexPage,
});
