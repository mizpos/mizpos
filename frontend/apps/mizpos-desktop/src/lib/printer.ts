/**
 * Cross-platform printer abstraction layer
 *
 * - Desktop (macOS/Windows/Linux): Uses Tauri USB commands
 * - Android: Uses JavaScript Interface (window.MizPosPrinter)
 */

import { invoke } from "@tauri-apps/api/core";

// Types
export type Platform = "android" | "desktop";

export interface UsbDevice {
  vendor_id: number;
  device_id: number;
  name: string;
}

export interface BluetoothDevice {
  address: string;
  name: string;
}

export type PrinterDevice = UsbDevice | BluetoothDevice;

export interface PrinterResult {
  success: boolean;
  error?: string;
}

export interface DeviceListResult extends PrinterResult {
  devices?: BluetoothDevice[];
}

// Android JavaScript Interface type
interface MizPosPrinterBridge {
  getPairedDevices(): string;
  connect(address: string): string;
  disconnect(): string;
  isConnected(): string;
  printText(text: string): string;
  welcomePrint(terminalId: string, paperWidth?: number): string;
  printReceipt(jsonData: string): string;
}

declare global {
  interface Window {
    MizPosPrinter?: MizPosPrinterBridge;
  }
}

/**
 * Detect current platform
 */
export async function getPlatform(): Promise<Platform> {
  try {
    const platform = await invoke<string>("get_platform");
    return platform === "android" ? "android" : "desktop";
  } catch {
    // Fallback: check if Android bridge exists
    if (typeof window !== "undefined" && window.MizPosPrinter) {
      return "android";
    }
    return "desktop";
  }
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return typeof window !== "undefined" && !!window.MizPosPrinter;
}

// ===================
// Desktop USB Functions
// ===================

export async function getUsbDevices(): Promise<UsbDevice[]> {
  return invoke<UsbDevice[]>("get_usb_devices");
}

export async function usbWelcomePrint(
  vendorId: number,
  deviceId: number,
  terminalId: string,
  paperWidth?: number,
): Promise<void> {
  return invoke("welcome_print", {
    vendorId,
    deviceId,
    id: terminalId,
    paperWidth,
  });
}

export async function usbTextPrint(
  vendorId: number,
  deviceId: number,
  text: string,
  paperWidth?: number,
): Promise<void> {
  return invoke("text_print", {
    vendorId,
    deviceId,
    text,
    paperWidth,
  });
}

// ===================
// Android Bluetooth Functions
// ===================

function parseAndroidResult<T>(jsonString: string): T {
  return JSON.parse(jsonString) as T;
}

export function getBluetoothDevices(): DeviceListResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.getPairedDevices();
  return parseAndroidResult<DeviceListResult>(result);
}

export function connectBluetoothPrinter(address: string): PrinterResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.connect(address);
  return parseAndroidResult<PrinterResult>(result);
}

export function disconnectBluetoothPrinter(): PrinterResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.disconnect();
  return parseAndroidResult<PrinterResult>(result);
}

export function isBluetoothConnected(): boolean {
  if (!window.MizPosPrinter) {
    return false;
  }
  const result = window.MizPosPrinter.isConnected();
  const parsed = parseAndroidResult<{ success: boolean; connected: boolean }>(
    result,
  );
  return parsed.connected;
}

export function bluetoothWelcomePrint(
  terminalId: string,
  paperWidth?: number,
): PrinterResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.welcomePrint(terminalId, paperWidth);
  return parseAndroidResult<PrinterResult>(result);
}

export function bluetoothTextPrint(text: string): PrinterResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.printText(text);
  return parseAndroidResult<PrinterResult>(result);
}

export interface ReceiptData {
  header?: string;
  items?: Array<{
    name: string;
    price: string;
    quantity?: number;
  }>;
  total?: string;
  footer?: string;
  paperWidth?: number;
}

export function bluetoothPrintReceipt(data: ReceiptData): PrinterResult {
  if (!window.MizPosPrinter) {
    return { success: false, error: "Bluetooth not available" };
  }
  const result = window.MizPosPrinter.printReceipt(JSON.stringify(data));
  return parseAndroidResult<PrinterResult>(result);
}

// ===================
// Unified Printer API
// ===================

export interface UnifiedPrinterConfig {
  platform: Platform;
  // Desktop USB
  vendorId?: number;
  deviceId?: number;
  // Android Bluetooth
  bluetoothAddress?: string;
  // Common
  name: string;
  paperWidth: number;
}

/**
 * Unified printer class that works across platforms
 */
export class UnifiedPrinter {
  private config: UnifiedPrinterConfig;

  constructor(config: UnifiedPrinterConfig) {
    this.config = config;
  }

  async connect(): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      if (!this.config.bluetoothAddress) {
        return { success: false, error: "Bluetooth address not configured" };
      }
      return connectBluetoothPrinter(this.config.bluetoothAddress);
    }
    // Desktop USB doesn't need explicit connect
    return { success: true };
  }

  async disconnect(): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      return disconnectBluetoothPrinter();
    }
    return { success: true };
  }

  async isConnected(): Promise<boolean> {
    if (this.config.platform === "android") {
      return isBluetoothConnected();
    }
    // Desktop: assume connected if config exists
    return !!(this.config.vendorId && this.config.deviceId);
  }

  async welcomePrint(terminalId: string): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      return bluetoothWelcomePrint(terminalId, this.config.paperWidth);
    }

    // Desktop USB
    if (!this.config.vendorId || !this.config.deviceId) {
      return { success: false, error: "Printer not configured" };
    }

    try {
      await usbWelcomePrint(
        this.config.vendorId,
        this.config.deviceId,
        terminalId,
        this.config.paperWidth,
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async textPrint(text: string): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      return bluetoothTextPrint(text);
    }

    // Desktop USB
    if (!this.config.vendorId || !this.config.deviceId) {
      return { success: false, error: "Printer not configured" };
    }

    try {
      await usbTextPrint(
        this.config.vendorId,
        this.config.deviceId,
        text,
        this.config.paperWidth,
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async printReceipt(data: ReceiptData): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      return bluetoothPrintReceipt({
        ...data,
        paperWidth: this.config.paperWidth,
      });
    }

    // Desktop: format and print as text
    let text = "";

    if (data.header) {
      text += `${data.header}\n\n`;
    }

    if (data.items) {
      text += "--------------------------------\n";
      for (const item of data.items) {
        text += `${item.name} x${item.quantity || 1}\n`;
        text += `  ¥${item.price}\n`;
      }
      text += "--------------------------------\n";
    }

    if (data.total) {
      text += `合計: ¥${data.total}\n`;
    }

    if (data.footer) {
      text += `\n${data.footer}\n`;
    }

    return this.textPrint(text);
  }
}
