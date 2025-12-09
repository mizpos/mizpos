/**
 * POS従業員管理ページ
 * mizpos-desktop用の従業員（7桁番号＋PIN）を管理
 */

import {
  IconEdit,
  IconLink,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUserCheck,
  IconUserOff,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthHeaders } from "../lib/api";

export const Route = createFileRoute("/pos-employees")({
  component: PosEmployeesPage,
});

// API Base URL
const API_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

interface PosEmployee {
  employee_number: string;
  display_name: string;
  role: "manager" | "staff";
  event_id?: string;
  publisher_id?: string;
  user_id?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface MizposUser {
  user_id: string;
  email: string;
  display_name: string;
}

interface CreatePosEmployeeForm {
  employee_number: string;
  pin: string;
  display_name: string;
  role: "manager" | "staff";
  event_id?: string;
  publisher_id?: string;
  user_id?: string;
}

interface UpdatePosEmployeeForm {
  display_name?: string;
  pin?: string;
  role?: "manager" | "staff";
  event_id?: string;
  publisher_id?: string;
  active?: boolean;
  user_id?: string;
}

const initialCreateForm: CreatePosEmployeeForm = {
  employee_number: "",
  pin: "",
  display_name: "",
  role: "staff",
  event_id: "",
  publisher_id: "",
  user_id: "",
};

function PosEmployeesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<PosEmployee | null>(null);
  const [createFormData, setCreateFormData] =
    useState<CreatePosEmployeeForm>(initialCreateForm);
  const [editFormData, setEditFormData] = useState<UpdatePosEmployeeForm>({});

