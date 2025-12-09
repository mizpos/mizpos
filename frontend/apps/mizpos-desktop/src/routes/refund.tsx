import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button, Card, Input } from "../components/ui";
import { useAuthStore } from "../stores/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 販売データの型
interface SaleItem {
  product_id: string;
  product_name?: string;
  circle_name?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Sale {
  sale_id: string;
  timestamp: number;
  items: SaleItem[];
  total_amount: number;
  payment_method: string;
  status: string;
  employee_number: string;
  terminal_id?: string;
  event_id?: string;
}

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
  description: css({
    fontSize: "14px",
    color: "#94a3b8",
    marginBottom: "20px",
    lineHeight: 1.6,
  }),
};

// 販売詳細スタイル
const saleStyles = {
  infoRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #334155",
  }),
  label: css({
    fontSize: "14px",
    color: "#94a3b8",
  }),
  value: css({
    fontSize: "14px",
    fontWeight: 500,
    color: "#f8fafc",
  }),
  itemsTable: css({
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "16px",
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
    fontSize: "14px",
    color: "#f8fafc",
  }),
  totalRow: css({
    background: "#14532d",
  }),
  totalCell: css({
    padding: "16px 12px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#86efac",
  }),
  statusRefunded: css({
    color: "#f87171",
    fontWeight: 600,
  }),
};

// 警告スタイル
const warningStyles = {
  container: css({
    padding: "16px",
    background: "rgba(251, 191, 36, 0.1)",
    border: "1px solid #f59e0b",
    borderRadius: "10px",
    marginBottom: "16px",
  }),
  text: css({
    fontSize: "14px",
    color: "#fcd34d",
    margin: 0,
    lineHeight: 1.6,
  }),
};

// エラースタイル
const errorStyles = {
  container: css({
    padding: "16px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #dc2626",
    borderRadius: "10px",
  }),
  text: css({
    fontSize: "14px",
    color: "#fca5a5",
    margin: 0,
  }),
};

