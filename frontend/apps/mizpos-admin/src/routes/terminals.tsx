/**
 * 端末管理ページ
 * POS端末の登録・一覧・revoke機能を提供
 */

import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconPlus,
  IconQrcode,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthHeaders } from "../lib/api";

export const Route = createFileRoute("/terminals")({
  component: TerminalsPage,
});

// API Base URL
const API_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

interface Terminal {
  terminal_id: string;
  device_name: string;
  os: string;
  status: string;
  registered_by: string;
  registered_at: string;
  revoked_at?: string;
  last_seen_at?: string;
}

interface RegistrationQrPayload {
  v: number;
  terminal_id: string;
  public_key: string;
  device_name: string;
  os: string;
  created_at: string;
}

function TerminalsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<RegistrationQrPayload | null>(
    null
  );
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Terminal | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 端末一覧取得
  const {
    data: terminals = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ["terminals"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/accounts/terminals`, {
        headers,
      });
      if (!response.ok) {
        throw new Error("端末一覧の取得に失敗しました");
      }
      const data = await response.json();
      return (data.terminals || []) as Terminal[];
    },
  });

  // 端末登録
  const registerMutation = useMutation({
    mutationFn: async (payload: RegistrationQrPayload) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/accounts/terminals`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          terminal_id: payload.terminal_id,
          public_key: payload.public_key,
          device_name: payload.device_name,
          os: payload.os,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "端末の登録に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals"] });
      setScannedData(null);
      setIsConfirmOpen(false);
      setIsScannerOpen(false);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // 端末revoke
  const revokeMutation = useMutation({
    mutationFn: async (terminalId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/accounts/terminals/${terminalId}`,
        {
          method: "DELETE",
          headers,
        }
      );
      if (!response.ok) {
        throw new Error("端末の無効化に失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["terminals"] });
      setRevokeTarget(null);
    },
    onError: (error: Error) => {
      setError(error.message);
    },
  });

  // QRコードスキャン処理
  const handleScan = (result: { rawValue: string }[]) => {
    if (result.length === 0) return;

    try {
      const data = JSON.parse(result[0].rawValue) as RegistrationQrPayload;

      // バリデーション
      if (!data.v || !data.terminal_id || !data.public_key) {
        setError("無効なQRコードです");
        return;
      }

      setScannedData(data);
      setIsConfirmOpen(true);
      setIsScannerOpen(false);
    } catch {
      setError("QRコードの解析に失敗しました");
    }
  };

  // 検索フィルタ
  const filteredTerminals = terminals.filter(
    (t) =>
      t.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.terminal_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // OS アイコン
  const getOsIcon = (os: string) => {
    switch (os) {
      case "android":
        return <IconDeviceMobile size={18} />;
      default:
        return <IconDeviceDesktop size={18} />;
    }
  };

  // ステータスバッジ
  const getStatusBadge = (status: string) => {
    const isActive = status === "active";
    return (
      <span
        className={css({
          padding: "4px 12px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: 500,
          background: isActive ? "#e8f5e9" : "#ffebee",
          color: isActive ? "#2e7d32" : "#c62828",
        })}
      >
        {isActive ? "有効" : "無効"}
      </span>
    );
  };

  return (
    <div className={css({ padding: "24px" })}>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        })}
      >
        <h1 className={css({ fontSize: "24px", fontWeight: 700, margin: 0 })}>
          端末管理
        </h1>
        <Button onClick={() => setIsScannerOpen(true)}>
          <IconQrcode size={18} />
          QRスキャンで登録
        </Button>
      </div>

      {error && (
        <div
          className={css({
            background: "#ffebee",
            color: "#c62828",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={css({
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "18px",
            })}
          >
            ×
          </button>
        </div>
      )}

      {/* 検索 */}
      <div className={css({ marginBottom: "16px" })}>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#f5f5f5",
            padding: "8px 16px",
            borderRadius: "8px",
            maxWidth: "400px",
          })}
        >
          <IconSearch size={18} color="#999" />
          <input
            type="text"
            placeholder="端末名やIDで検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={css({
              flex: 1,
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "14px",
            })}
          />
        </div>
      </div>

      {/* 一覧テーブル */}
      {isLoading ? (
        <div className={css({ textAlign: "center", padding: "48px" })}>
          読み込み中...
        </div>
      ) : fetchError ? (
        <div
          className={css({
            textAlign: "center",
            padding: "48px",
            color: "#c62828",
          })}
        >
          エラーが発生しました
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>端末名</th>
              <th>OS</th>
              <th>ステータス</th>
              <th>登録日時</th>
              <th>最終アクセス</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTerminals.length === 0 ? (
              <tr>
                <td colSpan={6} className={css({ textAlign: "center" })}>
                  端末がありません
                </td>
              </tr>
            ) : (
              filteredTerminals.map((terminal) => (
                <tr key={terminal.terminal_id}>
                  <td>
                    <div>
                      <div className={css({ fontWeight: 500 })}>
                        {terminal.device_name}
                      </div>
                      <div
                        className={css({
                          fontSize: "11px",
                          color: "#999",
                          fontFamily: "monospace",
                        })}
                      >
                        {terminal.terminal_id.slice(0, 8)}...
                      </div>
                    </div>
                  </td>
                  <td>
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      })}
                    >
                      {getOsIcon(terminal.os)}
                      {terminal.os}
                    </div>
                  </td>
                  <td>{getStatusBadge(terminal.status)}</td>
                  <td>
                    {new Date(terminal.registered_at).toLocaleDateString(
                      "ja-JP"
                    )}
                  </td>
                  <td>
                    {terminal.last_seen_at
                      ? new Date(terminal.last_seen_at).toLocaleString("ja-JP")
                      : "-"}
                  </td>
                  <td>
                    {terminal.status === "active" && (
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(terminal)}
                        className={css({
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#c62828",
                          padding: "4px",
                          "&:hover": { opacity: 0.7 },
                        })}
                        title="無効化"
                      >
                        <IconTrash size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}

      {/* QRスキャナーモーダル */}
      <Modal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        title="端末QRコードをスキャン"
      >
        <div className={css({ padding: "16px" })}>
          <p
            className={css({
              marginBottom: "16px",
              color: "#666",
              fontSize: "14px",
            })}
          >
            POS端末に表示されているQRコードをスキャンしてください
          </p>
          <div
            className={css({
              width: "100%",
              maxWidth: "400px",
              margin: "0 auto",
            })}
          >
            <Scanner
              onScan={handleScan}
              styles={{
                container: { width: "100%" },
              }}
            />
          </div>
        </div>
      </Modal>

      {/* 登録確認モーダル */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setScannedData(null);
        }}
        title="端末を登録しますか？"
      >
        {scannedData && (
          <div className={css({ padding: "16px" })}>
            <div
              className={css({
                background: "#f5f5f5",
                padding: "16px",
                borderRadius: "8px",
                marginBottom: "16px",
              })}
            >
              <div
                className={css({
                  display: "grid",
                  gap: "12px",
                })}
              >
                <div>
                  <span className={css({ color: "#999", fontSize: "12px" })}>
                    端末名
                  </span>
                  <div className={css({ fontWeight: 500 })}>
                    {scannedData.device_name}
                  </div>
                </div>
                <div>
                  <span className={css({ color: "#999", fontSize: "12px" })}>
                    OS
                  </span>
                  <div>{scannedData.os}</div>
                </div>
                <div>
                  <span className={css({ color: "#999", fontSize: "12px" })}>
                    端末ID
                  </span>
                  <div
                    className={css({
                      fontSize: "11px",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    })}
                  >
                    {scannedData.terminal_id}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={css({
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              })}
            >
              <Button
                variant="secondary"
                onClick={() => {
                  setIsConfirmOpen(false);
                  setScannedData(null);
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={() => registerMutation.mutate(scannedData)}
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "登録中..." : "登録する"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* revoke確認モーダル */}
      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="端末を無効化しますか？"
      >
        {revokeTarget && (
          <div className={css({ padding: "16px" })}>
            <p className={css({ marginBottom: "16px", color: "#666" })}>
              「{revokeTarget.device_name}」を無効化すると、この端末からの
              認証が拒否されるようになります。この操作は取り消せません。
            </p>

            <div
              className={css({
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              })}
            >
              <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
                キャンセル
              </Button>
              <Button
                variant="danger"
                onClick={() => revokeMutation.mutate(revokeTarget.terminal_id)}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending ? "処理中..." : "無効化する"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
