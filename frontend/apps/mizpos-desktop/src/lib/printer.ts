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
  welcomePrint(terminalId: string): string;
  welcomePrintWithWidth(terminalId: string, paperWidth: number): string;
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

/**
 * USB プリンターで領収書形式のレシートを印刷
 */
export async function usbPrintFullReceipt(
  vendorId: number,
  deviceId: number,
  receipt: FullReceiptData,
  paperWidth?: number,
): Promise<void> {
  return invoke("print_receipt", {
    vendorId,
    deviceId,
    receipt,
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
  // paperWidthが指定されている場合はwelcomePrintWithWidthを使用
  const result = paperWidth
    ? window.MizPosPrinter.welcomePrintWithWidth(terminalId, paperWidth)
    : window.MizPosPrinter.welcomePrint(terminalId);
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
  qrCode?: string;
}

/**
 * レシート印刷用の商品明細
 */
export interface ReceiptItem {
  /** 出版サークル名 */
  circle_name: string;
  /** JAN */
  jan: string;
  /** ISBN */
  isbn: string;
  /** 商品数 */
  quantity: number;
  /** 値段（単価 x 数量） */
  price: number;
}

/**
 * レシート印刷用の支払情報
 */
export interface PaymentInfo {
  /** 支払手段名（現金、クレジットカードなど） */
  method: string;
  /** 支払金額 */
  amount: number;
}

/**
 * 新レシート印刷データ（領収書形式）
 */
export interface FullReceiptData {
  /** イベント名称 */
  event_name: string;
  /** スタッフ番号 */
  staff_id: string;
  /** 発売日時（フォーマット済み文字列） */
  sale_datetime: string;
  /** 宛名（様の前に表示） */
  customer_name?: string;
  /** 商品明細リスト */
  items: ReceiptItem[];
  /** 合計金額 */
  total: number;
  /** 支払情報リスト */
  payments: PaymentInfo[];
  /** 消費税率（%） */
  tax_rate: number;
  /** 消費税金額 */
  tax_amount: number;
  /** レシート番号 */
  receipt_number: string;
  /** お釣り（現金払いの場合のみ） */
  change_amount?: number;
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

  /**
   * 領収書形式のフルレシートを印刷
   * - イベント名称、スタッフID
   * - 「領収書」ヘッダー（黒背景・中央揃え・2倍サイズ）
   * - 宛名（黒背景・右寄せ・下線）
   * - 商品明細（サークル名、JAN、ISBN、数量、価格）
   * - 合計（全角数字）
   * - 支払情報・消費税
   * - レシート番号とQRコード
   */
  async printFullReceipt(data: FullReceiptData): Promise<PrinterResult> {
    if (this.config.platform === "android") {
      // Android: 既存のJavaScript Interfaceを使用
      return bluetoothPrintReceipt({
        header: `${data.event_name}\n責ID:${data.staff_id}`,
        items: data.items.map((item) => ({
          name: item.circle_name,
          price: String(item.price),
          quantity: item.quantity,
        })),
        total: String(data.total),
        footer: `消費税(${data.tax_rate}%): \\${data.tax_amount}\nレシート番号: ${data.receipt_number}`,
        paperWidth: this.config.paperWidth,
        qrCode: data.receipt_number,
      });
    }

    // Desktop USB: Rust側の新しいprint_receiptコマンドを使用
    if (!this.config.vendorId || !this.config.deviceId) {
      return { success: false, error: "Printer not configured" };
    }

    try {
      await usbPrintFullReceipt(
        this.config.vendorId,
        this.config.deviceId,
        data,
        this.config.paperWidth,
      );
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }
}
