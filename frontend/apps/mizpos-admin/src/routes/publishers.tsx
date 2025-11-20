import {
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthenticatedClients, getAuthHeaders } from "../lib/api";
import {
  DEFAULT_STRIPE_ONLINE_FEE_RATE,
  DEFAULT_STRIPE_TERMINAL_FEE_RATE,
} from "../lib/constants";

export const Route = createFileRoute("/publishers")({
  component: PublishersPage,
});

const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

interface Publisher {
  publisher_id: string;
  name: string;
  description: string;
  contact_email: string;
  commission_rate: number;
  stripe_online_fee_rate: number;
  stripe_terminal_fee_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CreatePublisherForm {
  name: string;
  description: string;
  contact_email: string;
  commission_rate: number;
  stripe_online_fee_rate: number;
  stripe_terminal_fee_rate: number;
}

const initialFormState: CreatePublisherForm = {
  name: "",
  description: "",
  contact_email: "",
  commission_rate: 0,
  stripe_online_fee_rate: DEFAULT_STRIPE_ONLINE_FEE_RATE,
  stripe_terminal_fee_rate: DEFAULT_STRIPE_TERMINAL_FEE_RATE,
};

function PublishersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editPublisher, setEditPublisher] = useState<Publisher | null>(null);
  const [viewPublisherMembers, setViewPublisherMembers] =
    useState<Publisher | null>(null);
  const [formData, setFormData] =
    useState<CreatePublisherForm>(initialFormState);

  const { data: publishers = [], isLoading } = useQuery({
    queryKey: ["publishers"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/publishers`, {
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch publishers");
      const data = await response.json();
      return (data.publishers || []) as Publisher[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePublisherForm) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/publishers`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create publisher");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
      setIsCreateModalOpen(false);
      setFormData(initialFormState);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Publisher>;
    }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/stock/publishers/${id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(data),
        },
      );
      if (!response.ok) throw new Error("Failed to update publisher");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
      setEditPublisher(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/stock/publishers/${id}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) throw new Error("Failed to delete publisher");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publishers"] });
    },
  });

  const filteredPublishers = publishers.filter(
    (publisher) =>
      publisher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      publisher.contact_email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const columns = [
    { key: "name", header: "サークル/出版社名" },
    { key: "contact_email", header: "連絡先" },
    {
      key: "commission_rate",
      header: "委託手数料率",
      render: (item: Publisher) => `${item.commission_rate}%`,
    },
    {
      key: "stripe_online_fee_rate",
      header: "オンライン決済",
      render: (item: Publisher) => `${item.stripe_online_fee_rate}%`,
    },
    {
      key: "stripe_terminal_fee_rate",
      header: "端末決済",
      render: (item: Publisher) => `${item.stripe_terminal_fee_rate}%`,
    },
    {
      key: "is_active",
      header: "状態",
      render: (item: Publisher) => (
        <span
          className={css({
            display: "inline-flex",
            paddingX: "2",
            paddingY: "0.5",
            borderRadius: "full",
            fontSize: "xs",
            fontWeight: "medium",
            backgroundColor: item.is_active ? "green.100" : "gray.100",
            color: item.is_active ? "green.800" : "gray.800",
          })}
        >
          {item.is_active ? "有効" : "無効"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Publisher) => (
        <div className={css({ display: "flex", gap: "1" })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewPublisherMembers(item)}
            title="メンバー管理"
          >
            <IconUsers size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditPublisher(item)}
            title="編集"
          >
            <IconEdit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`「${item.name}」を削除しますか？`)) {
                deleteMutation.mutate(item.publisher_id);
              }
            }}
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
    createMutation.mutate(formData);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPublisher) {
      updateMutation.mutate({
        id: editPublisher.publisher_id,
        data: editPublisher,
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
    <>
      <Header title="サークル/出版社管理" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6",
          })}
        >
          <div className={css({ position: "relative", width: "320px" })}>
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
            サークル追加
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
            data={filteredPublishers}
            keyExtractor={(item) => item.publisher_id}
            emptyMessage="サークル/出版社が見つかりません"
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData(initialFormState);
        }}
        title="サークル/出版社追加"
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
              <label htmlFor="name" className={labelClass}>
                サークル/出版社名 *
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="contact_email" className={labelClass}>
                連絡先メールアドレス
              </label>
              <input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) =>
                  setFormData({ ...formData, contact_email: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="commission_rate" className={labelClass}>
                委託手数料率 (%)
              </label>
              <input
                id="commission_rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.commission_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    commission_rate: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="stripe_online_fee_rate" className={labelClass}>
                Stripeオンライン決済手数料率 (%)
              </label>
              <input
                id="stripe_online_fee_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.stripe_online_fee_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stripe_online_fee_rate: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="stripe_terminal_fee_rate" className={labelClass}>
                Stripe端末決済手数料率 (%)
              </label>
              <input
                id="stripe_terminal_fee_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.stripe_terminal_fee_rate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stripe_terminal_fee_rate: parseFloat(e.target.value) || 0,
                  })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                説明
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className={`${inputClass} ${css({ resize: "vertical" })}`}
              />
            </div>
          </div>

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
                setFormData(initialFormState);
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
        isOpen={!!editPublisher}
        onClose={() => setEditPublisher(null)}
        title="サークル/出版社編集"
      >
        {editPublisher && (
          <form onSubmit={handleUpdateSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label htmlFor="edit_name" className={labelClass}>
                  サークル/出版社名 *
                </label>
                <input
                  id="edit_name"
                  type="text"
                  required
                  value={editPublisher.name}
                  onChange={(e) =>
                    setEditPublisher({ ...editPublisher, name: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit_contact_email" className={labelClass}>
                  連絡先メールアドレス
                </label>
                <input
                  id="edit_contact_email"
                  type="email"
                  value={editPublisher.contact_email}
                  onChange={(e) =>
                    setEditPublisher({
                      ...editPublisher,
                      contact_email: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit_commission_rate" className={labelClass}>
                  委託手数料率 (%)
                </label>
                <input
                  id="edit_commission_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={editPublisher.commission_rate}
                  onChange={(e) =>
                    setEditPublisher({
                      ...editPublisher,
                      commission_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit_stripe_online_fee_rate"
                  className={labelClass}
                >
                  Stripeオンライン決済手数料率 (%)
                </label>
                <input
                  id="edit_stripe_online_fee_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editPublisher.stripe_online_fee_rate}
                  onChange={(e) =>
                    setEditPublisher({
                      ...editPublisher,
                      stripe_online_fee_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit_stripe_terminal_fee_rate"
                  className={labelClass}
                >
                  Stripe端末決済手数料率 (%)
                </label>
                <input
                  id="edit_stripe_terminal_fee_rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editPublisher.stripe_terminal_fee_rate}
                  onChange={(e) =>
                    setEditPublisher({
                      ...editPublisher,
                      stripe_terminal_fee_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit_description" className={labelClass}>
                  説明
                </label>
                <textarea
                  id="edit_description"
                  value={editPublisher.description}
                  onChange={(e) =>
                    setEditPublisher({
                      ...editPublisher,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className={`${inputClass} ${css({ resize: "vertical" })}`}
                />
              </div>

              <div>
                <label
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "2",
                  })}
                >
                  <input
                    type="checkbox"
                    checked={editPublisher.is_active}
                    onChange={(e) =>
                      setEditPublisher({
                        ...editPublisher,
                        is_active: e.target.checked,
                      })
                    }
                    className={css({ width: "4", height: "4" })}
                  />
                  <span className={css({ fontSize: "sm", color: "gray.700" })}>
                    有効
                  </span>
                </label>
              </div>
            </div>

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
                onClick={() => setEditPublisher(null)}
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

      {/* Members Management Modal */}
      <Modal
        isOpen={!!viewPublisherMembers}
        onClose={() => setViewPublisherMembers(null)}
        title={`メンバー管理 - ${viewPublisherMembers?.name || ""}`}
        size="lg"
      >
        {viewPublisherMembers && (
          <PublisherMembersView
            publisherId={viewPublisherMembers.publisher_id}
          />
        )}
      </Modal>
    </>
  );
}

// サークルのメンバー（ロール）を表示するコンポーネント
function PublisherMembersView({ publisherId }: { publisherId: string }) {
  interface Role {
    user_id: string;
    role_id: string;
    role_type: string;
    created_at: string;
  }

  interface User {
    user_id: string;
    email: string;
    display_name: string;
  }

  const ROLE_TYPE_LABELS: Record<string, string> = {
    publisher_admin: "管理者",
    publisher_sales: "販売担当",
  };

  // サークルのロール一覧を取得
  const { data: rolesData = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["publisher-roles", publisherId],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      const { data, error } = await accounts.GET(
        // biome-ignore lint/suspicious/noExplicitAny: API型定義に存在しないエンドポイントのため
        "/publishers/{publisher_id}/roles" as any,
        {
          params: { path: { publisher_id: publisherId } },
        },
      );
      if (error) throw error;
      return (data as unknown as { roles: Role[] }).roles || [];
    },
  });

  // ユーザー一覧を取得（メンバーの詳細情報取得用）
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      const { data, error } = await accounts.GET("/users");
      if (error) throw error;
      return (data as unknown as { users: User[] }).users || [];
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

  // ユーザーIDからユーザー情報を取得
  const getUserInfo = (userId: string) => {
    return users.find((u) => u.user_id === userId);
  };

  return (
    <div>
      <div
        className={css({
          marginBottom: "4",
          fontSize: "sm",
          color: "gray.600",
        })}
      >
        このサークルのメンバーとロールの一覧です。ロールの追加・削除は「ユーザー管理」画面から行ってください。
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
      ) : rolesData.length > 0 ? (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "2",
          })}
        >
          {rolesData.map((role) => {
            const user = getUserInfo(role.user_id);
            return (
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
                    {user?.display_name || "不明なユーザー"}
                  </div>
                  <div
                    className={css({
                      fontSize: "xs",
                      color: "gray.600",
                      marginTop: "1",
                    })}
                  >
                    {user?.email || role.user_id}
                  </div>
                  <div
                    className={css({
                      fontSize: "xs",
                      color: "gray.500",
                      marginTop: "1",
                    })}
                  >
                    ロール: {ROLE_TYPE_LABELS[role.role_type] || role.role_type}{" "}
                    | 付与日時: {formatDate(role.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
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
          メンバーが登録されていません
        </div>
      )}
    </div>
  );
}
