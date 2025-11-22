/**
 * ステータスバー
 * ネットワーク状態、ログイン情報、同期状態を表示
 */

import { useAuthStore } from "../stores/auth";
import { useNetworkStore, formatLastOnlineTime } from "../stores/network";
import "./StatusBar.css";

export function StatusBar() {
  const { session, logout } = useAuthStore();
  const { status, syncStatus, lastOnlineTime, queueWarning } = useNetworkStore();

  const handleLogout = async () => {
    if (confirm("ログアウトしますか？")) {
      await logout();
    }
  };

  return (
    <header className="status-bar">
      <div className="status-bar-left">
        <h1 className="app-title">mizPOS</h1>

        {/* ネットワーク状態 */}
        <div className={`network-status status-${status}`}>
          <span className="status-indicator" />
          <span className="status-text">
            {status === "online" && "オンライン"}
            {status === "offline" && "オフライン"}
            {status === "checking" && "確認中..."}
          </span>
        </div>
      </div>

      <div className="status-bar-center">
        {/* 同期状態 */}
        {syncStatus.pendingCount > 0 && (
          <div className={`sync-status ${queueWarning ? "warning" : ""}`}>
            <span className="sync-icon">⏳</span>
            <span>未同期: {syncStatus.pendingCount}件</span>
            {syncStatus.isSyncing && <span className="syncing">同期中...</span>}
          </div>
        )}

        {status === "offline" && lastOnlineTime && (
          <div className="last-online">
            最終接続: {formatLastOnlineTime(lastOnlineTime)}
          </div>
        )}
      </div>

      <div className="status-bar-right">
        {/* ユーザー情報 */}
        {session && (
          <div className="user-info">
            <span className="user-name">{session.display_name}</span>
            <span className="user-id">({session.employee_number})</span>
            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              ログアウト
            </button>
          </div>
        )}

        {/* 現在時刻 */}
        <Clock />
      </div>
    </header>
  );
}

function Clock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return <div className="clock">{timeString}</div>;
}
