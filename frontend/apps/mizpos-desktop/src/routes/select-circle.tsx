import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";

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
    maxWidth: "520px",
    padding: "48px 40px !important",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    borderRadius: "20px !important",
  }),
  header: css({
    textAlign: "center",
    marginBottom: "32px",
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
  staffInfo: css({
    textAlign: "center",
    marginBottom: "24px",
    padding: "16px",
    background: "#1e293b",
    borderRadius: "12px",
  }),
  staffName: css({
    fontSize: "18px",
    fontWeight: 600,
    color: "#f8fafc",
    margin: "0 0 4px 0",
  }),
  staffId: css({
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
    fontFamily: "monospace",
  }),
};

const listStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px",
    maxHeight: "320px",
    overflowY: "auto",
  }),
  item: css({
    padding: "16px",
    background: "#1e293b",
    borderRadius: "12px",
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s ease",
    _hover: {
      background: "#334155",
      borderColor: "#3b82f6",
    },
  }),
  itemSelected: css({
    background: "#1e3a5f",
    borderColor: "#3b82f6",
  }),
  circleName: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
    margin: 0,
  }),
  empty: css({
    textAlign: "center",
    padding: "32px",
    color: "#64748b",
    fontSize: "15px",
  }),
};

function SelectCirclePage() {
  const { session, logout } = useAuthStore();
  const { updateSettings, settings } = useSettingsStore();
  const navigate = useNavigate();
  const [selectedCircleName, setSelectedCircleName] = useState<string | null>(
    null,
  );

  // サークルの紐付けが1つだけの場合は自動選択してスキップ
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }

    // 既にサークルが選択済みの場合はスキップ
    if (settings.circleName) {
      navigate({ to: "/" });
      return;
    }

    // サークルが1つだけの場合は自動選択
    if (session.circles && session.circles.length === 1) {
      updateSettings({ circleName: session.circles[0].name }).then(() => {
        navigate({ to: "/" });
      });
    }
  }, [session, settings.circleName, navigate, updateSettings]);

  const handleSelectCircle = useCallback(async () => {
    if (!selectedCircleName) return;

    await updateSettings({ circleName: selectedCircleName });
    navigate({ to: "/" });
  }, [selectedCircleName, updateSettings, navigate]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate({ to: "/login" });
  }, [logout, navigate]);

  // サークル紐付けが0または1の場合はレンダリングしない（useEffectで遷移するため）
  if (
    !session ||
    settings.circleName ||
    !session.circles ||
    session.circles.length <= 1
  ) {
    return null;
  }

  const circles = session.circles;

  return (
    <div className={pageStyles.container}>
      <Card className={pageStyles.card}>
        <div className={pageStyles.header}>
          <h1 className={pageStyles.logo}>mizPOS</h1>
          <p className={pageStyles.subtitle}>サークル選択</p>
        </div>

        <div className={pageStyles.staffInfo}>
          <p className={pageStyles.staffName}>{session.staffName}</p>
          <p className={pageStyles.staffId}>ID: {session.staffId}</p>
        </div>

        {circles.length === 0 ? (
          <div className={listStyles.empty}>
            サークルが登録されていません。
            <br />
            管理者にお問い合わせください。
          </div>
        ) : (
          <>
            <p
              className={css({
                color: "#94a3b8",
                fontSize: "14px",
                marginBottom: "16px",
              })}
            >
              販売するサークルを選択してください
            </p>
            <div className={listStyles.container}>
              {circles.map((circle) => (
                <button
                  type="button"
                  key={circle.publisher_id}
                  className={`${listStyles.item} ${
                    selectedCircleName === circle.name
                      ? listStyles.itemSelected
                      : ""
                  }`}
                  onClick={() => setSelectedCircleName(circle.name)}
                >
                  <p className={listStyles.circleName}>{circle.name}</p>
                </button>
              ))}
            </div>
          </>
        )}

        <div
          className={css({
            display: "flex",
            gap: "12px",
          })}
        >
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleLogout}
            className={css({ flex: 1 })}
          >
            ログアウト
          </Button>
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={!selectedCircleName || circles.length === 0}
            onClick={handleSelectCircle}
            className={css({ flex: 2 })}
          >
            選択して開始
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/select-circle")({
  component: SelectCirclePage,
});
