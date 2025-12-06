import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

/** 端末の状態 */
export type TerminalStatus =
  | "uninitialized" // キーペア未生成
  | "initialized" // キーペア生成済み、サーバー登録待ち
  | "registered" // 登録済み
  | "revoked"; // 無効化済み

/** 端末認証の結果 */
interface TerminalAuthResult {
  status: string;
  terminal_id: string | null;
  public_key: string | null;
  error: string | null;
}

/** QRコード用のペイロード */
export interface RegistrationQrPayload {
  v: number;
  terminal_id: string;
  public_key: string;
  device_name: string;
  os: string;
  created_at: string;
}

/** 署名データ */
export interface SignatureData {
  terminal_id: string;
  timestamp: number;
  signature: string;
}

/** サーバーからの端末登録確認レスポンス */
interface CheckTerminalResponse {
  registered: boolean;
  status: string | null;
}

interface TerminalState {
  /** 端末の状態 */
  status: TerminalStatus;
  /** 端末ID */
  terminalId: string | null;
  /** 公開鍵（Base64） */
  publicKey: string | null;
  /** QRコードペイロード */
  qrPayload: RegistrationQrPayload | null;
  /** サーバーに登録済みかどうか */
  isRegisteredOnServer: boolean;
  /** 初期化済みフラグ */
  isInitialized: boolean;
  /** エラーメッセージ */
  error: string | null;

  /** ストアを初期化 */
  initialize: () => Promise<void>;
  /** 端末を初期化（キーペア生成） */
  initializeTerminal: (deviceName: string) => Promise<RegistrationQrPayload>;
  /** QRコード用データを生成 */
  generateQrData: (deviceName: string) => Promise<string>;
  /** 認証用署名を生成 */
  createAuthSignature: () => Promise<SignatureData>;
  /** サーバーに登録済みかどうかを確認 */
  checkServerRegistration: () => Promise<boolean>;
  /** Keychainをクリア */
  clearKeychain: () => Promise<void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  status: "uninitialized",
  terminalId: null,
  publicKey: null,
  qrPayload: null,
  isRegisteredOnServer: false,
  isInitialized: false,
  error: null,

  initialize: async () => {
    try {
      // Tauriから端末の状態を取得
      const result = await invoke<TerminalAuthResult>("get_terminal_status");

      if (result.status === "initialized") {
        set({
          status: "initialized",
          terminalId: result.terminal_id,
          publicKey: result.public_key,
          isInitialized: true,
          error: null,
        });

        // サーバーに登録済みかどうかを確認
        const isRegistered = await get().checkServerRegistration();
        if (isRegistered) {
          set({ status: "registered", isRegisteredOnServer: true });
        }
      } else {
        set({
          status: "uninitialized",
          terminalId: null,
          publicKey: null,
          isInitialized: true,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("Failed to initialize terminal store:", error);
      set({
        status: "uninitialized",
        isInitialized: true,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  initializeTerminal: async (deviceName: string) => {
    try {
      const payload = await invoke<RegistrationQrPayload>(
        "initialize_terminal",
        { deviceName }
      );

      set({
        status: "initialized",
        terminalId: payload.terminal_id,
        publicKey: payload.public_key,
        qrPayload: payload,
        error: null,
      });

      return payload;
    } catch (error) {
      console.error("Failed to initialize terminal:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  generateQrData: async (deviceName: string) => {
    try {
      const jsonData = await invoke<string>("generate_registration_qr", {
        deviceName,
      });
      const payload = JSON.parse(jsonData) as RegistrationQrPayload;
      set({ qrPayload: payload });
      return jsonData;
    } catch (error) {
      console.error("Failed to generate QR data:", error);
      throw error;
    }
  },

  createAuthSignature: async () => {
    try {
      const signatureData =
        await invoke<SignatureData>("create_auth_signature");
      return signatureData;
    } catch (error) {
      console.error("Failed to create auth signature:", error);
      throw error;
    }
  },

  checkServerRegistration: async () => {
    const { terminalId } = get();
    if (!terminalId) {
      return false;
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(
        `${apiBaseUrl}/accounts/terminals/check/${terminalId}`
      );

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as CheckTerminalResponse;

      if (data.registered) {
        if (data.status === "active") {
          set({ isRegisteredOnServer: true, status: "registered" });
          return true;
        } else if (data.status === "revoked") {
          set({ isRegisteredOnServer: false, status: "revoked" });
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("Failed to check server registration:", error);
      return false;
    }
  },

  clearKeychain: async () => {
    try {
      await invoke("clear_terminal_keychain");
      set({
        status: "uninitialized",
        terminalId: null,
        publicKey: null,
        qrPayload: null,
        isRegisteredOnServer: false,
        error: null,
      });
    } catch (error) {
      console.error("Failed to clear keychain:", error);
      throw error;
    }
  },
}));
