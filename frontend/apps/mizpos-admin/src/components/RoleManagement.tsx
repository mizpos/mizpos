import { IconPlus, IconShieldCheck, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { css } from "styled-system/css";
import { getAuthenticatedClients } from "../lib/api";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface Role {
  user_id: string;
  role_id: string;
  scope: "system" | "publisher" | "event";
  role_type: string;
  publisher_id?: string;
  event_id?: string;
  created_at: string;
  created_by?: string;
}

interface Publisher {
  publisher_id: string;
  name: string;
}

interface Event {
  event_id: string;
  name: string;
}

interface RoleManagementProps {
  userId: string;
}

const ROLE_TYPE_LABELS: Record<string, string> = {
  system_admin: "システム管理者",
  publisher_admin: "サークル管理者",
  publisher_sales: "販売担当",
  event_admin: "イベント管理者",
  event_sales: "イベント販売担当",
};

const ROLE_SCOPE_LABELS: Record<string, string> = {
  system: "システム全体",
  publisher: "サークル",
  event: "イベント",
};

export function RoleManagement({ userId }: RoleManagementProps) {
  const queryClient = useQueryClient();
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [roleFormData, setRoleFormData] = useState({
    role_type: "publisher_sales",
    scope: "publisher" as "system" | "publisher" | "event",
    publisher_id: "",
    event_id: "",
  });

  // ユーザーのロール一覧を取得
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      const { data, error } = await accounts.GET("/users/{user_id}/roles", {
        params: { path: { user_id: userId } },
      });
      if (error) throw error;
      return (data as unknown as { roles: Role[] }).roles || [];
    },
  });

  // サークル一覧を取得（ロール付与用）
  const { data: publishers = [] } = useQuery({
    queryKey: ["publishers"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/publishers");
      if (error) throw error;
      return (data as unknown as { publishers: Publisher[] }).publishers || [];
    },
    enabled: isAddRoleModalOpen && roleFormData.scope === "publisher",
  });

  // イベント一覧を取得（ロール付与用）
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/events");
      if (error) throw error;
      return (data as unknown as { events: Event[] }).events || [];
    },
    enabled: isAddRoleModalOpen && roleFormData.scope === "event",
  });

  // ロール付与ミューテーション
  const assignRoleMutation = useMutation({
    mutationFn: async (roleData: {
      role_type: string;
      publisher_id?: string;
      event_id?: string;
    }) => {
      const { accounts } = await getAuthenticatedClients();
      const { error } = await accounts.POST("/users/{user_id}/roles", {
        params: { path: { user_id: userId } },
        body: roleData,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
      setIsAddRoleModalOpen(false);
      setRoleFormData({
        role_type: "publisher_sales",
        scope: "publisher",
        publisher_id: "",
        event_id: "",
      });
    },
  });

  // ロール削除ミューテーション
  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { accounts } = await getAuthenticatedClients();
      const { error } = await accounts.DELETE(
        "/users/{user_id}/roles/{role_id}",
        {
          params: { path: { user_id: userId, role_id: roleId } },
        },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", userId] });
    },
  });

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const roleData: {
      role_type: string;
      publisher_id?: string;
      event_id?: string;
    } = {
      role_type: roleFormData.role_type,
    };

    if (roleFormData.scope === "publisher" && roleFormData.publisher_id) {
      roleData.publisher_id = roleFormData.publisher_id;
    } else if (roleFormData.scope === "event" && roleFormData.event_id) {
      roleData.event_id = roleFormData.event_id;
    }

    assignRoleMutation.mutate(roleData);
  };

  const handleRoleTypeChange = (roleType: string) => {
    let scope: "system" | "publisher" | "event" = "publisher";
    if (roleType === "system_admin") {
      scope = "system";
    } else if (roleType.startsWith("publisher_")) {
      scope = "publisher";
    } else if (roleType.startsWith("event_")) {
      scope = "event";
    }

    setRoleFormData({
      ...roleFormData,
      role_type: roleType,
      scope: scope,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    <div
      className={css({
        marginTop: "6",
        backgroundColor: "white",
        padding: "6",
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "gray.200",
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4",
        })}
      >
        <h3
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            display: "flex",
            alignItems: "center",
            gap: "2",
          })}
        >
          <IconShieldCheck size={20} />
          ロール管理
        </h3>
        <Button size="sm" onClick={() => setIsAddRoleModalOpen(true)}>
          <IconPlus size={16} />
          ロール追加
        </Button>
      </div>

      {rolesLoading ? (
        <div
          className={css({
            textAlign: "center",
            padding: "4",
            color: "gray.500",
          })}
        >
          読み込み中...
        </div>
      ) : rolesData && rolesData.length > 0 ? (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "2",
          })}
        >
          {rolesData.map((role) => (
            <div
              key={role.role_id}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3",
                backgroundColor: "gray.50",
                borderRadius: "md",
                border: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <div>
                <div
                  className={css({
                    fontWeight: "medium",
                    fontSize: "sm",
                  })}
                >
                  {ROLE_TYPE_LABELS[role.role_type] || role.role_type}
                </div>
                <div
                  className={css({
                    fontSize: "xs",
                    color: "gray.600",
                    marginTop: "1",
                  })}
                >
                  スコープ: {ROLE_SCOPE_LABELS[role.scope] || role.scope}
                  {role.publisher_id && ` (サークルID: ${role.publisher_id})`}
                  {role.event_id && ` (イベントID: ${role.event_id})`}
                </div>
                <div
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginTop: "1",
                  })}
                >
                  付与日時: {formatDate(role.created_at)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      `ロール「${
                        ROLE_TYPE_LABELS[role.role_type] || role.role_type
                      }」を削除しますか？`,
                    )
                  ) {
                    removeRoleMutation.mutate(role.role_id);
                  }
                }}
                disabled={removeRoleMutation.isPending}
              >
                <IconTrash size={16} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={css({
            textAlign: "center",
            padding: "4",
            color: "gray.500",
            fontSize: "sm",
          })}
        >
          ロールが設定されていません
        </div>
      )}

      {/* Add Role Modal */}
      <Modal
        isOpen={isAddRoleModalOpen}
        onClose={() => setIsAddRoleModalOpen(false)}
        title="ロール追加"
      >
        <form onSubmit={handleAddRole}>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "4",
            })}
          >
            <div>
              <label htmlFor="role-type" className={labelClass}>
                ロールタイプ *
              </label>
              <select
                id="role-type"
                value={roleFormData.role_type}
                onChange={(e) => handleRoleTypeChange(e.target.value)}
                className={inputClass}
                required
              >
                <option value="system_admin">システム管理者</option>
                <option value="publisher_admin">サークル管理者</option>
                <option value="publisher_sales">販売担当（サークル）</option>
                <option value="event_admin">イベント管理者</option>
                <option value="event_sales">イベント販売担当</option>
              </select>
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                {roleFormData.role_type === "system_admin" &&
                  "すべての操作が可能です"}
                {roleFormData.role_type === "publisher_admin" &&
                  "サークルの管理とメンバーのロール付与が可能です"}
                {roleFormData.role_type === "publisher_sales" &&
                  "サークルの商品販売が可能です"}
                {roleFormData.role_type === "event_admin" &&
                  "イベントの管理が可能です"}
                {roleFormData.role_type === "event_sales" &&
                  "イベントの販売業務が可能です"}
              </p>
            </div>

            {roleFormData.scope === "publisher" && (
              <div>
                <label htmlFor="publisher-id" className={labelClass}>
                  サークル *
                </label>
                <select
                  id="publisher-id"
                  value={roleFormData.publisher_id}
                  onChange={(e) =>
                    setRoleFormData({
                      ...roleFormData,
                      publisher_id: e.target.value,
                    })
                  }
                  className={inputClass}
                  required
                >
                  <option value="">サークルを選択してください</option>
                  {publishers.map((publisher) => (
                    <option
                      key={publisher.publisher_id}
                      value={publisher.publisher_id}
                    >
                      {publisher.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {roleFormData.scope === "event" && (
              <div>
                <label htmlFor="event-id" className={labelClass}>
                  イベント *
                </label>
                <select
                  id="event-id"
                  value={roleFormData.event_id}
                  onChange={(e) =>
                    setRoleFormData({
                      ...roleFormData,
                      event_id: e.target.value,
                    })
                  }
                  className={inputClass}
                  required
                >
                  <option value="">イベントを選択してください</option>
                  {events.map((event) => (
                    <option key={event.event_id} value={event.event_id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {assignRoleMutation.error && (
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
              {assignRoleMutation.error instanceof Error
                ? assignRoleMutation.error.message
                : "ロールの付与に失敗しました"}
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
              onClick={() => setIsAddRoleModalOpen(false)}
              type="button"
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={assignRoleMutation.isPending}>
              {assignRoleMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
