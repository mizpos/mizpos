import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Badge, Button, Card, Input } from "../components/ui";
import { syncProducts } from "../lib/db";
import {
  type BluetoothDevice,
  getBluetoothDevices,
  getPlatform,
  getUsbDevices,
  isAndroid,
  type Platform,
  type UsbDevice,
} from "../lib/printer";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import type { PrinterConfig } from "../types";

// ページレイアウトスタイル
const pageStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#0f172a",
    color: "#f8fafc",
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px 24px",
    background: "#1e293b",
    borderBottom: "1px solid #334155",
    flexShrink: 0,
  }),
  title: css({
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
  }),
  content: css({
    flex: 1,
    overflowY: "auto",
    padding: "24px",
  }),
  contentInner: css({
    maxWidth: "600px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  }),
};

// セクションスタイル
const sectionStyles = {
  header: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  }),
  title: css({
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#f8fafc",
  }),
  field: css({
    marginBottom: "16px",
  }),
  fieldLast: css({
    marginBottom: 0,
  }),
};

// プリンター選択スタイル
const printerStyles = {
  selected: css({
    padding: "16px",
    background: "#14532d",
    borderRadius: "10px",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  }),
  selectedLabel: css({
    fontSize: "12px",
    color: "#86efac",
    marginBottom: "4px",
  }),
  selectedName: css({
    fontSize: "15px",
    fontWeight: 600,
    color: "#f8fafc",
  }),
  deviceList: css({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),
  deviceButton: css({
    width: "100%",
    padding: "14px 16px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#94a3b8",
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    _hover: {
      background: "#334155",
      borderColor: "#475569",
    },
  }),
  deviceButtonSelected: css({
    color: "#f8fafc",
    background: "#3b82f6",
    borderColor: "#3b82f6",
    _hover: {
      background: "#2563eb",
      borderColor: "#2563eb",
    },
  }),
  emptyState: css({
    fontSize: "14px",
    color: "#64748b",
    padding: "16px",
    textAlign: "center",
    background: "#0f172a",
    borderRadius: "10px",
    border: "1px dashed #334155",
  }),
  sectionLabel: css({
    fontSize: "13px",
    color: "#64748b",
    marginBottom: "12px",
    marginTop: "20px",
    fontWeight: 500,
  }),
};

function SettingsPage() {
  const { session } = useAuthStore();
  const { settings, updateSettings, updatePrinter } = useSettingsStore();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState(settings.eventName);
  const [circleName, setCircleName] = useState(settings.circleName || "");
  const [venueAddress, setVenueAddress] = useState(settings.venueAddress || "");
  const [terminalId, setTerminalId] = useState(settings.terminalId);
  const [taxRate, setTaxRate] = useState(String(settings.taxRate));

  const [platform, setPlatform] = useState<Platform>("desktop");
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>(
    [],
  );
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<
    PrinterConfig | undefined
  >(settings.printer);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    count?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/login" });
    }
  }, [session, navigate]);

  useEffect(() => {
    getPlatform().then(setPlatform);
  }, []);

  const refreshDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      if (platform === "android" || isAndroid()) {
        const result = getBluetoothDevices();
        if (result.success && result.devices) {
          setBluetoothDevices(result.devices);
        }
      } else {
        const devices = await getUsbDevices();
        setUsbDevices(devices);
      }
    } catch (error) {
      console.error("Failed to get devices:", error);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [platform]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const handleSave = useCallback(async () => {
    await updateSettings({
      eventName,
      circleName,
      venueAddress,
      terminalId,
      taxRate: Number.parseInt(taxRate, 10) || 10,
    });
    await updatePrinter(selectedPrinter);
    navigate({ to: "/pos" });
  }, [
    eventName,
    circleName,
    venueAddress,
    terminalId,
    taxRate,
    selectedPrinter,
    updateSettings,
    updatePrinter,
    navigate,
  ]);

  const handleBack = useCallback(() => {
    navigate({ to: "/pos" });
  }, [navigate]);

  const handleSyncProducts = useCallback(async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const count = await syncProducts();
      setSyncResult({ success: true, count });
    } catch (error) {
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : "同期に失敗しました",
      });
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const selectUsbPrinter = useCallback((device: UsbDevice) => {
    setSelectedPrinter({
      type: "usb",
      vendorId: device.vendor_id,
      deviceId: device.device_id,
      name:
        device.name || `USB Printer (${device.vendor_id}:${device.device_id})`,
      paperWidth: 58,
    });
  }, []);

  const selectBluetoothPrinter = useCallback((device: BluetoothDevice) => {
    setSelectedPrinter({
      type: "bluetooth",
      bluetoothAddress: device.address,
      name: device.name || device.address,
      paperWidth: 58,
    });
  }, []);

  const isUsbDeviceSelected = (device: UsbDevice) =>
    selectedPrinter?.vendorId === device.vendor_id &&
    selectedPrinter?.deviceId === device.device_id;

  const isBluetoothDeviceSelected = (device: BluetoothDevice) =>
    selectedPrinter?.bluetoothAddress === device.address;

  if (!session) {
    return null;
  }

  const isBluetoothMode = platform === "android" || isAndroid();

  return (
    <div className={pageStyles.container}>
      {/* ヘッダー */}
      <header className={pageStyles.header}>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          ← 戻る
        </Button>
        <h1 className={pageStyles.title}>設定</h1>
      </header>

      {/* コンテンツ */}
      <div className={pageStyles.content}>
        <div className={pageStyles.contentInner}>
          {/* 基本設定 */}
          <Card padding="lg">
            <h2 className={sectionStyles.title}>基本設定</h2>
            <div className={css({ marginTop: "20px" })}>
              <div className={sectionStyles.field}>
                <Input
                  label="イベント名"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="例: コミックマーケット C104"
                />
              </div>

              <div className={sectionStyles.field}>
                <span
                  className={css({
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#94a3b8",
                    marginBottom: "8px",
                  })}
                >
                  サークル名
                </span>
                {session?.circles && session.circles.length > 0 ? (
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    })}
                  >
                    <select
                      value={
                        session.circles.some((c) => c.name === circleName)
                          ? circleName
                          : "__custom__"
                      }
                      onChange={(e) => {
                        if (e.target.value !== "__custom__") {
                          setCircleName(e.target.value);
                        }
                      }}
                      className={css({
                        width: "100%",
                        padding: "12px 14px",
                        fontSize: "15px",
                        color: "#f8fafc",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        cursor: "pointer",
                        _focus: {
                          outline: "none",
                          borderColor: "#3b82f6",
                        },
                      })}
                    >
                      {session.circles.map((circle) => (
                        <option key={circle.publisher_id} value={circle.name}>
                          {circle.name}
                        </option>
                      ))}
                      <option value="__custom__">その他（手入力）</option>
                    </select>
                    {(!session.circles.some((c) => c.name === circleName) ||
                      circleName === "") && (
                      <Input
                        value={circleName}
                        onChange={(e) => setCircleName(e.target.value)}
                        placeholder="サークル名を入力"
                      />
                    )}
                  </div>
                ) : (
                  <Input
                    value={circleName}
                    onChange={(e) => setCircleName(e.target.value)}
                    placeholder="例: ミズPOS出版"
                  />
                )}
              </div>

              <div className={sectionStyles.field}>
                <Input
                  label="会場住所"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  placeholder="例: 東京都江東区有明3-11-1"
                />
              </div>

              <div className={sectionStyles.field}>
                <Input
                  label="端末ID"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  placeholder="例: POS-01"
                />
              </div>

              <div className={sectionStyles.fieldLast}>
                <Input
                  label="消費税率 (%)"
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  min={0}
                  max={100}
                />
              </div>
            </div>
          </Card>

          {/* 商品データ同期 */}
          <Card padding="lg">
            <div className={sectionStyles.header}>
              <h2 className={sectionStyles.title}>商品データ</h2>
            </div>
            <div
              className={css({
                fontSize: "14px",
                color: "#94a3b8",
                marginBottom: "16px",
              })}
            >
              サーバーから最新の商品データを取得します。バーコードスキャンを行う前に必ず同期してください。
            </div>
            <Button
              variant="outline"
              onClick={handleSyncProducts}
              disabled={isSyncing}
              fullWidth
            >
              {isSyncing ? "同期中..." : "商品データを同期"}
            </Button>
            {syncResult && (
              <div
                className={css({
                  marginTop: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  background: syncResult.success ? "#14532d" : "#7f1d1d",
                  color: syncResult.success ? "#86efac" : "#fca5a5",
                })}
              >
                {syncResult.success
                  ? `${syncResult.count}件の商品を同期しました`
                  : `エラー: ${syncResult.error}`}
              </div>
            )}
          </Card>

          {/* プリンター設定 */}
          <Card padding="lg">
            <div className={sectionStyles.header}>
              <h2 className={sectionStyles.title}>プリンター設定</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshDevices}
                disabled={isLoadingDevices}
              >
                {isLoadingDevices ? "検索中..." : "デバイス更新"}
              </Button>
            </div>

            {/* 現在の選択 */}
            {selectedPrinter && (
              <div className={printerStyles.selected}>
                <div>
                  <div className={printerStyles.selectedLabel}>
                    選択中のプリンター
                  </div>
                  <div className={printerStyles.selectedName}>
                    {selectedPrinter.name}
                  </div>
                </div>
                <Badge variant="success" size="sm">
                  {selectedPrinter.type === "usb" ? "USB" : "Bluetooth"}
                </Badge>
              </div>
            )}

            {/* プリンターなし選択 */}
            <button
              type="button"
              onClick={() => setSelectedPrinter(undefined)}
              className={`${printerStyles.deviceButton} ${!selectedPrinter ? printerStyles.deviceButtonSelected : ""}`}
            >
              <span>プリンターなし（レシート印刷しない）</span>
              {!selectedPrinter && (
                <Badge variant="info" size="sm">
                  選択中
                </Badge>
              )}
            </button>

            {/* デバイス一覧 */}
            <div className={printerStyles.sectionLabel}>
              {isBluetoothMode ? "Bluetoothプリンター" : "USBプリンター"}
            </div>

            <div className={printerStyles.deviceList}>
              {isBluetoothMode ? (
                bluetoothDevices.length === 0 ? (
                  <div className={printerStyles.emptyState}>
                    ペアリング済みのBluetoothデバイスがありません
                  </div>
                ) : (
                  bluetoothDevices.map((device) => (
                    <button
                      key={device.address}
                      type="button"
                      onClick={() => selectBluetoothPrinter(device)}
                      className={`${printerStyles.deviceButton} ${isBluetoothDeviceSelected(device) ? printerStyles.deviceButtonSelected : ""}`}
                    >
                      <span>{device.name || device.address}</span>
                      {isBluetoothDeviceSelected(device) && (
                        <Badge variant="info" size="sm">
                          選択中
                        </Badge>
                      )}
                    </button>
                  ))
                )
              ) : usbDevices.length === 0 ? (
                <div className={printerStyles.emptyState}>
                  接続されているUSBプリンターがありません
                </div>
              ) : (
                usbDevices.map((device) => (
                  <button
                    key={`${device.vendor_id}-${device.device_id}`}
                    type="button"
                    onClick={() => selectUsbPrinter(device)}
                    className={`${printerStyles.deviceButton} ${isUsbDeviceSelected(device) ? printerStyles.deviceButtonSelected : ""}`}
                  >
                    <span>
                      {device.name ||
                        `USB Device (${device.vendor_id}:${device.device_id})`}
                    </span>
                    {isUsbDeviceSelected(device) && (
                      <Badge variant="info" size="sm">
                        選択中
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* 保存ボタン */}
          <Button variant="primary" size="xl" fullWidth onClick={handleSave}>
            設定を保存
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
