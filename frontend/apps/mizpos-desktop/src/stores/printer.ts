import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTerminalId } from "../lib/db";

export type PaperWidth = 58 | 80;

interface PrinterConfig {
  vendor_id: number;
  device_id: number;
  name: string;
}

interface PrinterState {
  printerConfig: PrinterConfig | null;
  paperWidth: PaperWidth;
  terminalId: string | null;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  setPrinterConfig: (config: PrinterConfig) => Promise<void>;
  setPaperWidth: (width: PaperWidth) => void;
  clearPrinterConfig: () => void;
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      printerConfig: null,
      paperWidth: 58,
      terminalId: null,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
        try {
          const terminalId = await getTerminalId();
          set({ terminalId, isInitialized: true });
        } catch {
          set({ isInitialized: true });
        }
      },

      setPrinterConfig: async (config: PrinterConfig) => {
        set({ printerConfig: config });
      },

      setPaperWidth: (width: PaperWidth) => {
        set({ paperWidth: width });
      },

      clearPrinterConfig: () => {
        set({ printerConfig: null });
      },
    }),
    {
      name: "mizpos-printer-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        printerConfig: state.printerConfig,
        paperWidth: state.paperWidth,
      }),
    },
  ),
);
