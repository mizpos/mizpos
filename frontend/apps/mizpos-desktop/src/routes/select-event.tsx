import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface Event {
  event_id: string;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  location: string;
  is_active: boolean;
}

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
  eventName: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
    margin: "0 0 4px 0",
  }),
  eventInfo: css({
    fontSize: "13px",
    color: "#94a3b8",
    margin: 0,
  }),
  loading: css({
    textAlign: "center",
    padding: "32px",
    color: "#64748b",
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
  }),
  empty: css({
    textAlign: "center",
    padding: "32px",
    color: "#64748b",
    fontSize: "15px",
  }),
};

function SelectEventPage() {
  const { session, logout, setEventId } = useAuthStore();
  const { updateSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // イベント紐づけ済みなら直接POS画面へ
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (session.eventId) {
      navigate({ to: "/pos" });
    }
  }, [session, navigate]);

  // イベント一覧を取得
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/accounts/pos/events`, {
          headers: {
            "Content-Type": "application/json",
            "X-POS-Session": session?.sessionId || "",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("イベント一覧取得エラー:", {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          throw new Error(
            `イベント一覧の取得に失敗しました (${response.status})`,
          );
        }

        const data = await response.json();
        // バックエンドで既にアクティブなイベントのみ返される
        setEvents(data.events || []);
      } catch (err) {
        console.error("イベント取得エラー:", err);
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    if (session && !session.eventId) {
      fetchEvents();
    }
  }, [session]);

  const handleSelectEvent = async () => {
    if (!selectedEventId || !session) return;

    try {
      // セッションにイベントIDを紐づけるAPI呼び出し
      const response = await fetch(
        `${API_BASE_URL}/accounts/pos/auth/set-event`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-POS-Session": session.sessionId,
          },
          body: JSON.stringify({ event_id: selectedEventId }),
        },
      );

      if (!response.ok) {
        throw new Error("イベントの設定に失敗しました");
      }

      // 選択したイベントの名前を取得
      const selectedEvent = events.find((e) => e.event_id === selectedEventId);

      // ローカルストアを更新
      await setEventId(selectedEventId);

      // イベント情報を設定に同期（レシート印刷用）
      if (selectedEvent) {
        await updateSettings({
          eventName: selectedEvent.name,
          venueAddress: selectedEvent.location || "",
        });
      }

      // POS画面へ遷移
      navigate({ to: "/pos" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  const formatDateRange = (
    startDate: string | null,
    endDate: string | null,
  ) => {
    if (!startDate) return "";
    const start = new Date(startDate).toLocaleDateString("ja-JP");
    if (!endDate) return start;
    const end = new Date(endDate).toLocaleDateString("ja-JP");
    return `${start} 〜 ${end}`;
  };

  if (!session || session.eventId) {
    return null;
  }

  return (
    <div className={pageStyles.container}>
      <Card className={pageStyles.card}>
        <div className={pageStyles.header}>
          <h1 className={pageStyles.logo}>mizPOS</h1>
          <p className={pageStyles.subtitle}>イベント選択</p>
        </div>

        <div className={pageStyles.staffInfo}>
          <p className={pageStyles.staffName}>{session.staffName}</p>
          <p className={pageStyles.staffId}>ID: {session.staffId}</p>
        </div>

        {error && <div className={listStyles.error}>{error}</div>}

        {isLoading ? (
          <div className={listStyles.loading}>読み込み中...</div>
        ) : events.length === 0 ? (
          <div className={listStyles.empty}>
            開催中のイベントがありません。
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
              販売するイベントを選択してください
            </p>
            <div className={listStyles.container}>
              {events.map((event) => (
                <button
                  type="button"
                  key={event.event_id}
                  className={`${listStyles.item} ${
                    selectedEventId === event.event_id
                      ? listStyles.itemSelected
                      : ""
                  }`}
                  onClick={() => setSelectedEventId(event.event_id)}
                >
                  <p className={listStyles.eventName}>{event.name}</p>
                  <p className={listStyles.eventInfo}>
                    {event.location && `${event.location}`}
                    {event.start_date &&
                      ` / ${formatDateRange(event.start_date, event.end_date)}`}
                  </p>
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
            disabled={!selectedEventId || events.length === 0}
            onClick={handleSelectEvent}
            className={css({ flex: 2 })}
          >
            選択して開始
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/select-event")({
  component: SelectEventPage,
});
