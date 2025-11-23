import {
  IconDeviceMobile,
  IconExternalLink,
  IconPlus,
  IconQrcode,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthenticatedClients } from "../lib/api";

// URLパラメータの型定義
interface AndroidEnterpriseSearch {
  enterpriseToken?: string;
  signupUrlName?: string;
}

export const Route = createFileRoute("/android-enterprise")({
  component: AndroidEnterprisePage,
  validateSearch: (
    search: Record<string, unknown>,
  ): AndroidEnterpriseSearch => {
    return {
      enterpriseToken: search.enterpriseToken as string | undefined,
      signupUrlName: search.signupUrlName as string | undefined,
    };
  },
});

// API レスポンスの型定義（OpenAPI スキーマに定義がないため、ローカルで定義）
interface Enterprise {
  id: string;
  enterprise_display_name?: string;
  created_at: string;
  updated_at?: string;
}

interface Policy {
  id: string;
  name: string;
  enterprise_id: string;
  created_at: string;
  updated_at?: string;
}

interface Device {
  id: string;
  enterprise_id: string;
  applied_policy_name?: string;
  state?: string;
  last_status_report_time?: string;
  created_at?: string;
}

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
  const searchParams = useSearch({ from: "/android-enterprise" });

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

  // サインアップフロー用の状態
  const [signupStep, setSignupStep] = useState<
    "initial" | "waiting" | "complete" | "error"
  >("initial");
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [signupUrlName, setSignupUrlName] = useState<string | null>(null);
  const [signupError, setSignupError] = useState<string | null>(null);

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
    queryKey: ["android-mgmt-enterprises"],
    queryFn: async (): Promise<Enterprise[]> => {
      const { androidMgmt } = await getAuthenticatedClients();
      const { data, error } = await androidMgmt.GET("/enterprises");
      if (error) throw new Error("Failed to fetch enterprises");
      return (data as { enterprises?: Enterprise[] })?.enterprises || [];
    },
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["android-mgmt-policies", selectedEnterprise?.id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { androidMgmt } = await getAuthenticatedClients();
      const { data, error } = await androidMgmt.GET(
        "/enterprises/{enterprise_id}/policies",
        {
          params: { path: { enterprise_id: selectedEnterprise.id } },
        },
      );
      if (error) throw new Error("Failed to fetch policies");
      return (data as { policies?: Policy[] })?.policies || [];
    },
    enabled: !!selectedEnterprise,
  });

  const { data: devices = [], isLoading: devicesLoading } = useQuery({
    queryKey: ["android-mgmt-devices", selectedEnterprise?.id],
    queryFn: async () => {
      if (!selectedEnterprise) return [];
      const { androidMgmt } = await getAuthenticatedClients();
      const { data, error } = await androidMgmt.GET(
        "/enterprises/{enterprise_id}/devices",
        {
          params: { path: { enterprise_id: selectedEnterprise.id } },
        },
      );
      if (error) throw new Error("Failed to fetch devices");
      return (data as { devices?: Device[] })?.devices || [];
    },
    enabled: !!selectedEnterprise,
  });

  // サインアップURL生成
  const createSignupUrlMutation = useMutation({
    mutationFn: async () => {
      const { androidMgmt } = await getAuthenticatedClients();
      // コールバックURLは現在のページのURL
      const callbackUrl = `${window.location.origin}/android-enterprise`;
      const { data, error } = await androidMgmt.POST("/signup-urls", {
        body: { callback_url: callbackUrl },
      });
      if (error) throw new Error("Failed to create signup URL");
      return data as { signup_url: { name: string; url: string } };
    },
    onSuccess: (data) => {
      setSignupUrlName(data.signup_url.name);
      setSignupUrl(data.signup_url.url);
      setSignupStep("waiting");
      // コールバック時に使用するためlocalStorageに保存
      localStorage.setItem(
        "android_enterprise_signup_url_name",
        data.signup_url.name,
      );
    },
    onError: (error) => {
      setSignupError(error.message);
      setSignupStep("error");
    },
  });

  // エンタープライズ作成（コールバック後）
  const createEnterpriseMutation = useMutation({
    mutationFn: async ({
      enterpriseToken,
      signupUrlName: urlName,
    }: {
      enterpriseToken: string;
      signupUrlName: string;
    }) => {
      const { androidMgmt } = await getAuthenticatedClients();
      const { data, error } = await androidMgmt.POST("/enterprises", {
        body: {
          enterprise_token: enterpriseToken,
          signup_url_name: urlName,
        },
      });
      if (error) throw new Error("Failed to create enterprise");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["android-mgmt-enterprises"] });
      setSignupStep("complete");
      // URLパラメータをクリア
      window.history.replaceState({}, "", "/android-enterprise");
    },
    onError: (error) => {
      setSignupError(error.message);
      setSignupStep("error");
    },
  });

  // URLパラメータからコールバックを処理
  useEffect(() => {
    if (searchParams.enterpriseToken) {
      // signupUrlNameはURLパラメータまたはlocalStorageから取得
      const urlName =
        searchParams.signupUrlName ||
        localStorage.getItem("android_enterprise_signup_url_name");
      if (urlName) {
        setIsCreateEnterpriseModalOpen(true);
        setSignupStep("waiting");
        createEnterpriseMutation.mutate({
          enterpriseToken: searchParams.enterpriseToken,
          signupUrlName: urlName,
        });
        // 使用後はlocalStorageから削除
        localStorage.removeItem("android_enterprise_signup_url_name");
      } else {
        // signupUrlNameが見つからない場合はエラー表示
        setIsCreateEnterpriseModalOpen(true);
        setSignupError(
          "サインアップURL名が見つかりません。もう一度サインアップURLを生成してください。",
        );
        setSignupStep("error");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchParams.enterpriseToken,
    createEnterpriseMutation.mutate,
    searchParams.signupUrlName,
  ]);

  const createPolicyMutation = useMutation({
    mutationFn: async (formData: typeof policyForm) => {
      if (!selectedEnterprise) throw new Error("No enterprise selected");
      const { androidMgmt } = await getAuthenticatedClients();
      const { data, error } = await androidMgmt.POST(
        "/enterprises/{enterprise_id}/policies",
        {
          params: { path: { enterprise_id: selectedEnterprise.id } },
          body: {
            policy_name: formData.name,
            applications_enabled: true,
            play_store_mode: "WHITELIST",
            password_required: true,
            password_minimum_length: 6,
            screen_capture_disabled: formData.policy_data
              .screenCaptureDisabled as boolean,
            camera_disabled: formData.policy_data.cameraDisabled as boolean,
            wifi_config_disabled: false,
            kiosk_mode_enabled: formData.policy_data
              .kioskCustomLauncherEnabled as boolean,
          },
        },
      );
      if (error) throw new Error("Failed to create policy");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["android-mgmt-policies", selectedEnterprise?.id],
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
      const { androidMgmt } = await getAuthenticatedClients();
      const { error } = await androidMgmt.DELETE(
        "/enterprises/{enterprise_id}/devices/{device_id}",
        {
          params: {
            path: {
              enterprise_id: selectedEnterprise.id,
              device_id: deviceId,
            },
            query: { wipe_data: true },
          },
        },
      );
      if (error) throw new Error("Failed to delete device");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["android-mgmt-devices", selectedEnterprise?.id],
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
                          queryKey: [
                            "android-mgmt-devices",
                            selectedEnterprise.id,
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
        onClose={() => {
          setIsCreateEnterpriseModalOpen(false);
          setSignupStep("initial");
          setSignupUrl(null);
          setSignupUrlName(null);
          setSignupError(null);
        }}
        title="エンタープライズ登録"
        size="lg"
      >
        <div className={css({ padding: "4" })}>
          {signupStep === "initial" && (
            <>
              <p className={css({ marginBottom: "4", color: "gray.600" })}>
                Android Enterpriseのエンタープライズを登録します。
                「サインアップURLを生成」ボタンをクリックしてGoogleの登録ページに進んでください。
              </p>
              <ol
                className={css({
                  paddingLeft: "6",
                  marginBottom: "4",
                  color: "gray.700",
                  listStyleType: "decimal",
                })}
              >
                <li className={css({ marginBottom: "2" })}>
                  サインアップURLを生成
                </li>
                <li className={css({ marginBottom: "2" })}>
                  Googleの画面でエンタープライズを登録
                </li>
                <li className={css({ marginBottom: "2" })}>
                  自動的にこの画面に戻り、登録が完了します
                </li>
              </ol>
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
                  onClick={() => setIsCreateEnterpriseModalOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  onClick={() => createSignupUrlMutation.mutate()}
                  disabled={createSignupUrlMutation.isPending}
                >
                  {createSignupUrlMutation.isPending
                    ? "生成中..."
                    : "サインアップURLを生成"}
                </Button>
              </div>
            </>
          )}

          {signupStep === "waiting" && signupUrl && (
            <>
              <p className={css({ marginBottom: "4", color: "gray.600" })}>
                以下のURLをクリックしてGoogleの登録ページに進んでください。
                登録完了後、自動的にこの画面に戻ります。
              </p>
              <div
                className={css({
                  backgroundColor: "gray.100",
                  padding: "4",
                  borderRadius: "md",
                  marginBottom: "4",
                })}
              >
                <a
                  href={signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={css({
                    color: "primary.600",
                    textDecoration: "underline",
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                    wordBreak: "break-all",
                  })}
                >
                  <IconExternalLink size={16} />
                  Googleエンタープライズ登録ページを開く
                </a>
              </div>
              <p className={css({ color: "gray.500", fontSize: "sm" })}>
                SignupURL Name: {signupUrlName}
              </p>
            </>
          )}

          {signupStep === "waiting" && !signupUrl && (
            <div className={css({ textAlign: "center", padding: "8" })}>
              <div
                className={css({
                  width: "8",
                  height: "8",
                  border: "2px solid",
                  borderColor: "gray.300",
                  borderTopColor: "primary.500",
                  borderRadius: "full",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 4",
                })}
              />
              <p className={css({ color: "gray.600" })}>
                エンタープライズを作成中...
              </p>
            </div>
          )}

          {signupStep === "complete" && (
            <>
              <div
                className={css({
                  textAlign: "center",
                  padding: "4",
                  backgroundColor: "green.50",
                  borderRadius: "md",
                  marginBottom: "4",
                })}
              >
                <p
                  className={css({
                    color: "green.700",
                    fontWeight: "bold",
                    fontSize: "lg",
                  })}
                >
                  エンタープライズの登録が完了しました！
                </p>
              </div>
              <div
                className={css({ display: "flex", justifyContent: "center" })}
              >
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsCreateEnterpriseModalOpen(false);
                    setSignupStep("initial");
                  }}
                >
                  閉じる
                </Button>
              </div>
            </>
          )}

          {signupStep === "error" && (
            <>
              <div
                className={css({
                  textAlign: "center",
                  padding: "4",
                  backgroundColor: "red.50",
                  borderRadius: "md",
                  marginBottom: "4",
                })}
              >
                <p className={css({ color: "red.700", fontWeight: "bold" })}>
                  エラーが発生しました
                </p>
                <p className={css({ color: "red.600", fontSize: "sm" })}>
                  {signupError}
                </p>
              </div>
              <div
                className={css({
                  display: "flex",
                  justifyContent: "center",
                  gap: "2",
                })}
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsCreateEnterpriseModalOpen(false);
                    setSignupStep("initial");
                    setSignupError(null);
                  }}
                >
                  閉じる
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSignupStep("initial");
                    setSignupError(null);
                  }}
                >
                  やり直す
                </Button>
              </div>
            </>
          )}
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
