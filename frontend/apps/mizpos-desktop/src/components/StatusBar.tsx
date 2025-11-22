/**
 * ステータスバー
 * ネットワーク状態、ログイン情報、同期状態、本日の売上を表示
 */

import { useEffect, useState } from "react";
import { getTodaySales } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { formatLastOnlineTime, useNetworkStore } from "../stores/network";
import "./StatusBar.css";

export function StatusBar() {
  const { session, logout } = useAuthStore();
  const { status, syncStatus, lastOnlineTime, queueWarning } =
    useNetworkStore();
  const { lastSale } = useCartStore();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });

  // 本日の売上を取得・更新
  useEffect(() => {
    const updateTodaySales = async () => {
      const sales = await getTodaySales();
      const total = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
      setTodaySales({ count: sales.length, total });
    };

    lastSale && updateTodaySales();
  }, [lastSale]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
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

        {/* 本日の売上サマリー */}
        <div className="today-sales">
          <span className="sales-label">本日:</span>
          <span className="sales-count">{todaySales.count}件</span>
          <span className="sales-total">
            ¥{todaySales.total.toLocaleString()}
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
            {!syncStatus.isSyncing && status === "online" && (
              <button
                type="button"
                className="sync-button"
                onClick={() => useNetworkStore.getState().syncPendingSales()}
              >
                今すぐ同期
              </button>
            )}
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
            {showLogoutConfirm ? (
              <div className="logout-confirm">
                <span>ログアウトしますか？</span>
                <button
                  type="button"
                  className="logout-confirm-yes"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "処理中..." : "はい"}
                </button>
                <button
                  type="button"
                  className="logout-confirm-no"
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isLoggingOut}
                >
                  いいえ
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="logout-button"
                onClick={() => setShowLogoutConfirm(true)}
              >
                ログアウト
              </button>
            )}
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
