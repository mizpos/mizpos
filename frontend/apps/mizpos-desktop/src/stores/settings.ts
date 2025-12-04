import { Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import type { AppSettings, PrinterConfig } from "../types";

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  initialize: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updatePrinter: (printer: PrinterConfig | undefined) => Promise<void>;
  toggleTrainingMode: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  eventName: "イベント名",
  terminalId: "001",
  taxRate: 10,
  printer: undefined,
  isTrainingMode: false,
};

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load("settings.json");
  }
  return store;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: true,

  initialize: async () => {
    try {
      const s = await getStore();
      const saved = await s.get<AppSettings>("settings");
      if (saved) {
        set({ settings: { ...defaultSettings, ...saved }, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Failed to initialize settings:", error);
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<AppSettings>) => {
    try {
      const newSettings = { ...get().settings, ...updates };
      const s = await getStore();
      await s.set("settings", newSettings);
      await s.save();
      set({ settings: newSettings });
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  },

  updatePrinter: async (printer: PrinterConfig | undefined) => {
    await get().updateSettings({ printer });
  },

  toggleTrainingMode: async () => {
    const currentMode = get().settings.isTrainingMode ?? false;
    await get().updateSettings({ isTrainingMode: !currentMode });
  },
}));
