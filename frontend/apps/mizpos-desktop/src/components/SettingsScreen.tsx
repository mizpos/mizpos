import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import type { BluetoothDevice, UsbDevice } from "../lib/printer";
import { type PaperWidth, usePrinterStore } from "../stores/printer";

type Device = UsbDevice | BluetoothDevice;

function isUsbDevice(device: Device): device is UsbDevice {
  return "vendor_id" in device;
}

function isBluetoothDevice(device: Device): device is BluetoothDevice {
  return "address" in device;
}

interface SettingsScreenProps {
  onClose: () => void;
}

const styles = {
  overlay: css({
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  }),
  container: css({
    background: "white",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "600px",
    width: "90%",
    maxHeight: "80vh",
    overflow: "auto",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  }),
  header: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  }),
  title: css({
    fontSize: "24px",
    fontWeight: 700,
    color: "#1a237e",
    margin: 0,
  }),
  closeButton: css({
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    color: "#666",
    padding: "8px",
    borderRadius: "8px",
    _hover: {
      background: "#f5f5f5",
    },
  }),
  section: css({
    marginBottom: "24px",
  }),
  sectionTitle: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#333",
    marginBottom: "12px",
  }),
  platformBadge: css({
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 600,
    marginLeft: "8px",
  }),
  platformDesktop: css({
    background: "#e3f2fd",
    color: "#1565c0",
  }),
  platformAndroid: css({
    background: "#e8f5e9",
    color: "#2e7d32",
  }),
  deviceList: css({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),
  deviceItem: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    _hover: {
      borderColor: "#bdbdbd",
      background: "#fafafa",
    },
  }),
  deviceItemSelected: css({
    borderColor: "#1a237e",
    background: "#e8eaf6",
  }),
  deviceInfo: css({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  }),
  deviceName: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#333",
  }),
  deviceId: css({
    fontSize: "12px",
    color: "#666",
    fontFamily: "monospace",
  }),
  selectedBadge: css({
    background: "#1a237e",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 600,
  }),
  button: css({
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: 600,
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  }),
  primaryButton: css({
    background: "#1a237e",
    color: "white",
    _hover: {
      background: "#283593",
    },
    _disabled: {
      background: "#9fa8da",
      cursor: "not-allowed",
    },
  }),
  secondaryButton: css({
    background: "#f5f5f5",
    color: "#333",
    _hover: {
      background: "#eeeeee",
    },
  }),
  dangerButton: css({
    background: "#ffebee",
    color: "#c62828",
    _hover: {
      background: "#ffcdd2",
    },
  }),
  buttonGroup: css({
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  }),
  message: css({
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    marginTop: "12px",
  }),
  success: css({
    background: "#e8f5e9",
    color: "#2e7d32",
    border: "1px solid #a5d6a7",
  }),
  error: css({
    background: "#ffebee",
    color: "#c62828",
    border: "1px solid #ef9a9a",
  }),
  emptyState: css({
    textAlign: "center",
    padding: "24px",
    color: "#666",
  }),
  refreshButton: css({
    background: "none",
    border: "1px solid #e0e0e0",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
    _hover: {
      background: "#f5f5f5",
    },
  }),
  currentDevice: css({
    padding: "16px",
    background: "#f5f5f5",
    borderRadius: "8px",
    marginBottom: "16px",
  }),
  currentDeviceLabel: css({
    fontSize: "12px",
    color: "#666",
    marginBottom: "4px",
  }),
  currentDeviceValue: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#333",
  }),
  connectionStatus: css({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "8px",
  }),
  statusDot: css({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  }),
  statusConnected: css({
    background: "#4caf50",
  }),
  statusDisconnected: css({
    background: "#f44336",
  }),
  paperWidthSelector: css({
    display: "flex",
    gap: "12px",
    marginTop: "8px",
  }),
  paperWidthOption: css({
    flex: 1,
    padding: "12px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.2s ease",
    _hover: {
      borderColor: "#bdbdbd",
      background: "#fafafa",
    },
  }),
  paperWidthOptionSelected: css({
    borderColor: "#1a237e",
    background: "#e8eaf6",
  }),
  paperWidthLabel: css({
    fontSize: "16px",
    fontWeight: 600,
    color: "#333",
  }),
  paperWidthDesc: css({
    fontSize: "12px",
    color: "#666",
    marginTop: "4px",
  }),
};

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    platform,
    printerConfig,
    isConnected,
    terminalId,
    paperWidth,
    setPaperWidth,
    refreshDevices,
    selectUsbPrinter,
    selectBluetoothPrinter,
    disconnect,
    clearPrinterConfig,
    testPrint,
    initialize,
  } = usePrinterStore();

  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedPaperWidth, setSelectedPaperWidth] =
    useState<PaperWidth>(paperWidth);

  // Initialize printer store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const deviceList = await refreshDevices();
      setDevices(deviceList);
      if (deviceList.length === 0) {
        setMessage({
          type: "error",
          text:
            platform === "android"
              ? "ペアリング済みのBluetoothデバイスが見つかりません。Androidの設定からプリンターをペアリングしてください。"
              : "USBデバイスが見つかりません",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `デバイス取得エラー: ${error}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshDevices, platform]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleSave = useCallback(async () => {
    if (!selectedDevice) return;
    setIsConnecting(true);
    setMessage(null);

    try {
      if (isUsbDevice(selectedDevice)) {
        selectUsbPrinter(selectedDevice);
        setPaperWidth(selectedPaperWidth);
        setMessage({
          type: "success",
          text: "プリンター設定を保存しました",
        });
      } else if (isBluetoothDevice(selectedDevice)) {
        const result = await selectBluetoothPrinter(selectedDevice);
        if (result.success) {
          setPaperWidth(selectedPaperWidth);
          setMessage({
            type: "success",
            text: "Bluetoothプリンターに接続しました",
          });
        } else {
          setMessage({
            type: "error",
            text: `接続エラー: ${result.error}`,
          });
        }
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `保存エラー: ${error}`,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [
    selectedDevice,
    selectUsbPrinter,
    selectBluetoothPrinter,
    selectedPaperWidth,
    setPaperWidth,
  ]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setMessage({
      type: "success",
      text: "プリンターを切断しました",
    });
  }, [disconnect]);

  const handleClear = useCallback(() => {
    clearPrinterConfig();
    setSelectedDevice(null);
    setMessage({
      type: "success",
      text: "プリンター設定をクリアしました",
    });
  }, [clearPrinterConfig]);

  const handleTestPrint = useCallback(async () => {
    setIsPrinting(true);
    setMessage(null);
    try {
      const result = await testPrint();
      if (result.success) {
        setMessage({
          type: "success",
          text: "テスト印刷が完了しました",
        });
      } else {
        setMessage({
          type: "error",
          text: `印刷エラー: ${result.error}`,
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `印刷エラー: ${error}`,
      });
    } finally {
      setIsPrinting(false);
    }
  }, [testPrint]);

  const getDeviceKey = (device: Device): string => {
    if (isUsbDevice(device)) {
      return `usb-${device.vendor_id}-${device.device_id}`;
    }
    return `bt-${device.address}`;
  };

  const isDeviceSelected = (device: Device): boolean => {
    if (!selectedDevice) return false;
    if (isUsbDevice(device) && isUsbDevice(selectedDevice)) {
      return (
        device.vendor_id === selectedDevice.vendor_id &&
        device.device_id === selectedDevice.device_id
      );
    }
    if (isBluetoothDevice(device) && isBluetoothDevice(selectedDevice)) {
      return device.address === selectedDevice.address;
    }
    return false;
  };

  const renderCurrentDevice = () => {
    if (!printerConfig) return null;

    if (printerConfig.type === "usb") {
      return (
        <div className={styles.currentDevice}>
          <div className={styles.currentDeviceLabel}>現在の設定 (USB)</div>
          <div className={styles.currentDeviceValue}>
            {printerConfig.name || "不明なデバイス"} (
            {printerConfig.vendor_id.toString(16).padStart(4, "0")}:
            {printerConfig.device_id.toString(16).padStart(4, "0")})
          </div>
        </div>
      );
    }

    return (
      <div className={styles.currentDevice}>
        <div className={styles.currentDeviceLabel}>現在の設定 (Bluetooth)</div>
        <div className={styles.currentDeviceValue}>
          {printerConfig.name || "不明なデバイス"}
        </div>
        <div className={styles.deviceId}>{printerConfig.address}</div>
        <div className={styles.connectionStatus}>
          <span
            className={`${styles.statusDot} ${isConnected ? styles.statusConnected : styles.statusDisconnected}`}
          />
          <span style={{ fontSize: "12px", color: "#666" }}>
            {isConnected ? "接続中" : "未接続"}
          </span>
        </div>
      </div>
    );
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: モーダルオーバーレイの背景クリックで閉じる標準的なパターン
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="button"
      tabIndex={0}
    >
      <div
        className={styles.container}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>
            設定
            <span
              className={`${styles.platformBadge} ${platform === "android" ? styles.platformAndroid : styles.platformDesktop}`}
            >
              {platform === "android" ? "Android" : "Desktop"}
            </span>
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            レシートプリンター
            {platform === "android" ? " (Bluetooth)" : " (USB)"}
          </h3>

          {renderCurrentDevice()}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "14px", color: "#666" }}>
              {platform === "android"
                ? "ペアリング済みデバイス"
                : "USBデバイス一覧"}
            </span>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={loadDevices}
              disabled={isLoading}
            >
              {isLoading ? "読込中..." : "更新"}
            </button>
          </div>

          <div className={styles.deviceList}>
            {devices.length === 0 ? (
              <div className={styles.emptyState}>
                {isLoading
                  ? "デバイスを検索中..."
                  : platform === "android"
                    ? "Bluetoothデバイスが見つかりません"
                    : "USBデバイスが見つかりません"}
              </div>
            ) : (
              devices.map((device) => {
                const selected = isDeviceSelected(device);
                return (
                  <button
                    type="button"
                    key={getDeviceKey(device)}
                    className={`${styles.deviceItem} ${selected ? styles.deviceItemSelected : ""}`}
                    onClick={() => setSelectedDevice(device)}
                  >
                    <div className={styles.deviceInfo}>
                      <span className={styles.deviceName}>
                        {device.name || "不明なデバイス"}
                      </span>
                      <span className={styles.deviceId}>
                        {isUsbDevice(device)
                          ? `VID: ${device.vendor_id.toString(16).padStart(4, "0")} / PID: ${device.device_id.toString(16).padStart(4, "0")}`
                          : device.address}
                      </span>
                    </div>
                    {selected && (
                      <span className={styles.selectedBadge}>選択中</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={`${styles.button} ${styles.primaryButton}`}
              onClick={handleSave}
              disabled={!selectedDevice || isConnecting}
            >
              {isConnecting
                ? "接続中..."
                : platform === "android"
                  ? "接続"
                  : "保存"}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={handleTestPrint}
              disabled={!printerConfig || isPrinting || !isConnected}
            >
              {isPrinting ? "印刷中..." : "テスト印刷"}
            </button>
            {platform === "android" && isConnected && (
              <button
                type="button"
                className={`${styles.button} ${styles.dangerButton}`}
                onClick={handleDisconnect}
              >
                切断
              </button>
            )}
          </div>

          {printerConfig && (
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                className={`${styles.button} ${styles.dangerButton}`}
                onClick={handleClear}
                style={{ width: "100%" }}
              >
                プリンター設定をクリア
              </button>
            </div>
          )}

          {message && (
            <div
              className={`${styles.message} ${message.type === "success" ? styles.success : styles.error}`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>用紙サイズ</h3>
          <div className={styles.paperWidthSelector}>
            <button
              type="button"
              className={`${styles.paperWidthOption} ${selectedPaperWidth === 58 ? styles.paperWidthOptionSelected : ""}`}
              onClick={() => setSelectedPaperWidth(58)}
            >
              <div className={styles.paperWidthLabel}>58mm</div>
              <div className={styles.paperWidthDesc}>32文字/行</div>
            </button>
            <button
              type="button"
              className={`${styles.paperWidthOption} ${selectedPaperWidth === 80 ? styles.paperWidthOptionSelected : ""}`}
              onClick={() => setSelectedPaperWidth(80)}
            >
              <div className={styles.paperWidthLabel}>80mm</div>
              <div className={styles.paperWidthDesc}>48文字/行</div>
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>端末情報</h3>
          <div className={styles.currentDevice}>
            <div className={styles.currentDeviceLabel}>ターミナルID</div>
            <div className={styles.currentDeviceValue}>
              {terminalId || "未設定"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
