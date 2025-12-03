import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { css } from "styled-system/css";
import {
  getBluetoothDevices,
  getPlatform,
  getUsbDevices,
  isAndroid,
  type BluetoothDevice,
  type Platform,
  type UsbDevice,
} from "../lib/printer";
import { useAuthStore } from "../stores/auth";
import { useSettingsStore } from "../stores/settings";
import type { PrinterConfig } from "../types";

function SettingsPage() {
  const { session } = useAuthStore();
  const { settings, updateSettings, updatePrinter } = useSettingsStore();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState(settings.eventName);
  const [terminalId, setTerminalId] = useState(settings.terminalId);
  const [taxRate, setTaxRate] = useState(String(settings.taxRate));

  const [platform, setPlatform] = useState<Platform>("desktop");
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterConfig | undefined>(
    settings.printer
  );

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
      terminalId,
      taxRate: Number.parseInt(taxRate, 10) || 10,
    });
    await updatePrinter(selectedPrinter);
    navigate({ to: "/pos" });
  }, [eventName, terminalId, taxRate, selectedPrinter, updateSettings, updatePrinter, navigate]);

  const handleBack = useCallback(() => {
    navigate({ to: "/pos" });
  }, [navigate]);

  const selectUsbPrinter = useCallback((device: UsbDevice) => {
    setSelectedPrinter({
      type: "usb",
      vendorId: device.vendor_id,
      deviceId: device.device_id,
      name: device.name || `USB Printer (${device.vendor_id}:${device.device_id})`,
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

  if (!session) {
    return null;
  }

  return (
    <div className={css({
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#0f172a",
      color: "#f8fafc",
    })}>
      {/* ヘッダー */}
      <header className={css({
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 24px",
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        flexShrink: 0,
      })}>
        <button
          type="button"
          onClick={handleBack}
          className={css({
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#94a3b8",
            background: "#334155",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s",
            "&:hover": { background: "#475569", color: "#f8fafc" },
          })}
        >
          ← 戻る
        </button>
        <h1 className={css({ margin: 0, fontSize: "20px", fontWeight: 700 })}>
          設定
        </h1>
      </header>

      {/* コンテンツ */}
      <div className={css({
        flex: 1,
        overflowY: "auto",
        padding: "24px",
      })}>
        <div className={css({
          maxWidth: "560px",
          margin: "0 auto",
        })}>
          {/* 基本設定 */}
          <section className={css({
            background: "#1e293b",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
            border: "1px solid #334155",
          })}>
            <h2 className={css({
              margin: "0 0 20px 0",
              fontSize: "16px",
              fontWeight: 600,
              color: "#f8fafc",
            })}>
              基本設定
            </h2>

            <div className={css({ marginBottom: "16px" })}>
              <label className={css({
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "8px",
              })}>
                イベント名
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "15px",
                  color: "#f8fafc",
                  background: "#0f172a",
                  border: "2px solid #334155",
                  borderRadius: "8px",
                  outline: "none",
                  transition: "border-color 0.15s",
                  "&:focus": { borderColor: "#3b82f6" },
                })}
              />
            </div>

            <div className={css({ marginBottom: "16px" })}>
              <label className={css({
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "8px",
              })}>
                端末ID
              </label>
              <input
                type="text"
                value={terminalId}
                onChange={(e) => setTerminalId(e.target.value)}
                className={css({
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "15px",
                  color: "#f8fafc",
                  background: "#0f172a",
                  border: "2px solid #334155",
                  borderRadius: "8px",
                  outline: "none",
                  transition: "border-color 0.15s",
                  "&:focus": { borderColor: "#3b82f6" },
                })}
              />
            </div>

            <div>
              <label className={css({
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#94a3b8",
                marginBottom: "8px",
              })}>
                消費税率 (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                min={0}
                max={100}
                className={css({
                  width: "100%",
                  padding: "12px 16px",
                  fontSize: "15px",
                  color: "#f8fafc",
                  background: "#0f172a",
                  border: "2px solid #334155",
                  borderRadius: "8px",
                  outline: "none",
                  transition: "border-color 0.15s",
                  "&:focus": { borderColor: "#3b82f6" },
                })}
              />
            </div>
          </section>

          {/* プリンター設定 */}
          <section className={css({
            background: "#1e293b",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "20px",
            border: "1px solid #334155",
          })}>
            <div className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            })}>
              <h2 className={css({
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "#f8fafc",
              })}>
                プリンター設定
              </h2>
              <button
                type="button"
                onClick={refreshDevices}
                disabled={isLoadingDevices}
                className={css({
                  padding: "8px 14px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#3b82f6",
                  background: "transparent",
                  border: "1px solid #3b82f6",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": { background: "#3b82f6", color: "#f8fafc" },
                  "&:disabled": { opacity: 0.5, cursor: "wait" },
                })}
              >
                {isLoadingDevices ? "検索中..." : "更新"}
              </button>
            </div>

            {/* 現在の選択 */}
            {selectedPrinter && (
              <div className={css({
                padding: "14px 16px",
                background: "#14532d",
                borderRadius: "8px",
                marginBottom: "16px",
              })}>
                <div className={css({ fontSize: "12px", color: "#86efac", marginBottom: "4px" })}>
                  選択中
                </div>
                <div className={css({ fontSize: "15px", fontWeight: 600, color: "#f8fafc" })}>
                  {selectedPrinter.name}
                </div>
              </div>
            )}

            {/* プリンターなし選択 */}
            <button
              type="button"
              onClick={() => setSelectedPrinter(undefined)}
              className={css({
                width: "100%",
                padding: "12px 16px",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
                color: !selectedPrinter ? "#f8fafc" : "#94a3b8",
                background: !selectedPrinter ? "#475569" : "#0f172a",
                border: "1px solid #334155",
                borderRadius: "8px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                "&:hover": { background: !selectedPrinter ? "#475569" : "#334155" },
              })}
            >
              プリンターなし
            </button>

            {/* デバイス一覧 */}
            <div className={css({ fontSize: "13px", color: "#64748b", marginBottom: "8px", marginTop: "16px" })}>
              {platform === "android" || isAndroid() ? "Bluetoothプリンター" : "USBプリンター"}
            </div>

            {platform === "android" || isAndroid() ? (
              bluetoothDevices.length === 0 ? (
                <div className={css({ fontSize: "14px", color: "#475569", padding: "12px 0" })}>
                  ペアリング済みのデバイスがありません
                </div>
              ) : (
                bluetoothDevices.map((device) => (
                  <button
                    key={device.address}
                    type="button"
                    onClick={() => selectBluetoothPrinter(device)}
                    className={css({
                      width: "100%",
                      padding: "12px 16px",
                      marginBottom: "8px",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: selectedPrinter?.bluetoothAddress === device.address ? "#f8fafc" : "#94a3b8",
                      background: selectedPrinter?.bluetoothAddress === device.address ? "#3b82f6" : "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                      "&:hover": {
                        background: selectedPrinter?.bluetoothAddress === device.address ? "#2563eb" : "#334155",
                      },
                    })}
                  >
                    {device.name || device.address}
                  </button>
                ))
              )
            ) : usbDevices.length === 0 ? (
              <div className={css({ fontSize: "14px", color: "#475569", padding: "12px 0" })}>
                接続されているUSBプリンターがありません
              </div>
            ) : (
              usbDevices.map((device) => (
                <button
                  key={`${device.vendor_id}-${device.device_id}`}
                  type="button"
                  onClick={() => selectUsbPrinter(device)}
                  className={css({
                    width: "100%",
                    padding: "12px 16px",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color:
                      selectedPrinter?.vendorId === device.vendor_id &&
                      selectedPrinter?.deviceId === device.device_id
                        ? "#f8fafc"
                        : "#94a3b8",
                    background:
                      selectedPrinter?.vendorId === device.vendor_id &&
                      selectedPrinter?.deviceId === device.device_id
                        ? "#3b82f6"
                        : "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    "&:hover": {
                      background:
                        selectedPrinter?.vendorId === device.vendor_id &&
                        selectedPrinter?.deviceId === device.device_id
                          ? "#2563eb"
                          : "#334155",
                    },
                  })}
                >
                  {device.name || `USB Device (${device.vendor_id}:${device.device_id})`}
                </button>
              ))
            )}
          </section>

          {/* 保存ボタン */}
          <button
            type="button"
            onClick={handleSave}
            className={css({
              width: "100%",
              padding: "18px",
              fontSize: "17px",
              fontWeight: 700,
              color: "#0f172a",
              background: "#22c55e",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "all 0.15s",
              "&:hover": { background: "#16a34a" },
              "&:active": { transform: "scale(0.98)" },
            })}
          >
            設定を保存
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
