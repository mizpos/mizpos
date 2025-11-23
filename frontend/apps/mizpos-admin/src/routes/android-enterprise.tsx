import type { MdmComponents } from "@mizpos/api";
import {
  IconDeviceMobile,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthenticatedClients } from "../lib/api";

export const Route = createFileRoute("/android-enterprise")({
  component: AndroidEnterprisePage,
});

type Enterprise = MdmComponents["schemas"]["Enterprise"];
type Policy = MdmComponents["schemas"]["Policy"];
type Device = MdmComponents["schemas"]["Device"];

interface EnrollmentToken {
  token: string;
  name: string;
  qr_code?: string;
  policy_name: string;
  enrollment_type: string;
  expiration_timestamp: string;
}

function AndroidEnterprisePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"policies" | "devices">(
    "policies",
  );
  const [selectedEnterprise, setSelectedEnterprise] =
    useState<Enterprise | null>(null);
  const [isCreateEnterpriseModalOpen, setIsCreateEnterpriseModalOpen] =
    useState(false);
  const [isCreatePolicyModalOpen, setIsCreatePolicyModalOpen] = useState(false);
  const [isEnrollDeviceModalOpen, setIsEnrollDeviceModalOpen] = useState(false);
  const [enrollmentToken, setEnrollmentToken] =
    useState<EnrollmentToken | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [policyForm, setPolicyForm] = useState({
    name: "",
    policy_data: {
      passwordRequirements: {
        requirePasswordUnlock: "REQUIRE_PASSWORD_UNLOCK_UNSPECIFIED",
        passwordMinimumLength: 6,
      },
      screenCaptureDisabled: false,
      cameraDisabled: false,
      kioskCustomLauncherEnabled: false,
    } as Record<string, unknown>,
  });

  const [selectedPolicy, setSelectedPolicy] = useState("");

  const { data: enterprises = [], isLoading: enterprisesLoading } = useQuery({
    queryKey: ["mdm-enterprises"],
    queryFn: async () => {
      const { mdm } = await getAuthenticatedClients();
      const { data, error } = await mdm.GET("/enterprises");
      if (error) throw new Error("Failed to fetch enterprises");
      return data?.enterprises || [];
    },
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["mdm-policies", selectedEnterprise?.id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { mdm } = await getAuthenticatedClients();
      const { data, error } = await mdm.GET("/policies", {
        params: { query: { enterprise_id: selectedEnterprise.id } },
      });
      if (error) throw new Error("Failed to fetch policies");
      return data?.policies || [];
    },
    enabled: !!selectedEnterprise,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ["mdm-devices", selectedEnterprise?.id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { mdm } = await getAuthenticatedClients();
      const { data, error } = await mdm.GET("/devices", {
        params: { query: { enterprise_id: selectedEnterprise.id } },
      });
      if (error) throw new Error("Failed to fetch devices");
      return data?.devices || [];
    },
    enabled: !!selectedEnterprise,
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (formData: typeof policyForm) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { mdm } = await getAuthenticatedClients();
      const { data, error } = await mdm.POST("/policies", {
        body: {
          enterprise_id: selectedEnterprise.id,
          name: formData.name,
          policy_data: formData.policy_data,
        },
      });
      if (error) throw new Error("Failed to create policy");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mdm-policies", selectedEnterprise?.id],
      });
      setIsCreatePolicyModalOpen(false);
      setPolicyForm({
        name: "",
        policy_data: {
          passwordRequirements: {
            requirePasswordUnlock: "REQUIRE_PASSWORD_UNLOCK_UNSPECIFIED",
            passwordMinimumLength: 6,
          },
          screenCaptureDisabled: false,
          cameraDisabled: false,
          kioskCustomLauncherEnabled: false,
        },
      });
    },
  });

  const createEnrollmentTokenMutation = useMutation({
    mutationFn: async (_policyName: string) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      throw new Error("Enrollment token API not yet implemented");
    },
    onSuccess: (data: EnrollmentToken) => {
      setEnrollmentToken(data);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { mdm } = await getAuthenticatedClients();
      const { error } = await mdm.DELETE("/devices/{device_id}", {
        params: { path: { device_id: deviceId } },
      });
      if (error) throw new Error("Failed to delete device");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mdm-devices", selectedEnterprise?.id],
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const enterpriseColumns = [
    { key: "id", header: "ID" },
    { key: "enterprise_display_name", header: "表示名" },
    {
      key: "created_at",
      header: "作成日時",
      render: (item: Enterprise) => formatDate(item.created_at),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Enterprise) => (
        <Button
          variant="primary"
          size="sm"
          onClick={() => setSelectedEnterprise(item)}
        >
          選択
        </Button>
      ),
    },
  ];

  const policyColumns = [
    { key: "name", header: "ポリシー名" },
    {
      key: "created_at",
      header: "作成日時",
      render: (item: Policy) => formatDate(item.created_at),
    },
  ];

  const deviceColumns = [
    { key: "id", header: "デバイスID" },
    { key: "applied_policy_name", header: "ポリシー" },
    { key: "state", header: "状態" },
    {
      key: "last_status_report_time",
      header: "最終レポート",
      render: (item: Device) =>
        item.last_status_report_time
          ? formatDate(item.last_status_report_time)
          : "-",
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Device) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (
              window.confirm(
                "このデバイスを削除しますか？デバイスのデータは消去されます。",
              )
            ) {
              deleteDeviceMutation.mutate(item.id);
            }
          }}
          disabled={deleteDeviceMutation.isPending}
        >
          <IconTrash size={16} />
        </Button>
      ),
    },
  ];

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
      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
    },
  });

  const labelClass = css({
    display: "block",
    fontSize: "sm",
    fontWeight: "medium",
    color: "gray.700",
    marginBottom: "1",
  });

  const tabClass = (isActive: boolean) =>
    css({
      padding: "3",
      paddingX: "4",
      borderRadius: "md",
      cursor: "pointer",
      fontSize: "sm",
      fontWeight: "medium",
      border: "none",
      backgroundColor: isActive ? "primary.500" : "gray.100",
      color: isActive ? "white" : "gray.700",
      transition: "all 0.2s",
      _hover: {
        backgroundColor: isActive ? "primary.600" : "gray.200",
      },
    });

  return (
    <>
      <Header title="端末管理 (Android Enterprise)" />
      <div className={css({ flex: "1", padding: "6", overflowY: "auto" })}>
        {selectedEnterprise ? (
          <>
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "3",
                })}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedEnterprise(null)}
                >
                  戻る
                </Button>
                <h2
                  className={css({
                    fontSize: "lg",
                    fontWeight: "bold",
                    color: "gray.900",
                  })}
                >
                  {selectedEnterprise.enterprise_display_name ||
                    selectedEnterprise.id}
                </h2>
              </div>
              <div className={css({ display: "flex", gap: "2" })}>
                <button
                  type="button"
                  className={tabClass(activeTab === "policies")}
                  onClick={() => setActiveTab("policies")}
                >
                  <IconShield
                    size={16}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  ポリシー
                </button>
                <button
                  type="button"
                  className={tabClass(activeTab === "devices")}
                  onClick={() => setActiveTab("devices")}
                >
                  <IconDeviceMobile
                    size={16}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  デバイス
                </button>
              </div>
            </div>

            {activeTab === "policies" && (
              <>
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4",
                  })}
                >
                  <div />
                  <Button
                    variant="primary"
                    onClick={() => setIsCreatePolicyModalOpen(true)}
                  >
                    <IconPlus size={18} />
                    ポリシー作成
                  </Button>
                </div>
                {policiesLoading ? (
                  <p>読み込み中...</p>
                ) : (
                  <Table
                    columns={policyColumns}
                    data={policies}
                    keyExtractor={(item) => item.id}
                    emptyMessage="ポリシーがありません"
                  />
                )}
              </>
            )}

            {activeTab === "devices" && (
              <>
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "4",
                  })}
                >
                  <div />
                  <div className={css({ display: "flex", gap: "2" })}>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        queryClient.invalidateQueries({
                          queryKey: ["mdm-devices", selectedEnterprise.id],
                        })
                      }
                    >
                      <IconRefresh size={18} />
                      更新
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setIsEnrollDeviceModalOpen(true)}
                      disabled={policies.length === 0}
                    >
                      <IconQrcode size={18} />
                      デバイス登録
                    </Button>
                  </div>
                </div>
                {devicesLoading ? (
                  <p>読み込み中...</p>
                ) : (
                  <Table
                    columns={deviceColumns}
                    data={devices}
                    keyExtractor={(item) => item.id}
                    emptyMessage="デバイスがありません"
                  />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4",
              })}
            >
              <div
                className={css({
                  position: "relative",
                  width: "300px",
                })}
              >
                <IconSearch
                  size={18}
                  className={css({
                    position: "absolute",
                    left: "3",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "gray.400",
                  })}
                />
                <input
                  type="text"
                  placeholder="検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={css({
                    width: "100%",
                    paddingLeft: "10",
                    paddingRight: "3",
                    paddingY: "2",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                      boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                    },
                  })}
                />
              </div>
              <Button
                variant="primary"
                onClick={() => setIsCreateEnterpriseModalOpen(true)}
              >
                <IconPlus size={18} />
                エンタープライズ登録
              </Button>
            </div>

            {enterprisesLoading ? (
              <p>読み込み中...</p>
            ) : (
              <Table
                columns={enterpriseColumns}
                data={enterprises.filter(
                  (e) =>
                    e.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (e.enterprise_display_name || "")
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                )}
                keyExtractor={(item) => item.id}
                emptyMessage="エンタープライズがありません"
              />
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={isCreateEnterpriseModalOpen}
        onClose={() => setIsCreateEnterpriseModalOpen(false)}
        title="エンタープライズ登録"
        size="lg"
      >
        <div className={css({ padding: "4" })}>
          <p className={css({ marginBottom: "4", color: "gray.600" })}>
            Android
            Enterpriseのエンタープライズを登録するには、Google管理コンソールでの設定が必要です。
          </p>
          <ol
            className={css({
              paddingLeft: "6",
              marginBottom: "4",
              color: "gray.700",
            })}
          >
            <li>サインアップURLを生成</li>
            <li>管理者がURLにアクセスして登録</li>
            <li>コールバックで取得したトークンでエンタープライズを作成</li>
          </ol>
          <p className={css({ color: "gray.500", fontSize: "sm" })}>
            詳細な手順はGoogle Developers ドキュメントを参照してください。
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isCreatePolicyModalOpen}
        onClose={() => setIsCreatePolicyModalOpen(false)}
        title="ポリシー作成"
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPolicyMutation.mutate(policyForm);
          }}
        >
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "4",
            })}
          >
            <div>
              <label htmlFor="policy_name" className={labelClass}>
                ポリシー名 *
              </label>
              <input
                id="policy_name"
                type="text"
                required
                value={policyForm.name}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, name: e.target.value })
                }
                className={inputClass}
                placeholder="例: pos-kiosk-policy"
              />
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "2",
              })}
            >
              <input
                id="screen_capture_disabled"
                type="checkbox"
                checked={
                  policyForm.policy_data.screenCaptureDisabled as boolean
                }
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    policy_data: {
                      ...policyForm.policy_data,
                      screenCaptureDisabled: e.target.checked,
                    },
                  })
                }
              />
              <label htmlFor="screen_capture_disabled" className={labelClass}>
                スクリーンキャプチャ無効
              </label>
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "2",
              })}
            >
              <input
                id="camera_disabled"
                type="checkbox"
                checked={policyForm.policy_data.cameraDisabled as boolean}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    policy_data: {
                      ...policyForm.policy_data,
                      cameraDisabled: e.target.checked,
                    },
                  })
                }
              />
              <label htmlFor="camera_disabled" className={labelClass}>
                カメラ無効
              </label>
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "2",
              })}
            >
              <input
                id="kiosk_mode_enabled"
                type="checkbox"
                checked={
                  policyForm.policy_data.kioskCustomLauncherEnabled as boolean
                }
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    policy_data: {
                      ...policyForm.policy_data,
                      kioskCustomLauncherEnabled: e.target.checked,
                    },
                  })
                }
              />
              <label htmlFor="kiosk_mode_enabled" className={labelClass}>
                キオスクモード有効
              </label>
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "flex-end",
              gap: "2",
              marginTop: "6",
            })}
          >
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsCreatePolicyModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createPolicyMutation.isPending}>
              {createPolicyMutation.isPending ? "作成中..." : "作成"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEnrollDeviceModalOpen}
        onClose={() => {
          setIsEnrollDeviceModalOpen(false);
          setEnrollmentToken(null);
          setSelectedPolicy("");
        }}
        title="デバイス登録"
        size="lg"
      >
        {enrollmentToken ? (
          <div className={css({ textAlign: "center", padding: "4" })}>
            <p className={css({ marginBottom: "4", fontWeight: "bold" })}>
              QRコードをデバイスでスキャンしてください
            </p>
            {enrollmentToken.qr_code && (
              <div
                className={css({
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "4",
                })}
              >
                <img
                  src={`data:image/png;base64,${enrollmentToken.qr_code}`}
                  alt="Enrollment QR Code"
                  className={css({ maxWidth: "200px" })}
                />
              </div>
            )}
            <p className={css({ fontSize: "sm", color: "gray.500" })}>
              有効期限: {formatDate(enrollmentToken.expiration_timestamp)}
            </p>
            <p
              className={css({
                fontSize: "xs",
                color: "gray.400",
                marginTop: "2",
              })}
            >
              トークン: {enrollmentToken.token}
            </p>
          </div>
        ) : (
          <div className={css({ padding: "4" })}>
            <div className={css({ marginBottom: "4" })}>
              <label htmlFor="select_policy" className={labelClass}>
                適用するポリシー *
              </label>
              <select
                id="select_policy"
                value={selectedPolicy}
                onChange={(e) => setSelectedPolicy(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">選択してください</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div
              className={css({
                display: "flex",
                justifyContent: "flex-end",
                gap: "2",
              })}
            >
              <Button
                variant="secondary"
                onClick={() => setIsEnrollDeviceModalOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={() =>
                  createEnrollmentTokenMutation.mutate(selectedPolicy)
                }
                disabled={
                  !selectedPolicy || createEnrollmentTokenMutation.isPending
                }
              >
                {createEnrollmentTokenMutation.isPending
                  ? "生成中..."
                  : "QRコード生成"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
