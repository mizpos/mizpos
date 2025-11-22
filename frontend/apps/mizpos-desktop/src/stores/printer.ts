import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTerminalId } from "../lib/db";
import {
  type BluetoothDevice,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getBluetoothDevices,
  getPlatform,
  getUsbDevices,
  isAndroid,
  isBluetoothConnected,
  type Platform,
  type PrinterResult,
  type ReceiptData,
  UnifiedPrinter,
  type UnifiedPrinterConfig,
  type UsbDevice,
} from "../lib/printer";

export type PaperWidth = 58 | 80;

// USB printer config (Desktop)
interface UsbPrinterConfig {
  type: "usb";
  vendor_id: number;
  device_id: number;
  name: string;
}

// Bluetooth printer config (Android)
interface BluetoothPrinterConfig {
  type: "bluetooth";
  address: string;
  name: string;
}

type PrinterConfig = UsbPrinterConfig | BluetoothPrinterConfig;

interface PrinterState {
  // State
  platform: Platform;
  printerConfig: PrinterConfig | null;
  paperWidth: PaperWidth;
  terminalId: string | null;
  isInitialized: boolean;
  isConnected: boolean;

  // Actions
  initialize: () => Promise<void>;
  refreshDevices: () => Promise<(UsbDevice | BluetoothDevice)[]>;
  selectUsbPrinter: (device: UsbDevice) => void;
  selectBluetoothPrinter: (device: BluetoothDevice) => Promise<PrinterResult>;
  disconnect: () => Promise<void>;
  setPaperWidth: (width: PaperWidth) => void;
  clearPrinterConfig: () => void;

  // Print functions
  testPrint: () => Promise<PrinterResult>;
  printReceipt: (data: ReceiptData) => Promise<PrinterResult>;
  printText: (text: string) => Promise<PrinterResult>;
}

// Create unified printer instance from config
function createPrinter(
  platform: Platform,
  config: PrinterConfig | null,
  paperWidth: number,
): UnifiedPrinter | null {
  if (!config) return null;

  const unifiedConfig: UnifiedPrinterConfig = {
    platform,
    name: config.name,
    paperWidth,
  };

  if (config.type === "usb") {
    unifiedConfig.vendorId = config.vendor_id;
    unifiedConfig.deviceId = config.device_id;
  } else {
    unifiedConfig.bluetoothAddress = config.address;
  }

  return new UnifiedPrinter(unifiedConfig);
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set, get) => ({
      platform: "desktop",
      printerConfig: null,
      paperWidth: 58,
      terminalId: null,
      isInitialized: false,
      isConnected: false,

      initialize: async () => {
        if (get().isInitialized) return;

        try {
          const [terminalId, platform] = await Promise.all([
            getTerminalId(),
            getPlatform(),
          ]);

          // Check connection status for Android
          let connected = false;
          if (platform === "android") {
            connected = isBluetoothConnected();
          }

          set({
            terminalId,
            platform,
            isInitialized: true,
            isConnected: connected,
          });
        } catch {
          // Fallback platform detection
          const platform = isAndroid() ? "android" : "desktop";
          set({ platform, isInitialized: true });
        }
      },

      refreshDevices: async () => {
        const { platform } = get();

        if (platform === "android") {
          const result = getBluetoothDevices();
          if (result.success && result.devices) {
            return result.devices;
          }
          return [];
        }

        // Desktop USB
        try {
          return await getUsbDevices();
        } catch {
          return [];
        }
      },

      selectUsbPrinter: (device: UsbDevice) => {
        set({
          printerConfig: {
            type: "usb",
            vendor_id: device.vendor_id,
            device_id: device.device_id,
            name: device.name,
          },
          isConnected: true, // USB doesn't need explicit connect
        });
      },

      selectBluetoothPrinter: async (
        device: BluetoothDevice,
      ): Promise<PrinterResult> => {
        const result = connectBluetoothPrinter(device.address);

        if (result.success) {
          set({
            printerConfig: {
              type: "bluetooth",
              address: device.address,
              name: device.name,
            },
            isConnected: true,
          });
        }

        return result;
      },

      disconnect: async () => {
        const { platform } = get();

        if (platform === "android") {
          disconnectBluetoothPrinter();
        }

        set({ isConnected: false });
      },

      setPaperWidth: (width: PaperWidth) => {
        set({ paperWidth: width });
      },

      clearPrinterConfig: () => {
        const { platform } = get();

        if (platform === "android") {
          disconnectBluetoothPrinter();
        }

        set({ printerConfig: null, isConnected: false });
      },

      testPrint: async (): Promise<PrinterResult> => {
        const { platform, printerConfig, paperWidth, terminalId } = get();

        const printer = createPrinter(platform, printerConfig, paperWidth);
        if (!printer) {
          return { success: false, error: "Printer not configured" };
        }

        return printer.welcomePrint(terminalId || "UNKNOWN");
      },

      printReceipt: async (data: ReceiptData): Promise<PrinterResult> => {
        const { platform, printerConfig, paperWidth } = get();

        const printer = createPrinter(platform, printerConfig, paperWidth);
        if (!printer) {
          return { success: false, error: "Printer not configured" };
        }

        return printer.printReceipt(data);
      },

      printText: async (text: string): Promise<PrinterResult> => {
        const { platform, printerConfig, paperWidth } = get();

        const printer = createPrinter(platform, printerConfig, paperWidth);
        if (!printer) {
          return { success: false, error: "Printer not configured" };
        }

        return printer.textPrint(text);
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
