import type { AccountsComponents } from "@mizpos/api";
import {
  IconEdit,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { RoleManagement } from "../components/RoleManagement";
import { Table } from "../components/Table";
import { PageContainer } from "../components/ui";
import { getAuthenticatedClients } from "../lib/api";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

interface User {
  user_id: string;
  cognito_user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

type CreateUserRequest = AccountsComponents["schemas"]["CreateUserRequest"];
type UpdateUserRequest = AccountsComponents["schemas"]["UpdateUserRequest"];

interface CreateUserForm {
  email: string;
  display_name: string;
  password: string;
}

const initialCreateForm: CreateUserForm = {
  email: "",
  display_name: "",
  password: "",
};

function UsersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [viewUserRoles, setViewUserRoles] = useState<User | null>(null);
  const [createFormData, setCreateFormData] =
    useState<CreateUserForm>(initialCreateForm);
  const [editFormData, setEditFormData] = useState<UpdateUserRequest>({
    display_name: "",
  });

  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      const { data, error } = await accounts.GET("/users");
      if (error) throw error;
      const response = data as unknown as { users: User[] };
      return response.users || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserRequest) => {
      const { accounts } = await getAuthenticatedClients();
      const { error } = await accounts.POST("/users", { body: data });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsCreateModalOpen(false);
      setCreateFormData(initialCreateForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string;
      data: UpdateUserRequest;
    }) => {
      const { accounts } = await getAuthenticatedClients();
      const { error } = await accounts.PUT("/users/{user_id}", {
        params: { path: { user_id: userId } },
        body: data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { accounts } = await getAuthenticatedClients();
      const { error } = await accounts.DELETE("/users/{user_id}", {
        params: { path: { user_id: userId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const filteredUsers = users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()),
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

  const columns = [
    { key: "display_name", header: "表示名" },
    { key: "email", header: "メールアドレス" },
    {
      key: "created_at",
      header: "作成日時",
      render: (item: User) => formatDate(item.created_at),
    },
    {
      key: "updated_at",
      header: "更新日時",
      render: (item: User) => formatDate(item.updated_at),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: User) => (
        <div className={css({ display: "flex", gap: "1" })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewUserRoles(item)}
            title="ロール管理"
          >
            <IconShieldCheck size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditUser(item);
              setEditFormData({ display_name: item.display_name });
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
                  `「${item.display_name}」を削除しますか？\nCognitoからも削除されます。`,
                )
              ) {
                deleteMutation.mutate(item.user_id);
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
    createMutation.mutate({
      email: createFormData.email,
      display_name: createFormData.display_name,
      password: createFormData.password,
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editUser) {
      updateMutation.mutate({
        userId: editUser.user_id,
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
    <PageContainer title="ユーザー管理">
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
            ユーザー認証はAWS
            Cognitoで管理されています。ユーザーを作成すると、Cognitoにもアカウントが作成されます。
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
            ユーザー情報の取得に失敗しました:{" "}
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
              placeholder="名前・メールで検索..."
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
            ユーザー追加
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
            data={filteredUsers}
            keyExtractor={(item) => item.user_id}
            emptyMessage="ユーザーが見つかりません"
          />
        )}

        {/* Password Policy Info */}
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
          <h3
            className={css({
              fontSize: "lg",
              fontWeight: "semibold",
              marginBottom: "4",
            })}
          >
            パスワードポリシー
          </h3>
          <ul
            className={css({
              listStyle: "disc",
              paddingLeft: "6",
              fontSize: "sm",
              color: "gray.600",
              display: "flex",
              flexDirection: "column",
              gap: "1",
            })}
          >
            <li>最小8文字</li>
            <li>大文字を含む</li>
            <li>小文字を含む</li>
            <li>数字を含む</li>
            <li>特殊文字を含む</li>
          </ul>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateFormData(initialCreateForm);
        }}
        title="ユーザー追加"
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
              <label htmlFor="create-email" className={labelClass}>
                メールアドレス *
              </label>
              <input
                id="create-email"
                type="email"
                required
                value={createFormData.email}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    email: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="user@example.com"
              />
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
              <label htmlFor="create-password" className={labelClass}>
                パスワード *
              </label>
              <input
                id="create-password"
                type="password"
                required
                minLength={8}
                value={createFormData.password}
                onChange={(e) =>
                  setCreateFormData({
                    ...createFormData,
                    password: e.target.value,
                  })
                }
                className={inputClass}
                placeholder="8文字以上（大文字・小文字・数字・特殊文字を含む）"
              />
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginTop: "1",
                })}
              >
                Cognitoのパスワードポリシーに準拠する必要があります
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
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title="ユーザー編集"
      >
        {editUser && (
          <form onSubmit={handleUpdateSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label htmlFor="edit-email" className={labelClass}>
                  メールアドレス
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editUser.email}
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
                  メールアドレスは変更できません
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
                  value={editFormData.display_name}
                  onChange={(e) =>
                    setEditFormData({ display_name: e.target.value })
                  }
                  className={inputClass}
                />
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
                onClick={() => setEditUser(null)}
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

      {/* Role Management Modal */}
      <Modal
        isOpen={!!viewUserRoles}
        onClose={() => setViewUserRoles(null)}
        title={`ロール管理 - ${viewUserRoles?.display_name || ""}`}
        size="lg"
      >
        {viewUserRoles && (
          <div>
            <div
              className={css({
                marginBottom: "4",
                paddingBottom: "4",
                borderBottom: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <div
                className={css({
                  display: "grid",
                  gridTemplateColumns: "100px 1fr",
                  gap: "2",
                  fontSize: "sm",
                })}
              >
                <span className={css({ fontWeight: "medium" })}>表示名:</span>
                <span>{viewUserRoles.display_name}</span>
                <span className={css({ fontWeight: "medium" })}>メール:</span>
                <span>{viewUserRoles.email}</span>
                <span className={css({ fontWeight: "medium" })}>
                  ユーザーID:
                </span>
                <span className={css({ fontFamily: "mono", fontSize: "xs" })}>
                  {viewUserRoles.user_id}
                </span>
              </div>
            </div>

            <RoleManagement userId={viewUserRoles.user_id} />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
