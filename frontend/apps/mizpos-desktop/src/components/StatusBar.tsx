import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { getTodaySales } from "../lib/db";
import { useAuthStore } from "../stores/auth";
import { useCartStore } from "../stores/cart";
import { formatLastOnlineTime, useNetworkStore } from "../stores/network";

const styles = {
  statusBar: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    background: "#1a237e",
    color: "white",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
  }),
  section: css({
    display: "flex",
    alignItems: "center",
    gap: "16px",
  }),
  sectionCenter: css({
    flex: 1,
    justifyContent: "center",
  }),
  appTitle: css({
    fontSize: "20px",
    fontWeight: 700,
    margin: 0,
  }),
  networkStatus: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: 500,
  }),
  statusOnline: css({
    background: "rgba(76, 175, 80, 0.2)",
  }),
  statusOffline: css({
    background: "rgba(244, 67, 54, 0.2)",
  }),
  statusChecking: css({
    background: "rgba(255, 193, 7, 0.2)",
  }),
  indicator: css({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  }),
  indicatorOnline: css({
    background: "#4caf50",
    boxShadow: "0 0 8px #4caf50",
  }),
  indicatorOffline: css({
    background: "#f44336",
    boxShadow: "0 0 8px #f44336",
  }),
  indicatorChecking: css({
    background: "#ffc107",
    animationName: "pulse",
    animationDuration: "1s",
    animationIterationCount: "infinite",
  }),
  syncStatus: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    fontSize: "13px",
  }),
  syncWarning: css({
    background: "rgba(255, 152, 0, 0.3)",
    color: "#fff3e0",
  }),
  syncIcon: css({ fontSize: "16px" }),
  syncing: css({ color: "#81d4fa", fontSize: "12px" }),
  syncButton: css({
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 500,
    color: "white",
    background: "rgba(76, 175, 80, 0.8)",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      background: "rgba(76, 175, 80, 1)",
    },
  }),
  todaySales: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    fontSize: "13px",
  }),
  salesLabel: css({ color: "rgba(255, 255, 255, 0.7)" }),
  salesCount: css({ fontWeight: 500 }),
  salesTotal: css({ fontWeight: 700, color: "#81c784" }),
  lastOnline: css({ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }),
  userInfo: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }),
  userName: css({ fontWeight: 600 }),
  userId: css({ fontSize: "12px", color: "rgba(255, 255, 255, 0.7)" }),
  logoutButton: css({
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 500,
    color: "white",
    background: "rgba(255, 255, 255, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: {
      background: "rgba(255, 255, 255, 0.3)",
    },
  }),
  logoutConfirm: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "rgba(244, 67, 54, 0.2)",
    borderRadius: "8px",
    fontSize: "12px",
  }),
  logoutConfirmYes: css({
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 500,
    color: "white",
    background: "#f44336",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: { background: "#d32f2f" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
  }),
  logoutConfirmNo: css({
    padding: "4px 10px",
    fontSize: "12px",
    fontWeight: 500,
    color: "white",
    background: "rgba(255, 255, 255, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 0.2s",
    _hover: { background: "rgba(255, 255, 255, 0.3)" },
    _disabled: { opacity: 0.5, cursor: "not-allowed" },
  }),
  clock: css({
    fontSize: "18px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    minWidth: "60px",
    textAlign: "right",
  }),
};

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

  const getNetworkStatusClass = () => {
    const classes = [styles.networkStatus];
    if (status === "online") classes.push(styles.statusOnline);
    if (status === "offline") classes.push(styles.statusOffline);
    if (status === "checking") classes.push(styles.statusChecking);
    return classes.join(" ");
  };

  const getIndicatorClass = () => {
    const classes = [styles.indicator];
    if (status === "online") classes.push(styles.indicatorOnline);
    if (status === "offline") classes.push(styles.indicatorOffline);
    if (status === "checking") classes.push(styles.indicatorChecking);
    return classes.join(" ");
  };

  return (
    <header className={styles.statusBar}>
      <div className={styles.section}>
        <h1 className={styles.appTitle}>mizPOS</h1>

        {/* ネットワーク状態 */}
        <div className={getNetworkStatusClass()}>
          <span className={getIndicatorClass()} />
          <span>
            {status === "online" && "オンライン"}
            {status === "offline" && "オフライン"}
            {status === "checking" && "確認中..."}
          </span>
        </div>

        {/* 本日の売上サマリー */}
        <div className={styles.todaySales}>
          <span className={styles.salesLabel}>本日:</span>
          <span className={styles.salesCount}>{todaySales.count}件</span>
          <span className={styles.salesTotal}>
            ¥{todaySales.total.toLocaleString()}
          </span>
        </div>
      </div>

      <div className={`${styles.section} ${styles.sectionCenter}`}>
        {/* 同期状態 */}
        {syncStatus.pendingCount > 0 && (
          <div
            className={`${styles.syncStatus} ${
              queueWarning ? styles.syncWarning : ""
            }`}
          >
            <span className={styles.syncIcon}>⏳</span>
            <span>未同期: {syncStatus.pendingCount}件</span>
            {syncStatus.isSyncing && (
              <span className={styles.syncing}>同期中...</span>
            )}
            {!syncStatus.isSyncing && status === "online" && (
              <button
                type="button"
                className={styles.syncButton}
                onClick={() => useNetworkStore.getState().syncPendingSales()}
              >
                今すぐ同期
              </button>
            )}
          </div>
        )}

        {status === "offline" && lastOnlineTime && (
          <div className={styles.lastOnline}>
            最終接続: {formatLastOnlineTime(lastOnlineTime)}
          </div>
        )}
      </div>

      <div className={styles.section}>
        {/* ユーザー情報 */}
        {session && (
          <div className={styles.userInfo}>
            <span className={styles.userName}>{session.display_name}</span>
            <span className={styles.userId}>({session.employee_number})</span>
            {showLogoutConfirm ? (
              <div className={styles.logoutConfirm}>
                <span>ログアウトしますか？</span>
                <button
                  type="button"
                  className={styles.logoutConfirmYes}
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "処理中..." : "はい"}
                </button>
                <button
                  type="button"
                  className={styles.logoutConfirmNo}
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isLoggingOut}
                >
                  いいえ
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.logoutButton}
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

  return <div className={styles.clock}>{timeString}</div>;
}
