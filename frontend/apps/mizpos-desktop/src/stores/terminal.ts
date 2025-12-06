import { invoke } from "@tauri-apps/api/core";
import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
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

/** Android JavaScript Interface の型定義 */
interface AndroidTerminalAuth {
  getTerminalStatus: () => string;
  saveKeyPair: (
    terminalId: string,
    privateKeyBase64: string,
    publicKeyBase64: string,
  ) => string;
  getPrivateKey: () => string;
  clearKeychain: () => string;
}

/** Android JavaScript Interface のレスポンス型 */
interface AndroidTerminalAuthResponse {
  success: boolean;
  status?: string;
  terminal_id?: string;
  public_key?: string;
  private_key?: string;
  error?: string;
}

declare global {
  interface Window {
    MizPosTerminalAuth?: AndroidTerminalAuth;
  }
}

/** Androidかどうかを判定 */
const isAndroid = (): boolean => {
  return typeof window !== "undefined" && !!window.MizPosTerminalAuth;
};

/** UUIDを生成 */
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

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
      let result: TerminalAuthResult;

      if (isAndroid()) {
        // Android: JavaScript Interface を使用
        const statusJson = window.MizPosTerminalAuth?.getTerminalStatus();
        if (!statusJson) {
          throw new Error(
            "MizPosTerminalAuth.getTerminalStatus returned undefined",
          );
        }
        const response = JSON.parse(statusJson) as AndroidTerminalAuthResponse;

        if (!response.success) {
          throw new Error(response.error || "Failed to get terminal status");
        }

        result = {
          status: response.status || "uninitialized",
          terminal_id: response.terminal_id || null,
          public_key: response.public_key || null,
          error: response.error || null,
        };
      } else {
        // Desktop: Tauriコマンドを使用
        result = await invoke<TerminalAuthResult>("get_terminal_status");
      }

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
      let payload: RegistrationQrPayload;

      if (isAndroid()) {
        // Android: JavaScriptでキーペア生成し、Kotlinに保存
        const keyPair = nacl.sign.keyPair();
        const terminalId = generateUUID();
        const privateKeyBase64 = encodeBase64(keyPair.secretKey.slice(0, 32)); // Ed25519の秘密鍵は先頭32バイト
        const publicKeyBase64 = encodeBase64(keyPair.publicKey);

        const saveResultJson = window.MizPosTerminalAuth?.saveKeyPair(
          terminalId,
          privateKeyBase64,
          publicKeyBase64,
        );
        if (!saveResultJson) {
          throw new Error("MizPosTerminalAuth.saveKeyPair returned undefined");
        }
        const response = JSON.parse(
          saveResultJson,
        ) as AndroidTerminalAuthResponse;

        if (!response.success) {
          throw new Error(response.error || "Failed to save key pair");
        }

        payload = {
          v: 1,
          terminal_id: terminalId,
          public_key: publicKeyBase64,
          device_name: deviceName,
          os: "android",
          created_at: `${Math.floor(Date.now() / 1000)}Z`,
        };
      } else {
        // Desktop: Tauriコマンドを使用
        payload = await invoke<RegistrationQrPayload>("initialize_terminal", {
          deviceName,
        });
      }

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
      let payload: RegistrationQrPayload;

      if (isAndroid()) {
        // Android: 既存のペイロードを使用するか、新規生成
        const existingPayload = get().qrPayload;
        if (existingPayload) {
          payload = existingPayload;
        } else {
          payload = await get().initializeTerminal(deviceName);
        }
      } else {
        // Desktop: Tauriコマンドを使用
        const jsonData = await invoke<string>("generate_registration_qr", {
          deviceName,
        });
        payload = JSON.parse(jsonData) as RegistrationQrPayload;
      }

      set({ qrPayload: payload });
      return JSON.stringify(payload);
    } catch (error) {
      console.error("Failed to generate QR data:", error);
      throw error;
    }
  },

  createAuthSignature: async () => {
    try {
      if (isAndroid()) {
        // Android: JavaScript Interface から秘密鍵を取得して署名
        const privateKeyJson = window.MizPosTerminalAuth?.getPrivateKey();
        if (!privateKeyJson) {
          throw new Error(
            "MizPosTerminalAuth.getPrivateKey returned undefined",
          );
        }
        const response = JSON.parse(
          privateKeyJson,
        ) as AndroidTerminalAuthResponse;

        if (!response.success || !response.private_key) {
          throw new Error(response.error || "Failed to get private key");
        }

        const { terminalId } = get();
        if (!terminalId) {
          throw new Error("Terminal not initialized");
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const message = `${terminalId}:${timestamp}`;
        const messageBytes = new TextEncoder().encode(message);

        // 秘密鍵を復元してフルキーペアを再構築
        const seedBytes = decodeBase64(response.private_key);
        const keyPair = nacl.sign.keyPair.fromSeed(seedBytes);

        // 署名を生成
        const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

        return {
          terminal_id: terminalId,
          timestamp,
          signature: encodeBase64(signature),
        };
      } else {
        // Desktop: Tauriコマンドを使用
        const signatureData = await invoke<SignatureData>(
          "create_auth_signature",
        );
        return signatureData;
      }
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
        `${apiBaseUrl}/accounts/terminals/check/${terminalId}`,
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
      if (isAndroid()) {
        // Android: JavaScript Interface を使用
        const clearResultJson = window.MizPosTerminalAuth?.clearKeychain();
        if (!clearResultJson) {
          throw new Error(
            "MizPosTerminalAuth.clearKeychain returned undefined",
          );
        }
        const response = JSON.parse(
          clearResultJson,
        ) as AndroidTerminalAuthResponse;

        if (!response.success) {
          throw new Error(response.error || "Failed to clear keychain");
        }
      } else {
        // Desktop: Tauriコマンドを使用
        await invoke("clear_terminal_keychain");
      }

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
