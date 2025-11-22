/**
 * ネットワーク状態管理ストア
 * オンライン/オフライン監視と同期処理
 */

import { create } from "zustand";
import { checkNetworkConnectivity, syncOfflineSales } from "../lib/api";
import {
  cleanupSyncedQueue,
  getOfflineQueueSize,
  getPendingOfflineQueue,
  getTerminalId,
  isOfflineQueueNearCapacity,
  markQueueItemFailed,
  markQueueItemSynced,
} from "../lib/db";
import type { NetworkStatus, SyncStatus } from "../types";

// 監視間隔（ミリ秒）
const NETWORK_CHECK_INTERVAL = 30000; // 30秒
const SYNC_INTERVAL = 60000; // 60秒

interface NetworkState {
  // 状態
  status: NetworkStatus;
  syncStatus: SyncStatus;
  lastOnlineTime: number | null;
  queueWarning: boolean;

  // アクション
  startMonitoring: () => void;
  stopMonitoring: () => void;
  checkConnection: () => Promise<void>;
  syncPendingSales: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
}

// 監視用のインターバルID
let networkCheckInterval: ReturnType<typeof setInterval> | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

export const useNetworkStore = create<NetworkState>()((set, get) => ({
  // 初期状態
  status: navigator.onLine ? "checking" : "offline",
  syncStatus: {
    pendingCount: 0,
    isSyncing: false,
  },
  lastOnlineTime: null,
  queueWarning: false,

  // ネットワーク監視開始
  startMonitoring: () => {
    // ブラウザのオンライン/オフラインイベントをリッスン
    window.addEventListener("online", () => {
      set({ status: "checking" });
      get().checkConnection();
    });

    window.addEventListener("offline", () => {
      set({ status: "offline" });
    });

    // 定期的な接続チェック
    get().checkConnection();
    networkCheckInterval = setInterval(() => {
      get().checkConnection();
    }, NETWORK_CHECK_INTERVAL);

    // 定期的な同期
    get().updateSyncStatus();
    syncInterval = setInterval(() => {
      const { status } = get();
      if (status === "online") {
        get().syncPendingSales();
      }
      get().updateSyncStatus();
    }, SYNC_INTERVAL);
  },

  // ネットワーク監視停止
  stopMonitoring: () => {
    if (networkCheckInterval) {
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
    }
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  },

  // 接続チェック
  checkConnection: async () => {
    set({ status: "checking" });

    const isOnline = await checkNetworkConnectivity();

    if (isOnline) {
      set({
        status: "online",
        lastOnlineTime: Date.now(),
      });

      // オンラインになったら同期を試行
      get().syncPendingSales();
    } else {
      set({ status: "offline" });
    }
  },

  // 未同期販売を同期
  syncPendingSales: async () => {
    const { syncStatus, status } = get();

    // 既に同期中、またはオフラインならスキップ
    if (syncStatus.isSyncing || status !== "online") {
      return;
    }

    set({
      syncStatus: { ...syncStatus, isSyncing: true },
    });

    try {
      const pendingItems = await getPendingOfflineQueue();

      if (pendingItems.length === 0) {
        set({
          syncStatus: {
            ...syncStatus,
            isSyncing: false,
            pendingCount: 0,
          },
        });
        return;
      }

      const terminalId = await getTerminalId();

      // サーバーに同期
      const result = await syncOfflineSales(
        terminalId,
        pendingItems.map((item) => ({
          queue_id: item.queue_id,
          created_at: item.created_at,
          sale_data: item.sale_data,
        })),
      );

      // 成功したものをマーク
      for (const item of pendingItems) {
        const failed = result.failed_items.find(
          (f) => f.queue_id === item.queue_id,
        );
        if (failed) {
          await markQueueItemFailed(item.queue_id, failed.error);
        } else {
          await markQueueItemSynced(item.queue_id);
        }
      }

      // 古い同期済みデータをクリーンアップ
      await cleanupSyncedQueue(7);

      set({
        syncStatus: {
          lastSyncTime: result.sync_timestamp * 1000,
          pendingCount: result.failed_items.length,
          isSyncing: false,
        },
      });
    } catch (error) {
      console.error("Sync failed:", error);
      set({
        syncStatus: {
          ...syncStatus,
          isSyncing: false,
        },
      });
    }
  },

  // 同期状態の更新
  updateSyncStatus: async () => {
    const pendingCount = await getOfflineQueueSize();
    const queueWarning = await isOfflineQueueNearCapacity();

    set((state) => ({
      syncStatus: {
        ...state.syncStatus,
        pendingCount,
      },
      queueWarning,
    }));
  },
}));

// フォーマット用ヘルパー
export function formatLastOnlineTime(timestamp: number | null): string {
  if (!timestamp) return "不明";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return "たった今";
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分前`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}時間前`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleString("ja-JP");
  }
}
