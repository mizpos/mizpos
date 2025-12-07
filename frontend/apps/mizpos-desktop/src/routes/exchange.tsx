import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import { getTodayExchangeRecords, saveExchangeRecord } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import type { DenominationCount, ExchangeRecord } from "../types";

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
    maxWidth: "900px",
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
    padding: "10px 12px",
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
    padding: "10px 12px",
    fontSize: "14px",
    color: "#f8fafc",
  }),
  denomination: css({
    fontWeight: 600,
    fontFamily: "monospace",
  }),
  input: css({
    width: "70px",
    padding: "6px 10px",
    fontSize: "14px",
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
    fontSize: "13px",
  }),
  totalRow: css({
    background: "#14532d",
  }),
  totalRowWarning: css({
    background: "#7f1d1d",
  }),
  totalCell: css({
    padding: "14px 12px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#86efac",
  }),
  totalCellWarning: css({
    color: "#fca5a5",
  }),
};

// 両替グリッドスタイル
const exchangeGridStyles = {
  container: css({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  }),
  column: css({
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  }),
  arrow: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    color: "#64748b",
    padding: "0 8px",
  }),
};

// 履歴スタイル
const historyStyles = {
  list: css({
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "200px",
    overflowY: "auto",
  }),
  item: css({
    padding: "12px 16px",
    background: "#1e293b",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  time: css({
    fontSize: "13px",
    color: "#64748b",
  }),
  amount: css({
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
  }),
  memo: css({
    fontSize: "13px",
    color: "#94a3b8",
  }),
  empty: css({
    textAlign: "center",
    padding: "24px",
    color: "#64748b",
    fontSize: "14px",
  }),
};

// メモ入力スタイル
const memoStyles = {
  input: css({
    width: "100%",
    padding: "12px 16px",
    fontSize: "14px",
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    outline: "none",
    _focus: {
      borderColor: "#3b82f6",
    },
  }),
};

// 差異表示スタイル
const differenceStyles = {
  container: css({
    padding: "16px",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  match: css({
    background: "#14532d",
  }),
  mismatch: css({
    background: "#7f1d1d",
  }),
  label: css({
    fontSize: "15px",
    fontWeight: 600,
  }),
  value: css({
    fontSize: "20px",
    fontWeight: 700,
    fontFamily: "monospace",
  }),
};

function ExchangePage() {
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const { settings } = useSettingsStore();

  // 両替前金種カウント
  const [fromCounts, setFromCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])),
  );

  // 両替後金種カウント
  const [toCounts, setToCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])),
  );

  // メモ
  const [memo, setMemo] = useState("");

  // 処理中フラグ
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 今日の両替履歴
  const [todayRecords, setTodayRecords] = useState<ExchangeRecord[]>([]);

  // 未ログイン時はリダイレクト
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
    }
  }, [session, navigate]);

  // 履歴を取得
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const records = await getTodayExchangeRecords();
        setTodayRecords(records);
      } catch (error) {
        console.error("Failed to load exchange records:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  // 両替前合計
  const fromTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (fromCounts[d] || 0),
    0,
  );

  // 両替後合計
  const toTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (toCounts[d] || 0),
    0,
  );

  // 差異
  const difference = toTotal - fromTotal;
  const isMatch = difference === 0;

  // 金種カウント変更（両替前）
  const handleFromChange = useCallback(
    (denomination: number, value: string) => {
      const count =
        value === "" ? 0 : Math.max(0, Number.parseInt(value, 10) || 0);
      setFromCounts((prev) => ({ ...prev, [denomination]: count }));
    },
    [],
  );

  // 金種カウント変更（両替後）
  const handleToChange = useCallback((denomination: number, value: string) => {
    const count =
      value === "" ? 0 : Math.max(0, Number.parseInt(value, 10) || 0);
    setToCounts((prev) => ({ ...prev, [denomination]: count }));
  }, []);

  // リセット
  const handleReset = useCallback(() => {
    setFromCounts(Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])));
    setToCounts(Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])));
    setMemo("");
  }, []);

  // 両替を記録
  const handleSave = useCallback(async () => {
    if (!session) return;
    if (!isMatch) {
      alert("両替前後の金額が一致していません");
      return;
    }
    if (fromTotal === 0) {
      alert("両替する金額を入力してください");
      return;
    }

    setIsProcessing(true);

    try {
      const record: ExchangeRecord = {
        id: `exchange-${Date.now()}`,
        terminalId: settings.terminalId,
        staffId: session.staffId,
        staffName: session.staffName,
        eventId: session.eventId,
        fromDenominations: DENOMINATIONS.map((d) => ({
          denomination: d,
          count: fromCounts[d] || 0,
        })) as DenominationCount[],
        fromTotal,
        toDenominations: DENOMINATIONS.map((d) => ({
          denomination: d,
          count: toCounts[d] || 0,
        })) as DenominationCount[],
        toTotal,
        memo: memo || undefined,
        exchangedAt: new Date(),
      };

      await saveExchangeRecord(record);

      // 履歴を更新
      setTodayRecords((prev) => [record, ...prev]);

      // フォームをリセット
      handleReset();

      alert("両替を記録しました");
    } catch (error) {
      console.error("Failed to save exchange record:", error);
      alert(
        "両替の記録に失敗しました: " +
          (error instanceof Error ? error.message : "不明なエラー"),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    session,
    settings,
    fromCounts,
    toCounts,
    fromTotal,
    toTotal,
    memo,
    isMatch,
    handleReset,
  ]);

  // 戻る
  const handleBack = useCallback(() => {
    navigate({ to: "/pos" });
  }, [navigate]);

  if (!session || isLoading) {
    return null;
  }

  return (
    <div className={pageStyles.container}>
      {/* ヘッダー */}
      <header className={pageStyles.header}>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← 戻る
        </Button>
        <h1 className={pageStyles.title}>両替処理</h1>
      </header>

      {/* コンテンツ */}
      <div className={pageStyles.content}>
        <div className={pageStyles.contentInner}>
          {/* 説明 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>両替の記録</h2>
            <p className={sectionStyles.description}>
              両替した金種を記録します。両替前後の合計金額が一致している必要があります。
              <br />
              この記録は閉局時の差異確認の参考になります。
            </p>
          </Card>

          {/* 両替入力 */}
          <div className={exchangeGridStyles.container}>
            {/* 両替前 */}
            <Card padding="lg">
              <h2 className={sectionStyles.title}>両替前（出金）</h2>
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
                          value={fromCounts[d] || ""}
                          onChange={(e) => handleFromChange(d, e.target.value)}
                          className={denominationStyles.input}
                        />
                      </td>
                      <td
                        className={`${denominationStyles.cell} ${denominationStyles.subtotal}`}
                      >
                        ¥{(d * (fromCounts[d] || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className={denominationStyles.totalRow}>
                    <td className={denominationStyles.totalCell} colSpan={2}>
                      合計
                    </td>
                    <td
                      className={denominationStyles.totalCell}
                      style={{ textAlign: "right" }}
                    >
                      ¥{fromTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>

            {/* 両替後 */}
            <Card padding="lg">
              <h2 className={sectionStyles.title}>両替後（入金）</h2>
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
                          value={toCounts[d] || ""}
                          onChange={(e) => handleToChange(d, e.target.value)}
                          className={denominationStyles.input}
                        />
                      </td>
                      <td
                        className={`${denominationStyles.cell} ${denominationStyles.subtotal}`}
                      >
                        ¥{(d * (toCounts[d] || 0)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr
                    className={
                      isMatch
                        ? denominationStyles.totalRow
                        : denominationStyles.totalRowWarning
                    }
                  >
                    <td
                      className={`${denominationStyles.totalCell} ${!isMatch ? denominationStyles.totalCellWarning : ""}`}
                      colSpan={2}
                    >
                      合計
                    </td>
                    <td
                      className={`${denominationStyles.totalCell} ${!isMatch ? denominationStyles.totalCellWarning : ""}`}
                      style={{ textAlign: "right" }}
                    >
                      ¥{toTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          {/* 差異表示 */}
          <div
            className={`${differenceStyles.container} ${isMatch ? differenceStyles.match : differenceStyles.mismatch}`}
          >
            <span className={differenceStyles.label}>
              {isMatch ? "金額一致" : "金額不一致"}
            </span>
            <span className={differenceStyles.value}>
              {difference >= 0 ? "+" : ""}¥{difference.toLocaleString()}
            </span>
          </div>

          {/* メモ */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>メモ（任意）</h2>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="両替の理由など"
              className={memoStyles.input}
            />
          </Card>

          {/* アクションボタン */}
          <div
            className={css({
              display: "flex",
              gap: "12px",
            })}
          >
            <Button variant="secondary" size="lg" onClick={handleReset}>
              リセット
            </Button>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSave}
              disabled={isProcessing || !isMatch || fromTotal === 0}
            >
              {isProcessing ? "処理中..." : "両替を記録"}
            </Button>
          </div>

          {/* 今日の両替履歴 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>本日の両替履歴</h2>
            {todayRecords.length === 0 ? (
              <div className={historyStyles.empty}>
                本日の両替記録はありません
              </div>
            ) : (
              <div className={historyStyles.list}>
                {todayRecords.map((record) => (
                  <div key={record.id} className={historyStyles.item}>
                    <div>
                      <div className={historyStyles.time}>
                        {new Date(record.exchangedAt).toLocaleTimeString(
                          "ja-JP",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </div>
                      {record.memo && (
                        <div className={historyStyles.memo}>{record.memo}</div>
                      )}
                    </div>
                    <div className={historyStyles.amount}>
                      ¥{record.fromTotal.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/exchange")({
  component: ExchangePage,
});
