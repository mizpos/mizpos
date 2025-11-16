import { IconDeviceFloppy, IconLock } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { updatePassword } from "aws-amplify/auth";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { getAuthHeaders } from "../lib/api";
import { useAuth } from "../lib/auth";

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

const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

async function fetchConfig(configKey: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_GATEWAY_BASE}/sales/config/${configKey}`,
    {
      headers,
    }
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  }
  const data = await response.json();
  return data.config?.value || null;
}

async function saveConfig(
  configKey: string,
  value: BrandSettings | PaymentSettings | ConsignmentSettings
) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_GATEWAY_BASE}/sales/config/${configKey}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ value }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to save config: ${response.statusText}`);
  }
  return response.json();
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    storeName: "",
    storeDescription: "",
    contactEmail: "",
    logoUrl: "",
  });

  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    enableStripeOnline: true,
    enableStripeTerminal: true,
    enableCash: true,
    stripePublicKey: "",
  });

  const [consignmentSettings, setConsignmentSettings] =
    useState<ConsignmentSettings>({
      defaultCommissionRate: 30,
      stripeOnlineFeeRate: 3.6,
      stripeTerminalFeeRate: 3.6,
    });

  // パスワード変更用の状態
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "brand" | "payment" | "consignment" | "account"
  >("brand");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load settings from backend
  const { data: loadedBrandSettings, isLoading: isLoadingBrand } = useQuery({
    queryKey: ["config", "brand_settings"],
    queryFn: () => fetchConfig("brand_settings"),
  });

  const { data: loadedPaymentSettings, isLoading: isLoadingPayment } = useQuery(
    {
      queryKey: ["config", "payment_settings"],
      queryFn: () => fetchConfig("payment_settings"),
    }
  );

  const { data: loadedConsignmentSettings, isLoading: isLoadingConsignment } =
    useQuery({
      queryKey: ["config", "consignment_settings"],
      queryFn: () => fetchConfig("consignment_settings"),
    });

  // Update local state when data is loaded
  useEffect(() => {
    if (loadedBrandSettings) {
      setBrandSettings(loadedBrandSettings as BrandSettings);
    }
  }, [loadedBrandSettings]);

  useEffect(() => {
    if (loadedPaymentSettings) {
      setPaymentSettings(loadedPaymentSettings as PaymentSettings);
    }
  }, [loadedPaymentSettings]);

  useEffect(() => {
    if (loadedConsignmentSettings) {
      setConsignmentSettings(loadedConsignmentSettings as ConsignmentSettings);
    }
  }, [loadedConsignmentSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        saveConfig("brand_settings", brandSettings),
        saveConfig("payment_settings", paymentSettings),
        saveConfig("consignment_settings", consignmentSettings),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setSaveError(null);
      alert("設定を保存しました");
    },
    onError: (error: Error) => {
      setSaveError(error.message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) {
        throw new Error("新しいパスワードが一致しません");
      }
      if (newPassword.length < 8) {
        throw new Error("パスワードは8文字以上である必要があります");
      }
      await updatePassword({ oldPassword, newPassword });
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: Error) => {
      setPasswordSuccess(false);
      if (error.message.includes("Incorrect")) {
        setPasswordError("現在のパスワードが正しくありません");
      } else if (error.message.includes("policy")) {
        setPasswordError(
          "新しいパスワードは大文字・小文字・数字・特殊文字を含む必要があります"
        );
      } else {
        setPasswordError(error.message);
      }
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handlePasswordChange = () => {
    setPasswordError(null);
    passwordMutation.mutate();
  };

  const isLoading = isLoadingBrand || isLoadingPayment || isLoadingConsignment;

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
        {isLoading && (
          <div
            className={css({
              textAlign: "center",
              padding: "8",
              color: "gray.500",
            })}
          >
            設定を読み込み中...
          </div>
        )}

        {saveError && (
          <div
            className={css({
              backgroundColor: "red.50",
              border: "1px solid",
              borderColor: "red.200",
              borderRadius: "md",
              padding: "4",
              marginBottom: "4",
              color: "red.700",
              fontSize: "sm",
            })}
          >
            保存エラー: {saveError}
          </div>
        )}

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
            { key: "account", label: "アカウント設定" },
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
                borderColor:
                  activeTab === tab.key ? "primary.600" : "transparent",
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
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label htmlFor="storeName" className={labelClass}>
                  ストア名
                </label>
                <input
                  id="storeName"
                  type="text"
                  value={brandSettings.storeName}
                  onChange={(e) =>
                    setBrandSettings({
                      ...brandSettings,
                      storeName: e.target.value,
                    })
                  }
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
                    setBrandSettings({
                      ...brandSettings,
                      storeDescription: e.target.value,
                    })
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
                    setBrandSettings({
                      ...brandSettings,
                      contactEmail: e.target.value,
                    })
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
                  onChange={(e) =>
                    setBrandSettings({
                      ...brandSettings,
                      logoUrl: e.target.value,
                    })
                  }
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
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "3",
                })}
              >
                <label
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                  })}
                >
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
                <label
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                  })}
                >
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
                <label
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                  })}
                >
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
                    setPaymentSettings({
                      ...paymentSettings,
                      stripePublicKey: e.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="pk_..."
                />
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
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
            <p
              className={css({
                fontSize: "sm",
                color: "gray.500",
                marginBottom: "4",
              })}
            >
              委託販売時の手数料率を設定します。売上から手数料を差し引いた金額が委託元への支払い額となります。
            </p>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
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
                <h4
                  className={css({
                    fontSize: "sm",
                    fontWeight: "semibold",
                    marginBottom: "2",
                  })}
                >
                  計算例
                </h4>
                <p className={css({ fontSize: "xs", color: "gray.600" })}>
                  ¥1,000の商品をStripeオンラインで販売した場合:
                </p>
                <ul
                  className={css({
                    fontSize: "xs",
                    color: "gray.600",
                    marginTop: "1",
                  })}
                >
                  <li>
                    Stripe手数料: ¥
                    {(
                      1000 *
                      (consignmentSettings.stripeOnlineFeeRate / 100)
                    ).toFixed(0)}
                  </li>
                  <li>
                    委託手数料: ¥
                    {(
                      1000 *
                      (consignmentSettings.defaultCommissionRate / 100)
                    ).toFixed(0)}
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

        {/* Account Settings */}
        {activeTab === "account" && (
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
              アカウント設定
            </h3>

            {/* Current User Info */}
            <div
              className={css({
                backgroundColor: "gray.50",
                padding: "4",
                borderRadius: "md",
                marginBottom: "6",
              })}
            >
              <h4
                className={css({
                  fontSize: "sm",
                  fontWeight: "semibold",
                  marginBottom: "2",
                })}
              >
                現在のユーザー
              </h4>
              <p className={css({ fontSize: "sm", color: "gray.600" })}>
                メールアドレス: {user?.email || user?.username || "不明"}
              </p>
            </div>

            {/* Password Change Form */}
            <div>
              <h4
                className={css({
                  fontSize: "md",
                  fontWeight: "semibold",
                  marginBottom: "4",
                })}
              >
                パスワード変更
              </h4>

              {passwordError && (
                <div
                  className={css({
                    backgroundColor: "red.50",
                    border: "1px solid",
                    borderColor: "red.200",
                    borderRadius: "md",
                    padding: "3",
                    marginBottom: "4",
                    color: "red.700",
                    fontSize: "sm",
                  })}
                >
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div
                  className={css({
                    backgroundColor: "green.50",
                    border: "1px solid",
                    borderColor: "green.200",
                    borderRadius: "md",
                    padding: "3",
                    marginBottom: "4",
                    color: "green.700",
                    fontSize: "sm",
                  })}
                >
                  パスワードを変更しました
                </div>
              )}

              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "4",
                })}
              >
                <div>
                  <label htmlFor="oldPassword" className={labelClass}>
                    現在のパスワード
                  </label>
                  <input
                    id="oldPassword"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className={labelClass}>
                    新しいパスワード
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                  <p
                    className={css({
                      fontSize: "xs",
                      color: "gray.500",
                      marginTop: "1",
                    })}
                  >
                    8文字以上、大文字・小文字・数字・特殊文字を含む必要があります
                  </p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className={labelClass}>
                    新しいパスワード（確認）
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                  />
                </div>

                <div className={css({ marginTop: "2" })}>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={
                      passwordMutation.isPending ||
                      !oldPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                  >
                    <IconLock size={18} />
                    {passwordMutation.isPending
                      ? "変更中..."
                      : "パスワードを変更"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        {activeTab !== "account" && (
          <div
            className={css({
              marginTop: "6",
              display: "flex",
              justifyContent: "flex-end",
            })}
          >
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isLoading}
            >
              <IconDeviceFloppy size={18} />
              {saveMutation.isPending ? "保存中..." : "設定を保存"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
