/**
 * 認証状態管理ストア
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { posLogin, posLogout, refreshSession, verifySession } from "../lib/api";
import {
  clearSession,
  getStoredSession,
  getTerminalId,
  saveSession,
} from "../lib/db";
import type { PosSession } from "../types";

interface AuthState {
  // 状態
  session: PosSession | null;
  isLoading: boolean;
  error: string | null;
  terminalId: string | null;

  // アクション
  initialize: () => Promise<void>;
  login: (employeeNumber: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSessionToken: () => Promise<boolean>;
  verifyCurrentSession: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初期状態
      session: null,
      isLoading: false,
      error: null,
      terminalId: null,

      // 初期化（アプリ起動時に呼び出し）
      initialize: async () => {
        set({ isLoading: true, error: null });

        try {
          // 端末IDを取得
          const terminalId = await getTerminalId();
          set({ terminalId });

          // 保存されたセッションを確認
          const storedSession = await getStoredSession();

          if (storedSession) {
            // オンラインならサーバーで検証
            if (navigator.onLine) {
              try {
                const result = await verifySession(storedSession.session_id);
                if (result.valid && result.session) {
                  set({ session: result.session, isLoading: false });
                  return;
                }
              } catch {
                // オフラインフォールバック: ローカルセッションを使用
                set({ session: storedSession, isLoading: false });
                return;
              }
            } else {
              // オフラインモード: ローカルセッションを使用
              set({ session: storedSession, isLoading: false });
              return;
            }
          }

          set({ session: null, isLoading: false });
        } catch (error) {
          set({
            isLoading: false,
            error:
              error instanceof Error ? error.message : "初期化に失敗しました",
          });
        }
      },

      // ログイン
      login: async (employeeNumber: string, pin: string) => {
        set({ isLoading: true, error: null });

        try {
          const terminalId = get().terminalId || (await getTerminalId());

          const session = await posLogin({
            employee_number: employeeNumber,
            pin,
            terminal_id: terminalId,
          });

          // セッションを保存
          await saveSession(session);

          set({
            session,
            terminalId,
            isLoading: false,
            error: null,
          });

          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "ログインに失敗しました。従業員番号またはPINを確認してください。";

          set({
            isLoading: false,
            error: message,
          });

          return false;
        }
      },

      // ログアウト
      logout: async () => {
        const { session } = get();

        try {
          if (session) {
            await posLogout(session.session_id);
          }
        } catch {
          // エラーは無視
        } finally {
          await clearSession();
          set({ session: null, error: null });
        }
      },

      // セッション延長
      refreshSessionToken: async () => {
        const { session } = get();

        if (!session) return false;

        try {
          const newSession = await refreshSession(session.session_id);
          await saveSession(newSession);
          set({ session: newSession });
          return true;
        } catch {
          return false;
        }
      },

      // セッション検証
      verifyCurrentSession: async () => {
        const { session } = get();

        if (!session) return false;

        // オフラインの場合はローカル検証のみ
        if (!navigator.onLine) {
          const now = Date.now() / 1000;
          return session.expires_at > now;
        }

        try {
          const result = await verifySession(session.session_id);
          if (!result.valid) {
            await clearSession();
            set({ session: null });
            return false;
          }
          return true;
        } catch {
          // ネットワークエラーはオフライン検証にフォールバック
          const now = Date.now() / 1000;
          return session.expires_at > now;
        }
      },

      // エラークリア
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: "mizpos-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        terminalId: state.terminalId,
      }),
    },
  ),
);

// セッションの有効期限が近いかチェック（30分前）
export function isSessionExpiringSoon(session: PosSession | null): boolean {
  if (!session) return false;
  const thirtyMinutesFromNow = Date.now() / 1000 + 30 * 60;
  return session.expires_at < thirtyMinutesFromNow;
}
