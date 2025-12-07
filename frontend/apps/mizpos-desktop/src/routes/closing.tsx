import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card } from "../components/ui";
import {
  clearTodayData,
  getTodaySalesTotal,
  saveClosingReport,
} from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import { useTerminalStore } from "../stores/terminal";
import type { ClosingReport, DenominationCount, VoucherCount } from "../types";

// 金種リスト
const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1];

// 商品券等の種別
const VOUCHER_TYPES = [
  "百貨店商品券",
  "イベント主催者発行商品券",
  "外貨（円換算）",
  "その他",
];

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
    maxWidth: "700px",
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

// 商品券入力スタイル
const voucherStyles = {
  list: css({
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  }),
  row: css({
    display: "flex",
    gap: "12px",
    alignItems: "center",
  }),
  select: css({
    flex: 1,
    padding: "10px 14px",
    fontSize: "14px",
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    cursor: "pointer",
    outline: "none",
    _focus: {
      borderColor: "#fbbf24",
    },
  }),
  input: css({
    width: "120px",
    padding: "10px 14px",
    fontSize: "15px",
    fontFamily: "monospace",
    textAlign: "right",
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    outline: "none",
    _focus: {
      borderColor: "#fbbf24",
    },
  }),
  memoInput: css({
    width: "150px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#f8fafc",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    outline: "none",
    _focus: {
      borderColor: "#fbbf24",
    },
  }),
  removeButton: css({
    padding: "8px 12px",
    fontSize: "14px",
    color: "#f87171",
    background: "transparent",
    border: "1px solid #7f1d1d",
    borderRadius: "6px",
    cursor: "pointer",
    _hover: {
      background: "#7f1d1d",
      color: "#f8fafc",
    },
  }),
  addButton: css({
    alignSelf: "flex-start",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#fbbf24",
    background: "transparent",
    border: "1px dashed #fbbf24",
    borderRadius: "8px",
    cursor: "pointer",
    _hover: {
      background: "rgba(251, 191, 36, 0.1)",
    },
  }),
  total: css({
    marginTop: "16px",
    padding: "16px",
    background: "#1e293b",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  }),
  totalLabel: css({
    fontSize: "15px",
    fontWeight: 500,
    color: "#94a3b8",
  }),
  totalAmount: css({
    fontSize: "20px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#fbbf24",
  }),
};

// 集計スタイル
const summaryStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  }),
  row: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #334155",
  }),
  label: css({
    fontSize: "15px",
    color: "#94a3b8",
  }),
  value: css({
    fontSize: "18px",
    fontWeight: 600,
    fontFamily: "monospace",
    color: "#f8fafc",
  }),
  differenceRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    marginTop: "12px",
    borderRadius: "10px",
  }),
  differencePositive: css({
    background: "#14532d",
  }),
  differenceNegative: css({
    background: "#7f1d1d",
  }),
  differenceZero: css({
    background: "#1e293b",
  }),
  differenceLabel: css({
    fontSize: "16px",
    fontWeight: 600,
  }),
  differenceValue: css({
    fontSize: "24px",
    fontWeight: 700,
    fontFamily: "monospace",
  }),
};

// 警告スタイル
const warningStyles = {
  container: css({
    padding: "16px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #dc2626",
    borderRadius: "10px",
    marginBottom: "16px",
  }),
  text: css({
    fontSize: "14px",
    color: "#fca5a5",
    margin: 0,
    lineHeight: 1.6,
  }),
};

