import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { useAuthStore } from "../stores/auth";

function LoginPage() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, session } = useAuthStore();
  const navigate = useNavigate();
  const staffIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      navigate({ to: "/pos" });
    }
  }, [session, navigate]);

  useEffect(() => {
    staffIdRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await login(staffId, password);
      if (success) {
        navigate({ to: "/pos" });
      }
    },
    [staffId, password, login, navigate],
  );

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 7);
    setStaffId(value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setPassword(value);
  };

  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        padding: "20px",
      })}
    >
      <div
        className={css({
          background: "#1e293b",
          borderRadius: "16px",
          padding: "48px 40px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        })}
      >
        <h1
          className={css({
            fontSize: "32px",
            fontWeight: 700,
            color: "#f8fafc",
            textAlign: "center",
            margin: "0 0 8px 0",
          })}
        >
          mizPOS
        </h1>
        <p
          className={css({
            fontSize: "14px",
            color: "#64748b",
            textAlign: "center",
            margin: "0 0 40px 0",
          })}
        >
          スタッフログイン
        </p>

        <form onSubmit={handleSubmit}>
          <div className={css({ marginBottom: "24px" })}>
            <label
              htmlFor="staffId"
              className={css({
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "10px",
              })}
            >
              スタッフID（7桁）
            </label>
            <input
              id="staffId"
              ref={staffIdRef}
              type="text"
              inputMode="numeric"
              value={staffId}
              onChange={handleStaffIdChange}
              placeholder="0000000"
              disabled={isLoading}
              autoComplete="off"
              className={css({
                width: "100%",
                padding: "18px 16px",
                fontSize: "28px",
                fontFamily: "monospace",
                fontWeight: 600,
                textAlign: "center",
                letterSpacing: "0.15em",
                color: "#f8fafc",
                background: "#0f172a",
                border: "2px solid #334155",
                borderRadius: "10px",
                outline: "none",
                transition: "border-color 0.15s",
                "&:focus": { borderColor: "#3b82f6" },
                "&::placeholder": { color: "#475569" },
                "&:disabled": { opacity: 0.6 },
              })}
            />
          </div>

          <div className={css({ marginBottom: "32px" })}>
            <label
              htmlFor="password"
              className={css({
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "10px",
              })}
            >
              パスワード（3〜8桁）
            </label>
            <input
              id="password"
              type="password"
              inputMode="numeric"
              value={password}
              onChange={handlePasswordChange}
              placeholder="***"
              disabled={isLoading}
              autoComplete="off"
              className={css({
                width: "100%",
                padding: "18px 16px",
                fontSize: "28px",
                fontFamily: "monospace",
                fontWeight: 600,
                textAlign: "center",
                letterSpacing: "0.5em",
                color: "#f8fafc",
                background: "#0f172a",
                border: "2px solid #334155",
                borderRadius: "10px",
                outline: "none",
                transition: "border-color 0.15s",
                "&:focus": { borderColor: "#3b82f6" },
                "&::placeholder": { color: "#475569" },
                "&:disabled": { opacity: 0.6 },
              })}
            />
          </div>

          {error && (
            <div
              className={css({
                background: "#7f1d1d",
                color: "#fecaca",
                padding: "14px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                marginBottom: "24px",
                textAlign: "center",
              })}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || staffId.length !== 7 || password.length < 3}
            className={css({
              width: "100%",
              padding: "18px",
              fontSize: "18px",
              fontWeight: 700,
              color: "#0f172a",
              background: "#22c55e",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover:not(:disabled)": { background: "#16a34a" },
              "&:active:not(:disabled)": { transform: "scale(0.98)" },
              "&:disabled": {
                background: "#334155",
                color: "#64748b",
                cursor: "not-allowed",
              },
            })}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
