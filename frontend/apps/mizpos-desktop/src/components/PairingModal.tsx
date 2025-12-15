/**
 * Payment Terminal Pairing Modal
 *
 * QRコードとPINコードを表示してPayment Terminalとのペアリングを行う
 */

import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";
import { generateQRCodeData, usePairingStore } from "../stores/pairing";
import { useSettingsStore } from "../stores/settings";
import { Button, Modal } from "./ui";

const styles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "24px",
  }),
  statusBadge: css({
    padding: "8px 16px",
    borderRadius: "20px",
    fontSize: "14px",
    fontWeight: 600,
  }),
  statusDisconnected: css({
    background: "#334155",
    color: "#94a3b8",
  }),
  statusWaiting: css({
    background: "#1e40af",
    color: "#93c5fd",
    animation: "pulse 2s ease-in-out infinite",
  }),
  statusConnected: css({
    background: "#14532d",
    color: "#86efac",
  }),
  statusError: css({
    background: "#7f1d1d",
    color: "#fecaca",
  }),
  qrContainer: css({
    padding: "24px",
    background: "white",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
  }),
  pinContainer: css({
    textAlign: "center",
  }),
  pinLabel: css({
    fontSize: "14px",
    color: "#94a3b8",
    marginBottom: "8px",
  }),
  pinCode: css({
    fontSize: "48px",
    fontWeight: 700,
    fontFamily: "monospace",
    letterSpacing: "0.2em",
    color: "#f8fafc",
  }),
  instructions: css({
    textAlign: "center",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "320px",
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
  }),
  expiryInfo: css({
    fontSize: "12px",
    color: "#64748b",
    textAlign: "center",
  }),
};

interface PairingModalProps {
  open: boolean;
  onClose: () => void;
}

export function PairingModal({ open, onClose }: PairingModalProps) {
  const {
    status,
    pairingInfo,
    error,
    registerPairing,
    unregisterPairing,
    clearError,
    startPairingStatusPolling,
    stopPairingStatusPolling,
  } = usePairingStore();
  const { settings } = useSettingsStore();

  const [isRegistering, setIsRegistering] = useState(false);
  const hasStartedRegistration = useRef(false);

  const handleRegister = useCallback(async () => {
    setIsRegistering(true);
    clearError();

    try {
      await registerPairing(
        settings.terminalId || "unknown",
        settings.deviceName || "mizPOS Desktop",
        settings.eventId,
        settings.eventName,
      );
    } catch (err) {
      console.error("Failed to register pairing:", err);
    } finally {
      setIsRegistering(false);
    }
  }, [
    registerPairing,
    clearError,
    settings.terminalId,
    settings.deviceName,
    settings.eventId,
    settings.eventName,
  ]);

  // モーダルを開いた時に自動でペアリング登録
  useEffect(() => {
    if (open && status === "disconnected" && !isRegistering && !hasStartedRegistration.current) {
      hasStartedRegistration.current = true;
      handleRegister();
    }
    if (!open) {
      hasStartedRegistration.current = false;
    }
  }, [open, status, isRegistering, handleRegister]);

  // statusが"waiting"になったらポーリング開始、それ以外で停止
  useEffect(() => {
    if (status === "waiting") {
      startPairingStatusPolling();
    } else {
      stopPairingStatusPolling();
    }
  }, [status, startPairingStatusPolling, stopPairingStatusPolling]);

  const handleUnregister = useCallback(async () => {
    await unregisterPairing();
  }, [unregisterPairing]);

  const handleClose = useCallback(() => {
    // ペアリング中の場合は解除
    if (status === "waiting") {
      handleUnregister();
    }
    onClose();
  }, [status, handleUnregister, onClose]);

  const getStatusText = () => {
    switch (status) {
      case "disconnected":
        return "未接続";
      case "registering":
        return "登録中...";
      case "waiting":
        return "ターミナル接続待ち";
      case "connected":
        return "接続済み";
      case "error":
        return "エラー";
      default:
        return "";
    }
  };

  const getStatusStyle = () => {
    switch (status) {
      case "waiting":
        return styles.statusWaiting;
      case "connected":
        return styles.statusConnected;
      case "error":
        return styles.statusError;
      default:
        return styles.statusDisconnected;
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Payment Terminal 接続"
      maxWidth="400px"
    >
      <div className={styles.container}>
        {/* ステータスバッジ */}
        <div className={`${styles.statusBadge} ${getStatusStyle()}`}>
          {getStatusText()}
        </div>

        {/* エラーメッセージ */}
        {error && <div className={styles.errorMessage}>{error}</div>}

        {/* QRコードとPINコード */}
        {pairingInfo && status === "waiting" && (
          <>
            <div className={styles.qrContainer}>
              <QRCodeSVG
                value={generateQRCodeData(pairingInfo.pinCode)}
                size={200}
                level="M"
              />
            </div>

            <div className={styles.pinContainer}>
              <div className={styles.pinLabel}>または PINコードを入力</div>
              <div className={styles.pinCode}>{pairingInfo.pinCode}</div>
            </div>

            <div className={styles.instructions}>
              Payment Terminal アプリでQRコードをスキャンするか、
              PINコードを入力してペアリングしてください。
            </div>

            <div className={styles.expiryInfo}>
              有効期限: {pairingInfo.expiresAt.toLocaleTimeString()}
            </div>
          </>
        )}

        {/* 接続済み */}
        {status === "connected" && (
          <div className={styles.instructions}>
            Payment Terminal と接続されています。
            <br />
            キャッシュレス決済時に自動で連携されます。
          </div>
        )}

        {/* 未接続時 */}
        {status === "disconnected" && !isRegistering && (
          <div className={styles.instructions}>
            Payment Terminal と接続するには、
            <br />
            下のボタンをクリックしてください。
          </div>
        )}

        {/* アクションボタン */}
        <div className={styles.actions}>
          {status === "disconnected" && (
            <Button
              variant="primary"
              onClick={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? "登録中..." : "ペアリング開始"}
            </Button>
          )}

          {status === "waiting" && (
            <Button variant="outlineDanger" onClick={handleUnregister}>
              キャンセル
            </Button>
          )}

          {status === "connected" && (
            <Button variant="outlineDanger" onClick={handleUnregister}>
              接続解除
            </Button>
          )}

          <Button variant="outline" onClick={handleClose}>
            閉じる
          </Button>
        </div>
      </div>
    </Modal>
  );
}
