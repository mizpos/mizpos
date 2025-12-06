import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { useTerminalStore } from "../stores/terminal";

function RegisterTerminalPage() {
  const navigate = useNavigate();
  const {
    status,
    terminalId,
    isRegisteredOnServer,
    initializeTerminal,
    generateQrData,
    checkServerRegistration,
    clearKeychain,
  } = useTerminalStore();

  const [deviceName, setDeviceName] = useState("POS端末");
  const [qrData, setQrData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QRコードを生成
  const generateQr = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateQrData(deviceName);
      setQrData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "QRコード生成に失敗しました",
      );
    } finally {
      setIsLoading(false);
    }
  }, [deviceName, generateQrData]);

  // 初回マウント時にQRコードを生成
  useEffect(() => {
    if (status === "initialized" && !qrData) {
      generateQr();
    } else if (status === "uninitialized") {
      // 初期化
      initializeTerminal(deviceName)
        .then(() => generateQr())
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "端末の初期化に失敗しました",
          );
        });
    }
  }, [status, qrData, generateQr, initializeTerminal, deviceName]);

  // 定期的にサーバー登録状態を確認
  useEffect(() => {
    if (status !== "initialized" && status !== "uninitialized") {
      return;
    }

    const checkInterval = setInterval(async () => {
      const registered = await checkServerRegistration();
      if (registered) {
        clearInterval(checkInterval);
        // 登録完了後、ログイン画面へ
        navigate({ to: "/login" });
      }
    }, 3000); // 3秒ごとにチェック

    return () => clearInterval(checkInterval);
  }, [status, checkServerRegistration, navigate]);

  // 登録済みならログイン画面へリダイレクト
  useEffect(() => {
    if (isRegisteredOnServer || status === "registered") {
      navigate({ to: "/login" });
    }
  }, [isRegisteredOnServer, status, navigate]);

  // リセットボタン
  const handleReset = async () => {
    if (
      window.confirm(
        "端末の登録情報をリセットしますか？\nこの操作は取り消せません。",
      )
    ) {
      try {
        await clearKeychain();
        setQrData(null);
        await initializeTerminal(deviceName);
        await generateQr();
      } catch (err) {
        setError(err instanceof Error ? err.message : "リセットに失敗しました");
      }
    }
  };

  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1a237e 0%, #3949ab 100%)",
        padding: "24px",
      })}
    >
      <div
        className={css({
          background: "white",
          borderRadius: "16px",
          padding: "48px",
          maxWidth: "500px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
        })}
      >
        <h1
          className={css({
            fontSize: "28px",
            fontWeight: 700,
            color: "#1a237e",
            marginBottom: "8px",
          })}
        >
          端末登録
        </h1>

        <p
          className={css({
            fontSize: "14px",
            color: "#666",
            marginBottom: "32px",
          })}
        >
          管理画面でこのQRコードをスキャンして
          <br />
          端末を登録してください
        </p>

        {error && (
          <div
            className={css({
              background: "#ffebee",
              color: "#c62828",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "24px",
              fontSize: "14px",
            })}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div
            className={css({
              padding: "64px",
              color: "#666",
            })}
          >
            QRコードを生成中...
          </div>
        ) : qrData ? (
          <div
            className={css({
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              border: "2px solid #e0e0e0",
              display: "inline-block",
              marginBottom: "24px",
            })}
          >
            <QRCodeSVG
              value={qrData}
              size={256}
              level="M"
              includeMargin={false}
            />
          </div>
        ) : null}

        {terminalId && (
          <div
            className={css({
              marginTop: "16px",
              padding: "12px",
              background: "#f5f5f5",
              borderRadius: "8px",
            })}
          >
            <p
              className={css({
                fontSize: "12px",
                color: "#999",
                margin: "0 0 4px 0",
              })}
            >
              端末ID
            </p>
            <p
              className={css({
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#333",
                margin: 0,
                wordBreak: "break-all",
              })}
            >
              {terminalId}
            </p>
          </div>
        )}

        <div
          className={css({
            marginTop: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "8px",
            })}
          >
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="端末名"
              className={css({
                flex: 1,
                padding: "12px 16px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "14px",
              })}
            />
            <button
              type="button"
              onClick={generateQr}
              disabled={isLoading}
              className={css({
                padding: "12px 24px",
                background: "#3949ab",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                "&:hover": {
                  background: "#303f9f",
                },
                "&:disabled": {
                  background: "#ccc",
                  cursor: "not-allowed",
                },
              })}
            >
              更新
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className={css({
              padding: "12px 24px",
              background: "transparent",
              color: "#c62828",
              border: "1px solid #c62828",
              borderRadius: "8px",
              fontSize: "14px",
              cursor: "pointer",
              "&:hover": {
                background: "#ffebee",
              },
            })}
          >
            リセット
          </button>
        </div>

        <p
          className={css({
            marginTop: "24px",
            fontSize: "12px",
            color: "#999",
          })}
        >
          登録が完了すると自動的にログイン画面に移動します
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/register-terminal")({
  component: RegisterTerminalPage,
});