  // ユーザー一覧取得（紐付け用）
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/accounts/users`, {
        headers,
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return (data.users || []) as MizposUser[];
    },
  });

  // イベント一覧取得
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/stock/events`, {
        headers,
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return (data.events || []) as {
        event_id: string;
        name: string;
        is_active: boolean;
      }[];
    },
  });

  // サークル一覧取得
  const { data: publishers = [] } = useQuery({
    queryKey: ["publishers"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/stock/publishers`, {
        headers,
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      return (data.publishers || []) as {
        publisher_id: string;
        name: string;
        is_active: boolean;
      }[];
    },
  });

  // 従業員一覧取得
  const {
    data: employees = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["pos-employees"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/accounts/pos/employees`, {
        headers,
      });
      if (!response.ok) {
        throw new Error("従業員一覧の取得に失敗しました");
      }
      const data = await response.json();
      return data.employees || [];
    },
  });

  // 従業員作成
  const createMutation = useMutation({
    mutationFn: async (data: CreatePosEmployeeForm) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/accounts/pos/employees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          employee_number: data.employee_number,
          pin: data.pin,
          display_name: data.display_name,
          role: data.role,
          event_id: data.event_id || undefined,
          publisher_id: data.publisher_id || undefined,
          user_id: data.user_id || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "従業員の作成に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] });
      setIsCreateModalOpen(false);
      setCreateFormData(initialCreateForm);
    },
  });

  // 従業員更新
  const updateMutation = useMutation({
    mutationFn: async ({
      employeeNumber,
      data,
    }: {
      employeeNumber: string;
      data: UpdatePosEmployeeForm;
    }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/accounts/pos/employees/${employeeNumber}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "従業員の更新に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] });
      setEditEmployee(null);
    },
  });

  // 従業員削除
  const deleteMutation = useMutation({
    mutationFn: async (employeeNumber: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_BASE}/accounts/pos/employees/${employeeNumber}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "従業員の削除に失敗しました");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pos-employees"] });
    },
  });

  // 検索フィルタリング
  const filteredEmployees = employees.filter(
    (emp: PosEmployee) =>
      emp.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_number.includes(searchTerm),
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // user_idからユーザー情報を取得するヘルパー
  const getUserById = (userId: string | undefined) =>
    users.find((u) => u.user_id === userId);

  // イベントID/サークルIDから名前を取得するヘルパー
  const getEventName = (eventId: string | undefined) => {
    if (!eventId) return null;
    const event = events.find((e) => e.event_id === eventId);
    return event?.name || eventId;
  };

  const getPublisherName = (publisherId: string | undefined) => {
    if (!publisherId) return null;
    const publisher = publishers.find((p) => p.publisher_id === publisherId);
    return publisher?.name || publisherId;
  };

  const columns = [
    { key: "employee_number", header: "従業員番号" },
    { key: "display_name", header: "表示名" },
    {
      key: "role",
      header: "権限",
      render: (item: PosEmployee) => {
        const roleLabels: Record<string, { label: string; color: string }> = {
          manager: { label: "職長", color: "purple.600" },
          staff: { label: "スタッフ", color: "gray.600" },
        };
        const roleInfo = roleLabels[item.role] || roleLabels.staff;
        return (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "1",
              fontSize: "sm",
              color: roleInfo.color,
              fontWeight: item.role === "manager" ? "600" : "normal",
            })}
          >
            {roleInfo.label}
          </span>
        );
      },
    },
    {
      key: "event_id",
      header: "イベント",
      render: (item: PosEmployee) => {
        const eventName = getEventName(item.event_id);
        return eventName ? (
          <span className={css({ fontSize: "sm" })}>{eventName}</span>
        ) : (
          <span className={css({ color: "gray.400", fontSize: "sm" })}>-</span>
        );
      },
    },
    {
      key: "publisher_id",
      header: "サークル",
      render: (item: PosEmployee) => {
        const publisherName = getPublisherName(item.publisher_id);
        return publisherName ? (
          <span className={css({ fontSize: "sm" })}>{publisherName}</span>
        ) : (
          <span className={css({ color: "gray.400", fontSize: "sm" })}>-</span>
        );
      },
    },
    {
      key: "user_id",
      header: "紐付けアカウント",
      render: (item: PosEmployee) => {
        const linkedUser = getUserById(item.user_id);
        return linkedUser ? (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "1",
              color: "blue.600",
              fontSize: "sm",
            })}
          >
            <IconLink size={14} />
            {linkedUser.display_name}
          </span>
        ) : (
          <span
            className={css({
              color: "gray.400",
              fontSize: "sm",
            })}
          >
            -
          </span>
        );
      },
    },
    {
      key: "active",
      header: "状態",
      render: (item: PosEmployee) =>
        item.active ? (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "1",
              color: "green.600",
              fontSize: "sm",
            })}
          >
            <IconUserCheck size={16} />
            有効
          </span>
        ) : (
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "1",
              color: "gray.500",
              fontSize: "sm",
            })}
          >
            <IconUserOff size={16} />
            無効
          </span>
        ),
    },
    {
      key: "created_at",
      header: "作成日時",
      render: (item: PosEmployee) => formatDate(item.created_at),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: PosEmployee) => (
        <div className={css({ display: "flex", gap: "1" })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditEmployee(item);
              setEditFormData({
                display_name: item.display_name,
                role: item.role,
                event_id: item.event_id,
                publisher_id: item.publisher_id,
                user_id: item.user_id,
                active: item.active,
              });
            }}
            title="編集"
          >
            <IconEdit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  `従業員「${item.display_name}」（${item.employee_number}）を削除しますか？`,
                )
              ) {
                deleteMutation.mutate(item.employee_number);
              }
            }}
            disabled={deleteMutation.isPending}
            title="削除"
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createFormData);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editEmployee) {
      updateMutation.mutate({
        employeeNumber: editEmployee.employee_number,
        data: editFormData,
      });
    }
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
    <div title="POS従業員管理">
      {/* Info Box */}
      <div
        className={css({
          backgroundColor: "blue.50",
          border: "1px solid",
          borderColor: "blue.200",
          borderRadius: "md",
          padding: "4",
          marginBottom: "6",
        })}
      >
        <p className={css({ fontSize: "sm", color: "blue.800" })}>
          POS端末（mizpos-desktop）でログインする従業員を管理します。
          従業員番号（7桁）とPIN（3桁以上の数字）でログインできます。
        </p>
      </div>

      {error && (
        <div
          className={css({
            backgroundColor: "red.50",
            border: "1px solid",
            borderColor: "red.200",
            color: "red.700",
            padding: "3",
            borderRadius: "md",
            marginBottom: "4",
            fontSize: "sm",
          })}
        >
          従業員情報の取得に失敗しました:{" "}
          {error instanceof Error ? error.message : "不明なエラー"}
        </div>
      )}

      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "6",
        })}
      >
        <div
          className={css({
            position: "relative",
            width: "320px",
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
            placeholder="名前・従業員番号で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={css({
              width: "100%",
              paddingLeft: "10",
              paddingRight: "4",
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

        <Button onClick={() => setIsCreateModalOpen(true)}>
          <IconPlus size={18} />
          従業員追加
        </Button>
      </div>

      {isLoading ? (
        <div
          className={css({
            textAlign: "center",
            padding: "8",
            color: "gray.500",
          })}
        >
          読み込み中...
        </div>
      ) : (
        <Table
          columns={columns}
          data={filteredEmployees}
          keyExtractor={(item) => item.employee_number}
          emptyMessage="POS従業員が登録されていません"
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateFormData(initialCreateForm);
        }}
        title="POS従業員追加"
      >
        <form onSubmit={handleCreateSubmit}>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "4",
            })}
          >
            <div>
              <label htmlFor="create-employee-number" className={labelClass}>
                従業員番号 *
              </label>
              <input
                id="create-employee-number"
                type="text"
                required
                pattern="[0-9]{7}"
                maxLength={7}
                value={createFormData.employee_number}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    employee_number: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 7),
                  })
                }
                className={inputClass}
                placeholder="1234567（7桁の数字）"
              />
            </div>
            <div>
              <label htmlFor="create-pin" className={labelClass}>
                PIN *
              </label>
              <input
                id="create-pin"
                type="password"
                required
                minLength={3}
                maxLength={8}
                pattern="[0-9]{3,8}"
                value={createFormData.pin}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    pin: e.target.value.replace(/\D/g, "").slice(0, 8),
                  })
                }
                className={inputClass}
                placeholder="3〜8桁の数字"
              />
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                POS端末でのログインに使用するPINコード
              </p>
            </div>
            <div>
              <label htmlFor="create-name" className={labelClass}>
                表示名 *
              </label>
              <input
                id="create-name"
                type="text"
                required
                value={createFormData.display_name}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    display_name: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="田中 太郎"
              />
            </div>
            <div>
              <label htmlFor="create-role" className={labelClass}>
                権限 *
              </label>
              <select
                id="create-role"
                value={createFormData.role}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    role: e.target.value as "manager" | "staff",
                  })
                }
                className={inputClass}
              >
                <option value="staff">スタッフ（販売のみ）</option>
                <option value="manager">職長（返金・開局・閉局可能）</option>
              </select>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                職長は返金処理、開局・閉局処理が可能です
              </p>
            </div>
            <div>
              <label htmlFor="create-event-id" className={labelClass}>
                イベント（オプション）
              </label>
              <select
                id="create-event-id"
                value={createFormData.event_id || ""}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    event_id: e.target.value || undefined,
                  })
                }
                className={inputClass}
              >
                <option value="">指定なし</option>
                {events
                  .filter((e) => e.is_active)
                  .map((event) => (
                    <option key={event.event_id} value={event.event_id}>
                      {event.name}
                    </option>
                  ))}
              </select>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                POS端末でこのイベントの販売を担当する場合に指定
              </p>
            </div>
            <div>
              <label htmlFor="create-publisher-id" className={labelClass}>
                サークル（オプション）
              </label>
              <select
                id="create-publisher-id"
                value={createFormData.publisher_id || ""}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    publisher_id: e.target.value || undefined,
                  })
                }
                className={inputClass}
              >
                <option value="">指定なし</option>
                {publishers
                  .filter((p) => p.is_active)
                  .map((publisher) => (
                    <option
                      key={publisher.publisher_id}
                      value={publisher.publisher_id}
                    >
                      {publisher.name}
                    </option>
                  ))}
              </select>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                POS端末でこのサークルの販売を担当する場合に指定
              </p>
            </div>
            <div>
              <label htmlFor="create-user-id" className={labelClass}>
                mizposアカウント紐付け（オプション）
              </label>
              <select
                id="create-user-id"
                value={createFormData.user_id || ""}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    user_id: e.target.value || undefined,
                  })
                }
                className={inputClass}
              >
                <option value="">紐付けなし</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.display_name} ({user.email})
                  </option>
                ))}
              </select>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                mizposの登録ユーザーと紐付けることができます
              </p>
            </div>
          </div>

          {createMutation.error && (
            <div
              className={css({
                backgroundColor: "red.50",
                border: "1px solid",
                borderColor: "red.200",
                color: "red.700",
                padding: "3",
                borderRadius: "md",
                marginTop: "4",
                fontSize: "sm",
              })}
            >
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : "作成に失敗しました"}
            </div>
          )}

          <div
            className={css({
              display: "flex",
              justifyContent: "flex-end",
              gap: "2",
              marginTop: "4",
            })}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setCreateFormData(initialCreateForm);
              }}
              type="button"
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "作成中..." : "作成"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editEmployee}
        onClose={() => setEditEmployee(null)}
        title="POS従業員編集"
      >
        {editEmployee && (
          <form onSubmit={handleUpdateSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label htmlFor="edit-employee-number" className={labelClass}>
                  従業員番号
                </label>
                <input
                  id="edit-employee-number"
                  type="text"
                  value={editEmployee.employee_number}
                  disabled
                  className={`${inputClass} ${css({
                    backgroundColor: "gray.100",
                    cursor: "not-allowed",
                  })}`}
                />
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  従業員番号は変更できません
                </p>
              </div>
              <div>
                <label htmlFor="edit-name" className={labelClass}>
                  表示名 *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editFormData.display_name || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      display_name: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit-pin" className={labelClass}>
                  新しいPIN（変更する場合のみ）
                </label>
                <input
                  id="edit-pin"
                  type="password"
                  minLength={3}
                  maxLength={8}
                  pattern="[0-9]{3,8}"
                  value={editFormData.pin || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      pin: e.target.value.replace(/\D/g, "").slice(0, 8),
                    })
                  }
                  className={inputClass}
                  placeholder="空欄の場合は変更しません"
                />
              </div>
              <div>
                <label className={labelClass}>
                  <input
                    type="checkbox"
                    checked={editFormData.active}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        active: e.target.checked,
                      })
                    }
                    className={css({ marginRight: "2" })}
                  />
                  有効
                </label>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  無効にすると、この従業員はPOS端末にログインできなくなります
                </p>
              </div>
              <div>
                <label htmlFor="edit-role" className={labelClass}>
                  権限
                </label>
                <select
                  id="edit-role"
                  value={editFormData.role || "staff"}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      role: e.target.value as "manager" | "staff",
                    })
                  }
                  className={inputClass}
                >
                  <option value="staff">スタッフ（販売のみ）</option>
                  <option value="manager">職長（返金・開局・閉局可能）</option>
                </select>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  職長は返金処理、開局・閉局処理が可能です
                </p>
              </div>
              <div>
                <label htmlFor="edit-event-id" className={labelClass}>
                  イベント
                </label>
                <select
                  id="edit-event-id"
                  value={editFormData.event_id || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      event_id: e.target.value || undefined,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">指定なし</option>
                  {events
                    .filter((ev) => ev.is_active)
                    .map((event) => (
                      <option key={event.event_id} value={event.event_id}>
                        {event.name}
                      </option>
                    ))}
                </select>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  POS端末でこのイベントの販売を担当する場合に指定
                </p>
              </div>
              <div>
                <label htmlFor="edit-publisher-id" className={labelClass}>
                  サークル
                </label>
                <select
                  id="edit-publisher-id"
                  value={editFormData.publisher_id || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      publisher_id: e.target.value || undefined,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">指定なし</option>
                  {publishers
                    .filter((p) => p.is_active)
                    .map((publisher) => (
                      <option
                        key={publisher.publisher_id}
                        value={publisher.publisher_id}
                      >
                        {publisher.name}
                      </option>
                    ))}
                </select>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  POS端末でこのサークルの販売を担当する場合に指定
                </p>
              </div>
              <div>
                <label htmlFor="edit-user-id" className={labelClass}>
                  mizposアカウント紐付け
                </label>
                <select
                  id="edit-user-id"
                  value={editFormData.user_id || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      user_id: e.target.value || undefined,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">紐付けなし</option>
                  {users.map((user) => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.display_name} ({user.email})
                    </option>
                  ))}
                </select>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  mizposの登録ユーザーと紐付けることができます
                </p>
              </div>
            </div>

            {updateMutation.error && (
              <div
                className={css({
                  backgroundColor: "red.50",
                  border: "1px solid",
                  borderColor: "red.200",
                  color: "red.700",
                  padding: "3",
                  borderRadius: "md",
                  marginTop: "4",
                  fontSize: "sm",
                })}
              >
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "更新に失敗しました"}
              </div>
            )}

            <div
              className={css({
                display: "flex",
                justifyContent: "flex-end",
                gap: "2",
                marginTop: "4",
              })}
            >
              <Button
                variant="secondary"
                onClick={() => setEditEmployee(null)}
                type="button"
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
