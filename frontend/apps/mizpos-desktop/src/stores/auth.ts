import { Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { syncProducts } from "../lib/db";
import type { Session } from "../types";
import { useSettingsStore } from "./settings";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface CircleInfo {
  publisher_id: string;
  name: string;
}

interface PosLoginResponse {
  session_id: string;
  employee_number: string;
  display_name: string;
  event_id?: string;
  publisher_id?: string;
  circles?: CircleInfo[];
  expires_at: number;
  offline_verification_hash: string;
}

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (staffId: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setEventId: (eventId: string) => Promise<void>;
}

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("auth.json");
  }
  return store;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const s = await getStore();
      const savedSession = await s.get<Session>("session");
      console.log("[Auth] Initialize - savedSession:", savedSession);
      if (savedSession) {
        // セッションの有効期限をチェック
        const now = Math.floor(Date.now() / 1000);
        console.log(
          "[Auth] Session check - expiresAt:",
          savedSession.expiresAt,
          "now:",
          now,
          "valid:",
          savedSession.expiresAt > now,
        );
        if (savedSession.expiresAt > now) {
          set({
            session: {
              ...savedSession,
              loginAt: new Date(savedSession.loginAt),
            },
            isLoading: false,
          });
          console.log("[Auth] Session restored successfully");
        } else {
          // 期限切れの場合はセッションを削除
          console.log("[Auth] Session expired, deleting");
          await s.delete("session");
          await s.save();
          set({ isLoading: false });
        }
      } else {
        console.log("[Auth] No saved session found");
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      set({ isLoading: false, error: "認証の初期化に失敗しました" });
    }
  },

  login: async (staffId: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      // 7桁のスタッフID（数字のみ）
      if (!/^\d{7}$/.test(staffId)) {
        set({
          isLoading: false,
          error: "スタッフIDは7桁の数字で入力してください",
        });
        return false;
      }

      // 3〜8桁のパスワード（数字のみ）
      if (!/^\d{3,8}$/.test(password)) {
        set({
          isLoading: false,
          error: "パスワードは3〜8桁の数字で入力してください",
        });
        return false;
      }

      // 端末IDを取得
      const terminalId = useSettingsStore.getState().settings.terminalId;

      // APIで認証
      const response = await fetch(`${API_BASE_URL}/pos/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_number: staffId,
          pin: password,
          terminal_id: terminalId,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          set({
            isLoading: false,
            error: "スタッフIDまたはパスワードが正しくありません",
          });
        } else {
          set({ isLoading: false, error: "サーバーエラーが発生しました" });
        }
        return false;
      }

      const data: PosLoginResponse = await response.json();

      const session: Session = {
        sessionId: data.session_id,
        staffId: data.employee_number,
        staffName: data.display_name,
        eventId: data.event_id,
        publisherId: data.publisher_id,
        circles: data.circles,
        expiresAt: data.expires_at,
        offlineVerificationHash: data.offline_verification_hash,
        loginAt: new Date(),
      };

      const s = await getStore();
      await s.set("session", session);
      await s.save();
      console.log("[Auth] Session saved to store:", session);

      set({ session, isLoading: false });

      // バックグラウンドで商品データを同期
      syncProducts().catch((err) => {
        console.error("Failed to sync products:", err);
      });

      return true;
    } catch (error) {
      console.error("Login failed:", error);
      set({ isLoading: false, error: "ネットワークエラーが発生しました" });
      return false;
    }
  },

  logout: async () => {
    try {
      const s = await getStore();
      const session = await s.get<Session>("session");

      // サーバー側のセッションも無効化（ベストエフォート）
      if (session?.sessionId) {
        try {
          await fetch(`${API_BASE_URL}/pos/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-POS-Session-ID": session.sessionId,
            },
          });
        } catch {
          // ログアウトAPI失敗は無視（オフライン時など）
        }
      }

      await s.delete("session");
      await s.save();
      set({ session: null });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  setEventId: async (eventId: string) => {
    try {
      const s = await getStore();
      const currentSession = await s.get<Session>("session");
      if (currentSession) {
        const updatedSession = { ...currentSession, eventId };
        await s.set("session", updatedSession);
        await s.save();
        set({ session: updatedSession });
      }
    } catch (error) {
      console.error("Failed to set event ID:", error);
    }
  },
}));
