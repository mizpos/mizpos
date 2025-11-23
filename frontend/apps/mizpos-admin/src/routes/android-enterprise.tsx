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

interface Enterprise {
  enterprise_id: string;
  name: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
}

interface Policy {
  policy_id: string;
  policy_name: string;
  policy_display_name?: string;
  enterprise_id: string;
  created_at: string;
  updated_at: string;
}

interface Device {
  device_id: string;
  name: string;
  enterprise_id: string;
  policy_name: string;
  enrollment_state: string;
  last_status_report_time?: string;
}

interface EnrollmentToken {
  token: string;
  name: string;
  qr_code?: string;
  policy_name: string;
  enrollment_type: string;
  expiration_timestamp: string;
}

const API_BASE = "/mdm";

function AndroidEnterprisePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "enterprises" | "policies" | "devices"
  >("enterprises");
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
    policy_name: "",
    policy_display_name: "",
    password_required: true,
    password_minimum_length: 6,
    screen_capture_disabled: false,
    camera_disabled: false,
    kiosk_mode_enabled: false,
    kiosk_launcher_package: "",
  });

  const [selectedPolicy, setSelectedPolicy] = useState("");

  const { data: enterprises = [], isLoading: enterprisesLoading } = useQuery({
    queryKey: ["mdm-enterprises"],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(`${mdmUrl}/enterprises`, {
        headers: {
          Authorization:
            accounts.c?.headers?.Authorization ||
            (await getAuthHeaders()).Authorization,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch enterprises");
      const data = await response.json();
      return (data.enterprises || []) as Enterprise[];
    },
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["mdm-policies", selectedEnterprise?.enterprise_id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(
        `${mdmUrl}/enterprises/${selectedEnterprise.enterprise_id}/policies`,
        {
          headers: {
            Authorization:
              accounts.c?.headers?.Authorization ||
              (await getAuthHeaders()).Authorization,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch policies");
      const data = await response.json();
      return (data.policies || []) as Policy[];
    },
    enabled: !!selectedEnterprise,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ["mdm-devices", selectedEnterprise?.enterprise_id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(
        `${mdmUrl}/enterprises/${selectedEnterprise.enterprise_id}/devices`,
        {
          headers: {
            Authorization:
              accounts.c?.headers?.Authorization ||
              (await getAuthHeaders()).Authorization,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch devices");
      const data = await response.json();
      return (data.devices || []) as Device[];
    },
    enabled: !!selectedEnterprise,
  });

  const createPolicyMutation = useMutation({
    mutationFn: async (data: typeof policyForm) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(
        `${mdmUrl}/enterprises/${selectedEnterprise.enterprise_id}/policies`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              accounts.c?.headers?.Authorization ||
              (await getAuthHeaders()).Authorization,
          },
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw new Error("Failed to create policy");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mdm-policies", selectedEnterprise?.enterprise_id],
      });
      setIsCreatePolicyModalOpen(false);
      setPolicyForm({
        policy_name: "",
        policy_display_name: "",
        password_required: true,
        password_minimum_length: 6,
        screen_capture_disabled: false,
        camera_disabled: false,
        kiosk_mode_enabled: false,
        kiosk_launcher_package: "",
      });
    },
  });

  const createEnrollmentTokenMutation = useMutation({
    mutationFn: async (policyName: string) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(
        `${mdmUrl}/enterprises/${selectedEnterprise.enterprise_id}/enrollment-tokens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              accounts.c?.headers?.Authorization ||
              (await getAuthHeaders()).Authorization,
          },
          body: JSON.stringify({
            policy_name: policyName,
            enrollment_type: "QR_CODE",
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to create enrollment token");
      const data = await response.json();
      return data.enrollment_token as EnrollmentToken;
    },
    onSuccess: (data) => {
      setEnrollmentToken(data);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { accounts } = await getAuthenticatedClients();
      const baseUrl = (accounts as unknown as { c: { baseUrl: string } }).c
        .baseUrl;
      const mdmUrl = baseUrl.replace("/accounts", API_BASE);
      const response = await fetch(
        `${mdmUrl}/enterprises/${selectedEnterprise.enterprise_id}/devices/${deviceId}?wipe_data=true`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              accounts.c?.headers?.Authorization ||
              (await getAuthHeaders()).Authorization,
          },
        },
      );
      if (!response.ok) throw new Error("Failed to delete device");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mdm-devices", selectedEnterprise?.enterprise_id],
      });
    },
  });

  async function getAuthHeaders() {
    const { accounts } = await getAuthenticatedClients();
    return {
      Authorization:
        (accounts as unknown as { c: { headers: { Authorization: string } } }).c
          ?.headers?.Authorization || "",
    };
  }

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
    { key: "enterprise_id", header: "ID" },
    { key: "display_name", header: "表示名" },
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
    { key: "policy_name", header: "ポリシー名" },
    { key: "policy_display_name", header: "表示名" },
    {
      key: "created_at",
      header: "作成日時",
      render: (item: Policy) => formatDate(item.created_at),
    },
  ];

  const deviceColumns = [
    { key: "device_id", header: "デバイスID" },
    { key: "policy_name", header: "ポリシー" },
    { key: "enrollment_state", header: "状態" },
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
              deleteDeviceMutation.mutate(item.device_id);
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
                  {selectedEnterprise.display_name ||
                    selectedEnterprise.enterprise_id}
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
                    keyExtractor={(item) => item.policy_id}
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
                          queryKey: [
                            "mdm-devices",
                            selectedEnterprise.enterprise_id,
                          ],
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
                    keyExtractor={(item) => item.device_id}
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
                    e.enterprise_id
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()) ||
                    (e.display_name || "")
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                )}
                keyExtractor={(item) => item.enterprise_id}
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
                value={policyForm.policy_name}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, policy_name: e.target.value })
                }
                className={inputClass}
                placeholder="例: pos-kiosk-policy"
              />
            </div>
            <div>
              <label htmlFor="policy_display_name" className={labelClass}>
                表示名
              </label>
              <input
                id="policy_display_name"
                type="text"
                value={policyForm.policy_display_name}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    policy_display_name: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="例: POSキオスクポリシー"
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
                id="password_required"
                type="checkbox"
                checked={policyForm.password_required}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    password_required: e.target.checked,
                  })
                }
              />
              <label htmlFor="password_required" className={labelClass}>
                パスワード必須
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
                id="screen_capture_disabled"
                type="checkbox"
                checked={policyForm.screen_capture_disabled}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    screen_capture_disabled: e.target.checked,
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
                checked={policyForm.camera_disabled}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    camera_disabled: e.target.checked,
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
                checked={policyForm.kiosk_mode_enabled}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    kiosk_mode_enabled: e.target.checked,
                  })
                }
              />
              <label htmlFor="kiosk_mode_enabled" className={labelClass}>
                キオスクモード有効
              </label>
            </div>
            {policyForm.kiosk_mode_enabled && (
              <div>
                <label htmlFor="kiosk_launcher_package" className={labelClass}>
                  キオスクアプリパッケージ名
                </label>
                <input
                  id="kiosk_launcher_package"
                  type="text"
                  value={policyForm.kiosk_launcher_package}
                  onChange={(e) =>
                    setPolicyForm({
                      ...policyForm,
                      kiosk_launcher_package: e.target.value,
                    })
                  }
                  className={inputClass}
                  placeholder="例: com.mizpos.pos"
                />
              </div>
            )}
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
                  <option key={p.policy_id} value={p.policy_name}>
                    {p.policy_display_name || p.policy_name}
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
