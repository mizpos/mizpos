import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import { getTodayOpeningReport, saveOpeningReport } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import type { DenominationCount, OpeningReport } from "../types";

// 金種リスト
const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];

// ページスタイル
const pageStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 24px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  }),
  title: css({
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
  }),
  content: css({
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  }),
  contentInner: css({
    maxWidth: "600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  }),
};

// セクションスタイル
const sectionStyles = {
  title: css({
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
    marginBottom: "16px",
  }),
  description: css({
    fontSize: "14px",
    color: "#94a3b8",
    marginBottom: "20px",
    lineHeight: 1.6,
  }),
};

// 金種入力スタイル
const denominationStyles = {
  table: css({
    width: "100%",
    borderCollapse: "collapse",
  }),
  headerRow: css({
    background: "#1e293b",
  }),
  headerCell: css({
    padding: "12px",
    textAlign: "left",
    fontSize: "13px",
    fontWeight: 600,
    color: "#94a3b8",
    borderBottom: "1px solid #334155",
  }),
  row: css({
    borderBottom: "1px solid #334155",
  }),
  cell: css({
    padding: "12px",
    fontSize: "15px",
    color: "#f8fafc",
  }),
  denomination: css({
    fontWeight: 600,
    fontFamily: "monospace",
  }),
  input: css({
    width: "80px",
    padding: "8px 12px",
    fontSize: "15px",
    fontFamily: "monospace",
    textAlign: "right",
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    outline: "none",
    _focus: {
      borderColor: "#3b82f6",
    },
  }),
  subtotal: css({
    fontWeight: 600,
    fontFamily: "monospace",
    textAlign: "right",
  }),
  totalRow: css({
    background: "#14532d",
  }),
  totalCell: css({
    padding: "16px 12px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#86efac",
  }),
};

// スタッフ情報スタイル
const staffInfoStyles = {
  container: css({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    background: "#1e293b",
    borderRadius: "10px",
    marginBottom: "8px",
  }),
  name: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
  }),
  id: css({
    fontSize: "13px",
    color: "#64748b",
    fontFamily: "monospace",
  }),
  event: css({
    fontSize: "14px",
    color: "#94a3b8",
    marginLeft: "auto",
  }),
};

function OpeningPage() {
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const { settings } = useSettingsStore();

  // 金種カウント状態
  const [denominationCounts, setDenominationCounts] = useState<
    Record<number, number>
  >(() => Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])));

  // 処理中フラグ
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 未ログイン時・開局済みの場合はリダイレクト
  useEffect(() => {
    const checkStatus = async () => {
      if (!session) {
        navigate({ to: "/login" });
        return;
      }
      if (!session.eventId) {
        navigate({ to: "/select-event" });
        return;
      }

      // 開局済みの場合はPOSへ
      const openingReport = await getTodayOpeningReport();
      if (openingReport) {
        navigate({ to: "/pos" });
        return;
      }

      setIsLoading(false);
    };

    checkStatus();
  }, [session, navigate]);

  // 現金合計
  const cashTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (denominationCounts[d] || 0),
    0,
  );

  // 金種カウント変更
  const handleDenominationChange = useCallback(
    (denomination: number, value: string) => {
      const count =
        value === "" ? 0 : Math.max(0, Number.parseInt(value, 10) || 0);
      setDenominationCounts((prev) => ({ ...prev, [denomination]: count }));
    },
    [],
  );

  // 開局処理
  const handleOpen = useCallback(async () => {
    if (!session) return;

    setIsProcessing(true);

    try {
      // 開局レポートを作成
      const report: OpeningReport = {
        id: `opening-${Date.now()}`,
        terminalId: settings.terminalId,
        staffId: session.staffId,
        staffName: session.staffName,
        eventId: session.eventId,
        denominations: DENOMINATIONS.map((d) => ({
          denomination: d,
          count: denominationCounts[d] || 0,
        })) as DenominationCount[],
        cashTotal,
        openedAt: new Date(),
      };

      // ローカルに保存
      await saveOpeningReport(report);

      // POS画面へ
      navigate({ to: "/pos" });
    } catch (error) {
      console.error("Failed to open:", error);
      alert(
        "開局処理に失敗しました: " +
          (error instanceof Error ? error.message : "不明なエラー"),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [session, settings, denominationCounts, cashTotal, navigate]);

  // 戻る
  const handleBack = useCallback(() => {
    navigate({ to: "/select-event" });
  }, [navigate]);

  if (!session || !session.eventId || isLoading) {
    return null;
  }

  return (
    <div className={pageStyles.container}>
      {/* ヘッダー */}
      <header className={pageStyles.header}>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← 戻る
        </Button>
        <h1 className={pageStyles.title}>開局処理</h1>
      </header>

      {/* コンテンツ */}
      <div className={pageStyles.content}>
        <div className={pageStyles.contentInner}>
          {/* スタッフ・イベント情報 */}
          <div className={staffInfoStyles.container}>
            <div>
              <div className={staffInfoStyles.name}>{session.staffName}</div>
              <div className={staffInfoStyles.id}>ID: {session.staffId}</div>
            </div>
            <div className={staffInfoStyles.event}>
              {settings.eventName || "イベント未設定"}
            </div>
          </div>

          {/* 説明 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>レジ金の登録</h2>
            <p className={sectionStyles.description}>
              営業開始前のレジ金を金種別に入力してください。
              <br />
              この情報は閉局時の差異計算に使用されます。
            </p>
          </Card>

          {/* 現金 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>現金</h2>
            <table className={denominationStyles.table}>
              <thead>
                <tr className={denominationStyles.headerRow}>
                  <th className={denominationStyles.headerCell}>金種</th>
                  <th className={denominationStyles.headerCell}>枚数</th>
                  <th
                    className={denominationStyles.headerCell}
                    style={{ textAlign: "right" }}
                  >
                    小計
                  </th>
                </tr>
              </thead>
              <tbody>
                {DENOMINATIONS.map((d) => (
                  <tr key={d} className={denominationStyles.row}>
                    <td
                      className={`${denominationStyles.cell} ${denominationStyles.denomination}`}
                    >
                      ¥{d.toLocaleString()}
                    </td>
                    <td className={denominationStyles.cell}>
                      <input
                        type="number"
                        min="0"
                        value={denominationCounts[d] || ""}
                        onChange={(e) =>
                          handleDenominationChange(d, e.target.value)
                        }
                        className={denominationStyles.input}
                      />
                    </td>
                    <td
                      className={`${denominationStyles.cell} ${denominationStyles.subtotal}`}
                    >
                      ¥{(d * (denominationCounts[d] || 0)).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className={denominationStyles.totalRow}>
                  <td className={denominationStyles.totalCell} colSpan={2}>
                    現金合計
                  </td>
                  <td
                    className={denominationStyles.totalCell}
                    style={{ textAlign: "right" }}
                  >
                    ¥{cashTotal.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* 開局ボタン */}
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={handleOpen}
            disabled={isProcessing}
          >
            {isProcessing ? "処理中..." : "開局する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/opening")({
  component: OpeningPage,
});