function RefundPage() {
  const navigate = useNavigate();
  const { session } = useAuthStore();

  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // 未ログイン時・権限不足時はリダイレクト
  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
      return;
    }
    if (session.role !== "manager") {
      alert("返金処理は職長権限が必要です。");
      navigate({ to: "/settings" });
    }
  }, [session, navigate]);

  // レシート番号で販売データを検索
  const handleSearch = useCallback(async () => {
    if (!saleId.trim()) {
      setError("レシート番号を入力してください");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSale(null);

    try {
      const response = await fetch(`${API_BASE_URL}/pos/sales/${saleId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-POS-Session": session?.sessionId || "",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("販売データが見つかりません");
        } else {
          const errorData = await response.json();
          setError(errorData.detail || "販売データの取得に失敗しました");
        }
        return;
      }

      const data = await response.json();
      setSale(data.sale);
    } catch (err) {
      console.error("Failed to fetch sale:", err);
      setError("ネットワークエラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [saleId, session]);

  // 返金処理
  const handleRefund = useCallback(async () => {
    if (!sale || !session) return;

    if (sale.status === "refunded") {
      setError("この販売は既に返金済みです");
      return;
    }

    const confirmed = await confirm(
      `以下の販売を返金します：\n\n` +
        `レシート番号: ${sale.sale_id}\n` +
        `返金額: ¥${sale.total_amount.toLocaleString()}\n` +
        `商品数: ${sale.items.length}点\n\n` +
        `この操作は取り消せません。`,
      {
        title: "返金処理を実行しますか？",
        kind: "warning",
        okLabel: "返金する",
        cancelLabel: "キャンセル",
      },
    );

    if (!confirmed) return;

    setIsProcessing(true);
    setError(null);

    try {
      const refundItems = sale.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product_name: item.product_name,
      }));

      const response = await fetch(`${API_BASE_URL}/pos/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-POS-Session": session.sessionId,
        },
        body: JSON.stringify({
          original_sale_id: sale.sale_id,
          items: refundItems,
          refund_amount: sale.total_amount,
          reason: reason || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail || "返金処理に失敗しました");
        return;
      }

      const result = await response.json();

      alert(
        `返金処理が完了しました\n\n` +
          `返金ID: ${result.refund_id}\n` +
          `返金額: ¥${result.refund_amount.toLocaleString()}`,
      );

      // 返金後は画面をリセット
      setSaleId("");
      setSale(null);
      setReason("");
    } catch (err) {
      console.error("Failed to process refund:", err);
      setError("ネットワークエラーが発生しました");
    } finally {
      setIsProcessing(false);
    }
  }, [sale, session, reason]);

  // 戻る
  const handleBack = useCallback(() => {
    navigate({ to: "/settings" });
  }, [navigate]);

  // 支払い方法の日本語変換
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: "現金",
      oya_cashless: "大家キャッシュレス",
      voucher_department: "百貨店商品券",
      voucher_event: "イベント主催者発行商品券",
    };
    return labels[method] || method;
  };

  // 日時フォーマット
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!session || session.role !== "manager") {
    return null;
  }

  return (
    <div className={pageStyles.container}>
      {/* ヘッダー */}
      <header className={pageStyles.header}>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← 戻る
        </Button>
        <h1 className={pageStyles.title}>返金処理</h1>
      </header>

      {/* コンテンツ */}
      <div className={pageStyles.content}>
        <div className={pageStyles.contentInner}>
          {/* 警告 */}
          <div className={warningStyles.container}>
            <p className={warningStyles.text}>
              返金処理を行うと、販売データが返金済みにマークされ、在庫が戻ります。
              <br />
              この操作は取り消せません。慎重に操作してください。
            </p>
          </div>

          {/* レシート番号入力 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>レシート番号で検索</h2>
            <p className={sectionStyles.description}>
              返金対象のレシート番号（sale_id）を入力してください。
              レシートに印刷されているID、または販売履歴から確認できます。
            </p>
            <div
              className={css({
                display: "flex",
                gap: "12px",
                alignItems: "flex-end",
              })}
            >
              <div className={css({ flex: 1 })}>
                <Input
                  label="レシート番号"
                  value={saleId}
                  onChange={(e) => setSaleId(e.target.value)}
                  placeholder="例: 12345678-1234-1234-1234-123456789012"
                />
              </div>
              <Button
                variant="primary"
                onClick={handleSearch}
                disabled={isLoading || !saleId.trim()}
              >
                {isLoading ? "検索中..." : "検索"}
              </Button>
            </div>
          </Card>

          {/* エラー表示 */}
          {error && (
            <div className={errorStyles.container}>
              <p className={errorStyles.text}>{error}</p>
            </div>
          )}

          {/* 販売データ表示 */}
          {sale && (
            <>
              <Card padding="lg">
                <h2 className={sectionStyles.title}>販売情報</h2>

                {sale.status === "refunded" && (
                  <div
                    className={css({
                      padding: "12px",
                      background: "rgba(239, 68, 68, 0.1)",
                      border: "1px solid #dc2626",
                      borderRadius: "8px",
                      marginBottom: "16px",
                    })}
                  >
                    <p
                      className={css({
                        margin: 0,
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#f87171",
                      })}
                    >
                      この販売は既に返金済みです
                    </p>
                  </div>
                )}

                <div className={saleStyles.infoRow}>
                  <span className={saleStyles.label}>レシート番号</span>
                  <span
                    className={css({
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "#94a3b8",
                    })}
                  >
                    {sale.sale_id}
                  </span>
                </div>
                <div className={saleStyles.infoRow}>
                  <span className={saleStyles.label}>販売日時</span>
                  <span className={saleStyles.value}>
                    {formatTimestamp(sale.timestamp)}
                  </span>
                </div>
                <div className={saleStyles.infoRow}>
                  <span className={saleStyles.label}>従業員番号</span>
                  <span className={saleStyles.value}>
                    {sale.employee_number}
                  </span>
                </div>
                <div className={saleStyles.infoRow}>
                  <span className={saleStyles.label}>支払い方法</span>
                  <span className={saleStyles.value}>
                    {getPaymentMethodLabel(sale.payment_method)}
                  </span>
                </div>
                <div className={saleStyles.infoRow}>
                  <span className={saleStyles.label}>ステータス</span>
                  <span
                    className={
                      sale.status === "refunded"
                        ? saleStyles.statusRefunded
                        : saleStyles.value
                    }
                  >
                    {sale.status === "completed"
                      ? "完了"
                      : sale.status === "refunded"
                        ? "返金済み"
                        : sale.status}
                  </span>
                </div>

                {/* 商品一覧 */}
                <table className={saleStyles.itemsTable}>
                  <thead>
                    <tr className={saleStyles.headerRow}>
                      <th className={saleStyles.headerCell}>商品名</th>
                      <th className={saleStyles.headerCell}>単価</th>
                      <th className={saleStyles.headerCell}>数量</th>
                      <th
                        className={saleStyles.headerCell}
                        style={{ textAlign: "right" }}
                      >
                        小計
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item, index) => (
                      <tr key={`item-${index}`} className={saleStyles.row}>
                        <td className={saleStyles.cell}>
                          {item.product_name || item.product_id}
                          {item.circle_name && (
                            <span
                              className={css({
                                display: "block",
                                fontSize: "12px",
                                color: "#64748b",
                              })}
                            >
                              {item.circle_name}
                            </span>
                          )}
                        </td>
                        <td className={saleStyles.cell}>
                          ¥{item.unit_price.toLocaleString()}
                        </td>
                        <td className={saleStyles.cell}>{item.quantity}</td>
                        <td
                          className={saleStyles.cell}
                          style={{ textAlign: "right", fontFamily: "monospace" }}
                        >
                          ¥{item.subtotal.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className={saleStyles.totalRow}>
                      <td className={saleStyles.totalCell} colSpan={3}>
                        合計（返金額）
                      </td>
                      <td
                        className={saleStyles.totalCell}
                        style={{ textAlign: "right" }}
                      >
                        ¥{sale.total_amount.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              {/* 返金理由入力 */}
              {sale.status !== "refunded" && (
                <Card padding="lg">
                  <h2 className={sectionStyles.title}>返金理由（任意）</h2>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="例: 商品の不良、お客様都合による返品など"
                  />
                </Card>
              )}

              {/* 返金ボタン */}
              {sale.status !== "refunded" && (
                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={handleRefund}
                  disabled={isProcessing}
                  className={css({
                    background: "#dc2626 !important",
                    _hover: {
                      background: "#b91c1c !important",
                    },
                  })}
                >
                  {isProcessing
                    ? "処理中..."
                    : `¥${sale.total_amount.toLocaleString()} を返金する`}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/refund")({
  component: RefundPage,
});
