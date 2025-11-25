import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchPosEvents } from "../lib/api";
import type { PosEvent } from "../types";

interface EventState {
  // 選択中のイベント（手動選択）
  selectedEvent: PosEvent | null;
  // イベント一覧
  events: PosEvent[];
  // ローディング状態
  isLoading: boolean;
  // エラー
  error: string | null;

  // アクション
  fetchEventList: () => Promise<void>;
  selectEvent: (event: PosEvent | null) => void;
  clearSelectedEvent: () => void;
}

export const useEventStore = create<EventState>()(
  persist(
    (set) => ({
      selectedEvent: null,
      events: [],
      isLoading: false,
      error: null,

      fetchEventList: async () => {
        set({ isLoading: true, error: null });
        try {
          const events = await fetchPosEvents();
          // アクティブなイベントのみフィルタリング
          const activeEvents = events.filter((e: PosEvent) => e.is_active);
          set({ events: activeEvents, isLoading: false });
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "イベントの取得に失敗しました",
            isLoading: false,
          });
        }
      },

      selectEvent: (event) => {
        set({ selectedEvent: event });
      },

      clearSelectedEvent: () => {
        set({ selectedEvent: null });
      },
    }),
    {
      name: "mizpos-event",
      partialize: (state) => ({
        selectedEvent: state.selectedEvent,
      }),
    },
  ),
);

/**
 * 現在有効なイベントIDを取得するヘルパー関数
 * セッションにevent_idがある場合はそれを優先、なければ手動選択されたイベントを使用
 */
export function getEffectiveEventId(
  sessionEventId?: string,
  selectedEvent?: PosEvent | null,
): string | undefined {
  // セッションに紐づくイベントがあれば優先
  if (sessionEventId) {
    return sessionEventId;
  }
  // 手動選択されたイベントがあればそれを使用
  if (selectedEvent) {
    return selectedEvent.event_id;
  }
  return undefined;
}
