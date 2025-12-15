/**
 * Terminal Payment Modal
 *
 * Payment Terminalでの決済処理を表示・管理するモーダル
 */

import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { usePairingStore } from "../stores/pairing";
import { Button, Modal } from "./ui";

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
    padding: "16px 0",
  }),
  amountContainer: css({
    textAlign: "center",
    padding: "24px",
    background: "#0f172a",
    borderRadius: "14px",
    width: "100%",
  }),
  amountLabel: css({
    fontSize: "14px",
    color: "#64748b",
    marginBottom: "8px",
  }),
  amount: css({
    fontSize: "48px",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#f8fafc",
  }),
  statusContainer: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
  }),
  spinner: css({
    width: "48px",
    height: "48px",
    border: "4px solid #334155",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  }),
  statusText: css({
    fontSize: "18px",
    fontWeight: 600,
    color: "#f8fafc",
    textAlign: "center",
  }),
  statusDescription: css({
    fontSize: "14px",
    color: "#94a3b8",
    textAlign: "center",
    maxWidth: "280px",
  }),
  successIcon: css({
    fontSize: "64px",
    animation: "pulse 0.5s ease-out",
  }),
  errorIcon: css({
    fontSize: "64px",
  }),
  errorMessage: css({
    padding: "12px 16px",
    background: "#7f1d1d",
    borderRadius: "8px",
    color: "#fecaca",
    fontSize: "14px",
    textAlign: "center",
  }),
  actions: css({
    display: "flex",
    gap: "12px",
    width: "100%",
    justifyContent: "center",
    marginTop: "8px",
  }),
};

interface TerminalPaymentModalProps {
  open: boolean;
  amount: number;
  items?: Array<{ name: string; quantity: number; price: number }>;
  saleId?: string;
  description?: string;
  onComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
}

type PaymentState =
  | "creating"
  | "waiting"
  | "processing"
  | "completed"
  | "cancelled"
  | "failed"
  | "error";

export function TerminalPaymentModal({
  open,
  amount,
  items,
  saleId,
  description,
  onComplete,
  onCancel,
}: TerminalPaymentModalProps) {
  const {
    currentPaymentRequest,
    createPaymentRequest,
    cancelPaymentRequest,
    startPolling,
    stopPolling,
    error,
    clearError,
  } = usePairingStore();

  const [paymentState, setPaymentState] = useState<PaymentState>("creating");
  const [localError, setLocalError] = useState<string | null>(null);
  const handleCreateRequest = useCallback(async () => {
    setPaymentState("creating");
    setLocalError(null);
    clearError();

    try {
      await createPaymentRequest(amount, items, saleId, description);
      startPolling();
    } catch (err) {
      setPaymentState("error");
      setLocalError(
        err instanceof Error
          ? err.message
          : "決済リクエストの作成に失敗しました",
      );
    }
  }, [
    amount,
    items,
    saleId,
    description,
    createPaymentRequest,
    startPolling,
    clearError,
  ]);

  // モーダルを開いた時に決済リクエストを作成
  useEffect(() => {
    if (open) {
      handleCreateRequest();
    }

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, handleCreateRequest, stopPolling]);

  // 決済リクエストの状態を監視
  useEffect(() => {
    if (!currentPaymentRequest) return;

    switch (currentPaymentRequest.status) {
      case "pending":
        setPaymentState("waiting");
        break;
      case "processing":
        setPaymentState("processing");
        break;
      case "completed":
        setPaymentState("completed");
        // 完了後に親コンポーネントに通知
        if (currentPaymentRequest.paymentIntentId) {
          setTimeout(() => {
            onComplete(currentPaymentRequest.paymentIntentId!);
          }, 1500);
        }
        break;
      case "cancelled":
        setPaymentState("cancelled");
        break;
      case "failed":
        setPaymentState("failed");
        setLocalError(
          currentPaymentRequest.errorMessage || "決済に失敗しました",
        );
        break;
    }
  }, [currentPaymentRequest, onComplete]);

  const handleCancel = useCallback(async () => {
    stopPolling();
    await cancelPaymentRequest();
    onCancel();
  }, [stopPolling, cancelPaymentRequest, onCancel]);

  const handleRetry = useCallback(() => {
    handleCreateRequest();
  }, [handleCreateRequest]);

  const getStatusContent = () => {
    switch (paymentState) {
      case "creating":
        return {
          icon: <div className={styles.spinner} />,
          text: "決済リクエスト作成中...",
          description: "しばらくお待ちください",
        };
      case "waiting":
        return {
          icon: <div className={styles.spinner} />,
          text: "ターミナルで決済待ち",
          description:
            "Payment Terminal でカードをタップまたは挿入してください",
        };
      case "processing":
        return {
          icon: <div className={styles.spinner} />,
          text: "決済処理中...",
          description: "カードを離さないでください",
        };
      case "completed":
        return {
          icon: <span className={styles.successIcon}>✓</span>,
          text: "決済完了",
          description: "お支払いありがとうございました",
        };
      case "cancelled":
        return {
          icon: <span className={styles.errorIcon}>✕</span>,
          text: "キャンセルされました",
          description: "決済がキャンセルされました",
        };
      case "failed":
      case "error":
        return {
          icon: <span className={styles.errorIcon}>⚠</span>,
          text: "エラーが発生しました",
          description: localError || error || "もう一度お試しください",
        };
      default:
        return {
          icon: null,
          text: "",
          description: "",
        };
    }
  };

  const statusContent = getStatusContent();
  const canCancel =
    paymentState === "creating" ||
    paymentState === "waiting" ||
    paymentState === "processing";
  const canRetry = paymentState === "failed" || paymentState === "error";
  const canClose = paymentState === "completed" || paymentState === "cancelled";

  return (
    <Modal
      open={open}
      onClose={canClose ? onCancel : undefined}
      title="カード決済"
      maxWidth="400px"
      disableClose={!canClose}
    >
      <div className={styles.container}>
        {/* 金額表示 */}
        <div className={styles.amountContainer}>
          <div className={styles.amountLabel}>決済金額</div>
          <div className={styles.amount}>¥{amount.toLocaleString()}</div>
        </div>

        {/* ステータス表示 */}
        <div className={styles.statusContainer}>
          {statusContent.icon}
          <div className={styles.statusText}>{statusContent.text}</div>
          <div className={styles.statusDescription}>
            {statusContent.description}
          </div>
        </div>

        {/* エラーメッセージ */}
        {(paymentState === "failed" || paymentState === "error") &&
          (localError || error) && (
            <div className={styles.errorMessage}>{localError || error}</div>
          )}

        {/* アクションボタン */}
        <div className={styles.actions}>
          {canCancel && (
            <Button variant="outlineDanger" onClick={handleCancel}>
              キャンセル
            </Button>
          )}

          {canRetry && (
            <>
              <Button variant="primary" onClick={handleRetry}>
                再試行
              </Button>
              <Button variant="outline" onClick={onCancel}>
                閉じる
              </Button>
            </>
          )}

          {canClose && (
            <Button variant="primary" onClick={onCancel}>
              閉じる
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
