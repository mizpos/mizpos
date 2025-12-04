import {
  IconBook,
  IconEdit,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { PageContainer } from "../components/ui";
import { getAuthHeaders } from "../lib/api";

export const Route = createFileRoute("/events")({
  component: EventsPage,
});

const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

interface Event {
  event_id: string;
  name: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  location: string;
  publisher_id: string | null;
  product_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Product {
  product_id: string;
  name: string;
  price: number;
  category: string;
  is_active: boolean;
}

interface Publisher {
  publisher_id: string;
  name: string;
}

interface CreateEventForm {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  publisher_id: string;
}

const initialFormState: CreateEventForm = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  location: "",
  publisher_id: "",
};

function EventsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState<CreateEventForm>(initialFormState);
  const [productLinkEvent, setProductLinkEvent] = useState<Event | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // イベント一覧を取得
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/events`, {
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      return (data.events || []) as Event[];
    },
  });

  // サークル一覧を取得（イベント作成用）
  const { data: publishers = [] } = useQuery({
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

  // 商品一覧を取得（紐づけ用）
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/products`, {
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      return (data.products || []) as Product[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateEventForm) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/stock/events`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...data,
          publisher_id: data.publisher_id || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setIsCreateModalOpen(false);
      setFormData(initialFormState);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: Partial<CreateEventForm>;
    }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/stock/events/${eventId}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            ...data,
            publisher_id: data.publisher_id || null,
          }),
        },
      );
      if (!response.ok) throw new Error("Failed to update event");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setEditEvent(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/stock/events/${eventId}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) throw new Error("Failed to delete event");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // 商品紐づけを更新
  const updateProductsMutation = useMutation({
    mutationFn: async ({
      eventId,
      productIds,
    }: {
      eventId: string;
      productIds: string[];
    }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/stock/events/${eventId}/products`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ product_ids: productIds }),
        },
      );
      if (!response.ok) throw new Error("Failed to update event products");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setProductLinkEvent(null);
    },
  });

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("ja-JP");
  };

  const getPublisherName = (publisherId: string | null) => {
    if (!publisherId) return "グローバル";
    const publisher = publishers.find((p) => p.publisher_id === publisherId);
    return publisher?.name || publisherId;
  };

  const columns = [
    { key: "name", header: "イベント名" },
    {
      key: "start_date",
      header: "開催日",
      render: (item: Event) => {
        if (item.start_date && item.end_date) {
          return `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`;
        }
        if (item.start_date) {
          return formatDate(item.start_date);
        }
        return "-";
      },
    },
    { key: "location", header: "開催場所" },
    {
      key: "publisher_id",
      header: "サークル",
      render: (item: Event) => getPublisherName(item.publisher_id),
    },
    {
      key: "product_count",
      header: "商品数",
      render: (item: Event) => (
        <span
          className={css({
            padding: "1 2",
            backgroundColor: "gray.100",
            borderRadius: "md",
            fontSize: "sm",
          })}
        >
          {item.product_ids?.length || 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Event) => (
        <div className={css({ display: "flex", gap: "1" })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProductLinkEvent(item);
              setSelectedProductIds(item.product_ids || []);
            }}
            title="商品紐づけ"
          >
            <IconBook size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditEvent(item);
              setFormData({
                name: item.name,
                description: item.description,
                start_date: item.start_date || "",
                end_date: item.end_date || "",
                location: item.location,
                publisher_id: item.publisher_id || "",
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
              if (window.confirm(`「${item.name}」を削除しますか？`)) {
                deleteMutation.mutate(item.event_id);
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
    createMutation.mutate(formData);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editEvent) {
      updateMutation.mutate({
        eventId: editEvent.event_id,
        data: formData,
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
    <PageContainer title="イベント管理">
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
            placeholder="イベント名・場所で検索..."
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
          イベント追加
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
          data={filteredEvents}
          keyExtractor={(item) => item.event_id}
          emptyMessage="イベントが見つかりません"
        />
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData(initialFormState);
        }}
        title="イベント追加"
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
              <label htmlFor="create-name" className={labelClass}>
                イベント名 *
              </label>
              <input
                id="create-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className={inputClass}
                placeholder="コミックマーケット105"
              />
            </div>

            <div>
              <label htmlFor="create-description" className={labelClass}>
                説明
              </label>
              <textarea
                id="create-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className={`${inputClass} ${css({ minHeight: "100px" })}`}
                placeholder="イベントの説明"
              />
            </div>

            <div>
              <label htmlFor="create-start-date" className={labelClass}>
                開始日
              </label>
              <input
                id="create-start-date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="create-end-date" className={labelClass}>
                終了日
              </label>
              <input
                id="create-end-date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="create-location" className={labelClass}>
                開催場所
              </label>
              <input
                id="create-location"
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                className={inputClass}
                placeholder="東京ビッグサイト"
              />
            </div>

            <div>
              <label htmlFor="create-publisher" className={labelClass}>
                サークル
              </label>
              <select
                id="create-publisher"
                value={formData.publisher_id}
                onChange={(e) =>
                  setFormData({ ...formData, publisher_id: e.target.value })
                }
                className={inputClass}
              >
                <option value="">グローバル（全サークル共通）</option>
                {publishers.map((publisher) => (
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
                サークルを選択しない場合は、全サークル共通のイベントとして登録されます
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
        isOpen={!!editEvent}
        onClose={() => setEditEvent(null)}
        title="イベント編集"
      >
        {editEvent && (
          <form onSubmit={handleUpdateSubmit}>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label htmlFor="edit-name" className={labelClass}>
                  イベント名 *
                </label>
                <input
                  id="edit-name"
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
                <label htmlFor="edit-description" className={labelClass}>
                  説明
                </label>
                <textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className={`${inputClass} ${css({ minHeight: "100px" })}`}
                />
              </div>

              <div>
                <label htmlFor="edit-start-date" className={labelClass}>
                  開始日
                </label>
                <input
                  id="edit-start-date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit-end-date" className={labelClass}>
                  終了日
                </label>
                <input
                  id="edit-end-date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit-location" className={labelClass}>
                  開催場所
                </label>
                <input
                  id="edit-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="edit-publisher" className={labelClass}>
                  サークル
                </label>
                <select
                  id="edit-publisher"
                  value={formData.publisher_id}
                  onChange={(e) =>
                    setFormData({ ...formData, publisher_id: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">グローバル（全サークル共通）</option>
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
                onClick={() => setEditEvent(null)}
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

      {/* Product Link Modal */}
      <Modal
        isOpen={!!productLinkEvent}
        onClose={() => setProductLinkEvent(null)}
        title={`商品紐づけ: ${productLinkEvent?.name || ""}`}
      >
        {productLinkEvent && (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "4",
            })}
          >
            <p className={css({ fontSize: "sm", color: "gray.600" })}>
              このイベントで頒布する商品を選択してください。
              <br />
              選択した商品はPOS端末でこのイベント時に表示されます。
            </p>

            <div
              className={css({
                maxHeight: "400px",
                overflowY: "auto",
                border: "1px solid",
                borderColor: "gray.200",
                borderRadius: "md",
              })}
            >
              {products.length === 0 ? (
                <p
                  className={css({
                    padding: "4",
                    textAlign: "center",
                    color: "gray.500",
                  })}
                >
                  商品がありません
                </p>
              ) : (
                products
                  .filter((p) => p.is_active)
                  .map((product) => {
                    const isSelected = selectedProductIds.includes(
                      product.product_id,
                    );
                    return (
                      <label
                        key={product.product_id}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          padding: "3",
                          borderBottom: "1px solid",
                          borderColor: "gray.100",
                          cursor: "pointer",
                          _hover: {
                            backgroundColor: "gray.50",
                          },
                          _last: {
                            borderBottom: "none",
                          },
                        })}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedProductIds(
                                selectedProductIds.filter(
                                  (id) => id !== product.product_id,
                                ),
                              );
                            } else {
                              setSelectedProductIds([
                                ...selectedProductIds,
                                product.product_id,
                              ]);
                            }
                          }}
                          className={css({
                            width: "4",
                            height: "4",
                            marginRight: "3",
                          })}
                        />
                        <div className={css({ flex: "1" })}>
                          <div
                            className={css({
                              fontWeight: "medium",
                              fontSize: "sm",
                            })}
                          >
                            {product.name}
                          </div>
                          <div
                            className={css({
                              fontSize: "xs",
                              color: "gray.500",
                            })}
                          >
                            {product.category} / ¥
                            {product.price.toLocaleString()}
                          </div>
                        </div>
                      </label>
                    );
                  })
              )}
            </div>

            <div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingY: "2",
                borderTop: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <span className={css({ fontSize: "sm", color: "gray.600" })}>
                選択中: {selectedProductIds.length}件
              </span>
              <div className={css({ display: "flex", gap: "2" })}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setSelectedProductIds(
                      products
                        .filter((p) => p.is_active)
                        .map((p) => p.product_id),
                    )
                  }
                >
                  すべて選択
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedProductIds([])}
                >
                  選択解除
                </Button>
              </div>
            </div>

            {updateProductsMutation.error && (
              <div
                className={css({
                  backgroundColor: "red.50",
                  border: "1px solid",
                  borderColor: "red.200",
                  color: "red.700",
                  padding: "3",
                  borderRadius: "md",
                  fontSize: "sm",
                })}
              >
                {updateProductsMutation.error instanceof Error
                  ? updateProductsMutation.error.message
                  : "更新に失敗しました"}
              </div>
            )}

            <div
              className={css({
                display: "flex",
                justifyContent: "flex-end",
                gap: "2",
              })}
            >
              <Button
                variant="secondary"
                onClick={() => setProductLinkEvent(null)}
                type="button"
              >
                キャンセル
              </Button>
              <Button
                onClick={() =>
                  updateProductsMutation.mutate({
                    eventId: productLinkEvent.event_id,
                    productIds: selectedProductIds,
                  })
                }
                disabled={updateProductsMutation.isPending}
              >
                {updateProductsMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