function ClosingPage() {
  const navigate = useNavigate();
  const { session, logout } = useAuthStore();
  const { settings } = useSettingsStore();
  const { revokeTerminal } = useTerminalStore();

  // 金種カウント状態
  const [denominationCounts, setDenominationCounts] = useState<
    Record<number, number>
  >(() => Object.fromEntries(DENOMINATIONS.map((d) => [d, 0])));

  // 商品券等カウント状態
  const [voucherCounts, setVoucherCounts] = useState<VoucherCount[]>([]);

  // 売上データ
  const [salesTotal, setSalesTotal] = useState({
    totalAmount: 0,
    transactionCount: 0,
    cashAmount: 0,
    cashlessAmount: 0,
    voucherAmount: 0,
  });

  // 処理中フラグ
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 売上データを取得
  useEffect(() => {
    const loadSalesData = async () => {
      try {
        const data = await getTodaySalesTotal();
        setSalesTotal(data);
      } catch (error) {
        console.error("Failed to load sales data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSalesData();
  }, []);

  // 未ログイン時はリダイレクト
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
    }
  }, [session, navigate]);

  // 現金合計
  const cashTotal = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (denominationCounts[d] || 0),
    0,
  );

  // 商品券等合計
  const voucherTotal = voucherCounts.reduce((sum, v) => sum + v.amount, 0);

  // レジ金合計
  const grandTotal = cashTotal + voucherTotal;

  // 差異（レジ金 - 売上）
  // 売上は決済時の「お預かり」金額ベースなので、おつりを引いた純売上と比較
  const expectedTotal = salesTotal.totalAmount;
  const difference = grandTotal - expectedTotal;

  // 金種カウント変更
  const handleDenominationChange = useCallback(
    (denomination: number, value: string) => {
      const count =
        value === "" ? 0 : Math.max(0, Number.parseInt(value, 10) || 0);
      setDenominationCounts((prev) => ({ ...prev, [denomination]: count }));
    },
    [],
  );

  // 商品券追加
  const handleAddVoucher = useCallback(() => {
    setVoucherCounts((prev) => [
      ...prev,
      { type: VOUCHER_TYPES[0], amount: 0 },
    ]);
  }, []);

  // 商品券削除
  const handleRemoveVoucher = useCallback((index: number) => {
    setVoucherCounts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 商品券変更
  const handleVoucherChange = useCallback(
    (index: number, field: keyof VoucherCount, value: string | number) => {
      setVoucherCounts((prev) =>
        prev.map((v, i) =>
          i === index
            ? {
                ...v,
                [field]:
                  field === "amount"
                    ? Math.max(0, Number.parseInt(String(value), 10) || 0)
                    : value,
              }
            : v,
        ),
      );
    },
    [],
  );

  // 閉局処理
  const handleClose = useCallback(async () => {
    if (!session) return;

    const confirmed = await confirm(
      "この操作を行うと：\n" +
        "・閉局レポートが保存されます\n" +
        "・端末登録が無効化されます\n" +
        "・再度利用するには端末の再登録が必要です\n\n" +
        "この操作は取り消せません。",
      {
        title: "閉局処理を実行しますか？",
        kind: "warning",
        okLabel: "閉局する",
        cancelLabel: "キャンセル",
      },
    );

    if (!confirmed) return;

    setIsProcessing(true);

    try {
      // 閉局レポートを作成
      const report: ClosingReport = {
        id: `closing-${Date.now()}`,
        terminalId: settings.terminalId,
        staffId: session.staffId,
        staffName: session.staffName,
        eventId: session.eventId,
        denominations: DENOMINATIONS.map((d) => ({
          denomination: d,
          count: denominationCounts[d] || 0,
        })) as DenominationCount[],
        cashTotal,
        vouchers: voucherCounts,
        voucherTotal,
        grandTotal,
        expectedTotal,
        difference,
        closedAt: new Date(),
      };

      // ローカルに保存
      await saveClosingReport(report);

      // TODO: サーバーに送信（必要に応じて）

      // プリンターが設定されている場合は閉局レポートを印刷
      if (settings.printer?.vendorId && settings.printer.deviceId) {
        try {
          const closedAtStr = report.closedAt.toLocaleString("ja-JP", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });

          await invoke("print_closing_report", {
            vendorId: settings.printer.vendorId,
            deviceId: settings.printer.deviceId,
            report: {
              id: report.id,
              terminal_id: report.terminalId,
              staff_id: report.staffId,
              staff_name: report.staffName,
              event_name: settings.eventName,
              denominations: report.denominations,
              cash_total: report.cashTotal,
              vouchers: report.vouchers.map((v) => ({
                type: v.type,
                amount: v.amount,
                memo: v.memo,
              })),
              voucher_total: report.voucherTotal,
              grand_total: report.grandTotal,
              expected_total: report.expectedTotal,
              difference: report.difference,
              transaction_count: salesTotal.transactionCount,
              closed_at: closedAtStr,
            },
            paperWidth: settings.printer.paperWidth,
          });
          console.log("Closing report printed successfully");
        } catch (printError) {
          console.error("Failed to print closing report:", printError);
          // 印刷エラーは致命的ではないので続行
        }
      }

      // 今日のデータをクリア
      await clearTodayData();

      // 端末登録を無効化（サーバーへのrevoke + Keychainクリア）
      await revokeTerminal();

      // ログアウト
      await logout();

      // 端末登録画面へ
      navigate({ to: "/register-terminal" });
    } catch (error) {
      console.error("Failed to close:", error);
      alert(
        "閉局処理に失敗しました: " +
          (error instanceof Error ? error.message : "不明なエラー"),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    session,
    settings,
    denominationCounts,
    cashTotal,
    voucherCounts,
    voucherTotal,
    grandTotal,
    expectedTotal,
    difference,
    salesTotal,
    revokeTerminal,
    logout,
    navigate,
  ]);

  // 戻る
  const handleBack = useCallback(() => {
    navigate({ to: "/settings" });
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
        <h1 className={pageStyles.title}>閉局処理</h1>
      </header>

      {/* コンテンツ */}
      <div className={pageStyles.content}>
        <div className={pageStyles.contentInner}>
          {/* 警告 */}
          <div className={warningStyles.container}>
            <p className={warningStyles.text}>
              閉局処理を行うと、端末登録が無効化されます。
              <br />
              再度このアプリを使用するには、管理画面から端末を再登録する必要があります。
            </p>
          </div>

          {/* 売上情報 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>本日の売上</h2>
            <div className={summaryStyles.container}>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>取引件数</span>
                <span className={summaryStyles.value}>
                  {salesTotal.transactionCount}件
                </span>
              </div>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>売上合計</span>
                <span className={summaryStyles.value}>
                  ¥{salesTotal.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
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

          {/* 商品券等 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>商品券等</h2>
            <div className={voucherStyles.list}>
              {voucherCounts.map((voucher, index) => (
                <div
                  key={`voucher-${index}-${voucher.type}`}
                  className={voucherStyles.row}
                >
                  <select
                    value={voucher.type}
                    onChange={(e) =>
                      handleVoucherChange(index, "type", e.target.value)
                    }
                    className={voucherStyles.select}
                  >
                    {VOUCHER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    value={voucher.amount || ""}
                    onChange={(e) =>
                      handleVoucherChange(index, "amount", e.target.value)
                    }
                    placeholder="金額"
                    className={voucherStyles.input}
                  />
                  <input
                    type="text"
                    value={voucher.memo || ""}
                    onChange={(e) =>
                      handleVoucherChange(index, "memo", e.target.value)
                    }
                    placeholder="備考"
                    className={voucherStyles.memoInput}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVoucher(index)}
                    className={voucherStyles.removeButton}
                  >
                    削除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddVoucher}
                className={voucherStyles.addButton}
              >
                + 商品券等を追加
              </button>
            </div>

            {voucherCounts.length > 0 && (
              <div className={voucherStyles.total}>
                <span className={voucherStyles.totalLabel}>商品券等合計</span>
                <span className={voucherStyles.totalAmount}>
                  ¥{voucherTotal.toLocaleString()}
                </span>
              </div>
            )}
          </Card>

          {/* 集計 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>集計</h2>
            <div className={summaryStyles.container}>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>現金合計</span>
                <span className={summaryStyles.value}>
                  ¥{cashTotal.toLocaleString()}
                </span>
              </div>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>商品券等合計</span>
                <span className={summaryStyles.value}>
                  ¥{voucherTotal.toLocaleString()}
                </span>
              </div>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>レジ金合計</span>
                <span className={summaryStyles.value}>
                  ¥{grandTotal.toLocaleString()}
                </span>
              </div>
              <div className={summaryStyles.row}>
                <span className={summaryStyles.label}>売上合計（期待値）</span>
                <span className={summaryStyles.value}>
                  ¥{expectedTotal.toLocaleString()}
                </span>
              </div>

              <div
                className={`${summaryStyles.differenceRow} ${
                  difference > 0
                    ? summaryStyles.differencePositive
                    : difference < 0
                      ? summaryStyles.differenceNegative
                      : summaryStyles.differenceZero
                }`}
              >
                <span className={summaryStyles.differenceLabel}>差異</span>
                <span className={summaryStyles.differenceValue}>
                  {difference >= 0 ? "+" : ""}¥{difference.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          {/* 閉局ボタン */}
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={handleClose}
            disabled={isProcessing}
          >
            {isProcessing ? "処理中..." : "閉局を確定する"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/closing")({
  component: ClosingPage,
});
