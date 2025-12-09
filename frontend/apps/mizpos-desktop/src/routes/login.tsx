import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import { getTodayOpeningReport } from "../lib/db";
import { useAuthStore } from "../stores/auth";

// ページレイアウトスタイル
const pageStyles = {
  container: css({
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    padding: "24px",
  }),
  card: css({
    width: "100%",
    maxWidth: "440px",
    padding: "48px 40px !important",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    borderRadius: "20px !important",
  }),
  header: css({
    textAlign: "center",
    marginBottom: "40px",
  }),
  logo: css({
    fontSize: "36px",
    fontWeight: 700,
    color: "#f8fafc",
    margin: "0 0 8px 0",
    letterSpacing: "-0.02em",
  }),
  subtitle: css({
    fontSize: "15px",
    color: "#64748b",
    margin: 0,
  }),
};

// フォームスタイル
const formStyles = {
  field: css({
    marginBottom: "24px",
  }),
  fieldLast: css({
    marginBottom: "32px",
  }),
  label: css({
    display: "block",
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: "10px",
  }),
  input: css({
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
    borderRadius: "12px",
    outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    _focus: {
      borderColor: "#3b82f6",
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.2)",
    },
    _placeholder: { color: "#475569" },
    _disabled: { opacity: 0.6, cursor: "not-allowed" },
  }),
  inputPassword: css({
    letterSpacing: "0.5em",
  }),
  error: css({
    background: "#7f1d1d",
    color: "#fecaca",
    padding: "14px 16px",
    borderRadius: "10px",
    fontSize: "14px",
    marginBottom: "24px",
    textAlign: "center",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    animation: "shake 0.4s ease-in-out",
  }),
  submitButton: css({
    padding: "20px !important",
    fontSize: "18px !important",
  }),
};

// 入力インジケーター
const inputIndicator = css({
  display: "flex",
  justifyContent: "center",
  gap: "6px",
  marginTop: "10px",
});

const inputDot = css({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  background: "#334155",
  transition: "background 0.15s ease",
});

const inputDotFilled = css({
  background: "#3b82f6",
});

// Static arrays for input progress indicators
const staffIdDots = Array.from({ length: 7 }, (_, i) => ({
  id: `staff-dot-${i}`,
  index: i,
}));

const passwordDots = Array.from({ length: 8 }, (_, i) => ({
  id: `pass-dot-${i}`,
  index: i,
  isRequired: i < 3,
}));

function LoginPage() {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, session } = useAuthStore();
  const navigate = useNavigate();
  const staffIdRef = useRef<HTMLInputElement>(null);
  const [openingInfo, setOpeningInfo] = useState<{
    isOpened: boolean;
    staffName?: string;
    openedAt?: Date;
  } | null>(null);

  // 開局状態を確認
  useEffect(() => {
    getTodayOpeningReport().then((report) => {
      if (report) {
        setOpeningInfo({
          isOpened: true,
          staffName: report.staffName,
          openedAt: new Date(report.openedAt),
        });
      } else {
        setOpeningInfo({ isOpened: false });
      }
    });
  }, []);

  useEffect(() => {
    const checkAndNavigate = async () => {
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
      }
    };

    checkAndNavigate();
  }, [session, navigate]);

  useEffect(() => {
    staffIdRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await login(staffId, password);
      if (success) {
        // ログイン成功後はuseEffectでsessionの変更を検知してナビゲート
        // （eventIdの有無で遷移先が変わるため）
      }
    },
    [staffId, password, login],
  );

  const handleStaffIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 7);
    setStaffId(value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setPassword(value);
  };

  const isValid = staffId.length === 7 && password.length >= 3;

  return (
    <div className={pageStyles.container}>
      <Card className={pageStyles.card}>
        <div className={pageStyles.header}>
          <h1 className={pageStyles.logo}>mizPOS</h1>
          <p className={pageStyles.subtitle}>スタッフログイン</p>
        </div>

        {/* 開局状態表示 */}
        {openingInfo && (
          <div
            className={css({
              padding: "12px 16px",
              marginBottom: "24px",
              borderRadius: "10px",
              fontSize: "14px",
              background: openingInfo.isOpened ? "#14532d" : "#78350f",
              color: openingInfo.isOpened ? "#86efac" : "#fde68a",
              textAlign: "center",
            })}
          >
            {openingInfo.isOpened ? (
              <>
                開局済み（{openingInfo.staffName}・
                {openingInfo.openedAt?.toLocaleTimeString("ja-JP", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                ）
              </>
            ) : (
              "未開局"
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={formStyles.field}>
            <label htmlFor="staffId" className={formStyles.label}>
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
              className={formStyles.input}
            />
            {/* 入力進捗インジケーター */}
            <div className={inputIndicator}>
              {staffIdDots.map((dot) => (
                <div
                  key={dot.id}
                  className={`${inputDot} ${dot.index < staffId.length ? inputDotFilled : ""}`}
                />
              ))}
            </div>
          </div>

          <div className={formStyles.fieldLast}>
            <label htmlFor="password" className={formStyles.label}>
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
              className={`${formStyles.input} ${formStyles.inputPassword}`}
            />
            {/* 入力進捗インジケーター（最小3桁を示す） */}
            <div className={inputIndicator}>
              {passwordDots.map((dot) => (
                <div
                  key={dot.id}
                  className={`${inputDot} ${dot.index < password.length ? inputDotFilled : ""}`}
                  style={
                    dot.isRequired
                      ? {
                          borderColor: "#475569",
                          borderWidth: "1px",
                          borderStyle: "solid",
                        }
                      : {}
                  }
                />
              ))}
            </div>
          </div>

          {error && (
            <div className={formStyles.error}>
              <span>!</span>
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={isLoading || !isValid}
            className={formStyles.submitButton}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  component: LoginPage,
});
