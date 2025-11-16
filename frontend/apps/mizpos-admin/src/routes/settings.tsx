import { IconDeviceFloppy } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

interface BrandSettings {
  storeName: string;
  storeDescription: string;
  contactEmail: string;
  logoUrl: string;
}

interface PaymentSettings {
  enableStripeOnline: boolean;
  enableStripeTerminal: boolean;
  enableCash: boolean;
  stripePublicKey: string;
}

interface ConsignmentSettings {
  defaultCommissionRate: number;
  stripeOnlineFeeRate: number;
  stripeTerminalFeeRate: number;
}

function SettingsPage() {
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    storeName: "MizPOS Store",
    storeDescription: "同人誌・グッズ販売",
    contactEmail: "contact@example.com",
    logoUrl: "",
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    enableStripeOnline: true,
    enableStripeTerminal: true,
    enableCash: true,
    stripePublicKey: "",
  });

  const [consignmentSettings, setConsignmentSettings] = useState<ConsignmentSettings>({
    defaultCommissionRate: 30,
    stripeOnlineFeeRate: 3.6,
    stripeTerminalFeeRate: 2.7,
  });

  const [activeTab, setActiveTab] = useState<"brand" | "payment" | "consignment">("brand");

  const handleSave = () => {
    // TODO: Save to backend
    alert("設定を保存しました");
  };

  const inputClass = css({
    width: "100%",
    padding: "2",
    borderRadius: "md",
    border: "1px solid",
    borderColor: "gray.300",
    fontSize: "sm",
    _focus: {
      outline: "none",
      borderColor: "primary.500",
    },
  });

  const labelClass = css({
    display: "block",
    fontSize: "sm",
    fontWeight: "medium",
    color: "gray.700",
    marginBottom: "1",
  });

  return (
    <>
      <Header title="設定" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
        {/* Tabs */}
        <div
          className={css({
            display: "flex",
            gap: "1",
            marginBottom: "6",
            borderBottom: "1px solid",
            borderColor: "gray.200",
          })}
        >
          {[
            { key: "brand", label: "ブランド設定" },
            { key: "payment", label: "決済設定" },
            { key: "consignment", label: "委託販売設定" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={css({
                padding: "3",
                paddingBottom: "3.5",
                fontSize: "sm",
                fontWeight: "medium",
                color: activeTab === tab.key ? "primary.600" : "gray.500",
                borderBottom: "2px solid",
                borderColor: activeTab === tab.key ? "primary.600" : "transparent",
                marginBottom: "-1px",
                transition: "colors 0.2s",
                _hover: {
                  color: activeTab === tab.key ? "primary.600" : "gray.700",
                },
              })}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Brand Settings */}
        {activeTab === "brand" && (
          <div
            className={css({
              backgroundColor: "white",
              padding: "6",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <h3
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                marginBottom: "4",
              })}
            >
              ブランド設定
            </h3>
            <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
              <div>
                <label htmlFor="storeName" className={labelClass}>
                  ストア名
                </label>
                <input
                  id="storeName"
                  type="text"
                  value={brandSettings.storeName}
                  onChange={(e) => setBrandSettings({ ...brandSettings, storeName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="storeDescription" className={labelClass}>
                  ストア説明
                </label>
                <textarea
                  id="storeDescription"
                  value={brandSettings.storeDescription}
                  onChange={(e) =>
                    setBrandSettings({ ...brandSettings, storeDescription: e.target.value })
                  }
                  rows={3}
                  className={`${inputClass} ${css({ resize: "vertical" })}`}
                />
              </div>
              <div>
                <label htmlFor="contactEmail" className={labelClass}>
                  連絡先メールアドレス
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={brandSettings.contactEmail}
                  onChange={(e) =>
                    setBrandSettings({ ...brandSettings, contactEmail: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="logoUrl" className={labelClass}>
                  ロゴURL
                </label>
                <input
                  id="logoUrl"
                  type="url"
                  value={brandSettings.logoUrl}
                  onChange={(e) => setBrandSettings({ ...brandSettings, logoUrl: e.target.value })}
                  className={inputClass}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment Settings */}
        {activeTab === "payment" && (
          <div
            className={css({
              backgroundColor: "white",
              padding: "6",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <h3
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                marginBottom: "4",
              })}
            >
              決済設定
            </h3>
            <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "3",
                })}
              >
                <label className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                  <input
                    type="checkbox"
                    checked={paymentSettings.enableStripeOnline}
                    onChange={(e) =>
                      setPaymentSettings({
                        ...paymentSettings,
                        enableStripeOnline: e.target.checked,
                      })
                    }
                    className={css({ width: "4", height: "4" })}
                  />
                  <span className={css({ fontSize: "sm", color: "gray.700" })}>
                    Stripeオンライン決済を有効にする
                  </span>
                </label>
                <label className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                  <input
                    type="checkbox"
                    checked={paymentSettings.enableStripeTerminal}
                    onChange={(e) =>
                      setPaymentSettings({
                        ...paymentSettings,
                        enableStripeTerminal: e.target.checked,
                      })
                    }
                    className={css({ width: "4", height: "4" })}
                  />
                  <span className={css({ fontSize: "sm", color: "gray.700" })}>
                    Stripe端末決済を有効にする
                  </span>
                </label>
                <label className={css({ display: "flex", alignItems: "center", gap: "2" })}>
                  <input
                    type="checkbox"
                    checked={paymentSettings.enableCash}
                    onChange={(e) =>
                      setPaymentSettings({
                        ...paymentSettings,
                        enableCash: e.target.checked,
                      })
                    }
                    className={css({ width: "4", height: "4" })}
                  />
                  <span className={css({ fontSize: "sm", color: "gray.700" })}>
                    現金決済を有効にする
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="stripePublicKey" className={labelClass}>
                  Stripe公開キー
                </label>
                <input
                  id="stripePublicKey"
                  type="text"
                  value={paymentSettings.stripePublicKey}
                  onChange={(e) =>
                    setPaymentSettings({ ...paymentSettings, stripePublicKey: e.target.value })
                  }
                  className={inputClass}
                  placeholder="pk_..."
                />
                <p className={css({ fontSize: "xs", color: "gray.500", marginTop: "1" })}>
                  秘密キーはAWS Secrets Managerで管理されます
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Consignment Settings */}
        {activeTab === "consignment" && (
          <div
            className={css({
              backgroundColor: "white",
              padding: "6",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <h3
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
                marginBottom: "4",
              })}
            >
              委託販売設定
            </h3>
            <p className={css({ fontSize: "sm", color: "gray.500", marginBottom: "4" })}>
              委託販売時の手数料率を設定します。売上から手数料を差し引いた金額が委託元への支払い額となります。
            </p>
            <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
              <div>
                <label htmlFor="defaultCommissionRate" className={labelClass}>
                  デフォルト委託手数料率 (%)
                </label>
                <input
                  id="defaultCommissionRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={consignmentSettings.defaultCommissionRate}
                  onChange={(e) =>
                    setConsignmentSettings({
                      ...consignmentSettings,
                      defaultCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="stripeOnlineFeeRate" className={labelClass}>
                  Stripeオンライン決済手数料率 (%)
                </label>
                <input
                  id="stripeOnlineFeeRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={consignmentSettings.stripeOnlineFeeRate}
                  onChange={(e) =>
                    setConsignmentSettings({
                      ...consignmentSettings,
                      stripeOnlineFeeRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="stripeTerminalFeeRate" className={labelClass}>
                  Stripe端末決済手数料率 (%)
                </label>
                <input
                  id="stripeTerminalFeeRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={consignmentSettings.stripeTerminalFeeRate}
                  onChange={(e) =>
                    setConsignmentSettings({
                      ...consignmentSettings,
                      stripeTerminalFeeRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div
                className={css({
                  backgroundColor: "gray.50",
                  padding: "4",
                  borderRadius: "md",
                  marginTop: "2",
                })}
              >
                <h4 className={css({ fontSize: "sm", fontWeight: "semibold", marginBottom: "2" })}>
                  計算例
                </h4>
                <p className={css({ fontSize: "xs", color: "gray.600" })}>
                  ¥1,000の商品をStripeオンラインで販売した場合:
                </p>
                <ul className={css({ fontSize: "xs", color: "gray.600", marginTop: "1" })}>
                  <li>
                    Stripe手数料: ¥{(1000 * (consignmentSettings.stripeOnlineFeeRate / 100)).toFixed(0)}
                  </li>
                  <li>
                    委託手数料: ¥{(1000 * (consignmentSettings.defaultCommissionRate / 100)).toFixed(0)}
                  </li>
                  <li>
                    委託元への支払い: ¥
                    {(
                      1000 -
                      1000 * (consignmentSettings.stripeOnlineFeeRate / 100) -
                      1000 * (consignmentSettings.defaultCommissionRate / 100)
                    ).toFixed(0)}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className={css({ marginTop: "6", display: "flex", justifyContent: "flex-end" })}>
          <Button onClick={handleSave}>
            <IconDeviceFloppy size={18} />
            設定を保存
          </Button>
        </div>
      </div>
    </>
  );
}
