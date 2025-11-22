import {
  IconEdit,
  IconGift,
  IconPercentage,
  IconPlus,
  IconSearch,
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
import { getAuthHeaders } from "../lib/api";

const API_GATEWAY_BASE =
  import.meta.env.VITE_API_GATEWAY_BASE ||
  "https://tx9l9kos3h.execute-api.ap-northeast-1.amazonaws.com/dev";

export const Route = createFileRoute("/coupons")({
  component: CouponsPage,
});

interface Coupon {
  coupon_id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  publisher_id?: string;
  event_id?: string;
  min_purchase_amount: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until?: string;
  usage_limit?: number;
  usage_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Publisher {
  publisher_id: string;
  name: string;
}

interface Event {
  event_id: string;
  name: string;
}

interface CreateCouponForm {
  code: string;
  name: string;
  description: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  publisher_id: string;
  event_id: string;
  min_purchase_amount: number;
  max_discount_amount: number | null;
  valid_from: string;
  valid_until: string;
  usage_limit: number | null;
  active: boolean;
}

function CouponsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);

  const initialFormState: CreateCouponForm = {
    code: "",
    name: "",
    description: "",
    discount_type: "fixed",
    discount_value: 0,
    publisher_id: "",
    event_id: "",
    min_purchase_amount: 0,
    max_discount_amount: null,
    valid_from: "",
    valid_until: "",
    usage_limit: null,
    active: true,
  };

  const [formData, setFormData] = useState<CreateCouponForm>(initialFormState);

  // クーポン一覧取得
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/accounts/coupons`, {
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch coupons");
      const data = await response.json();
      return data.coupons as Coupon[];
    },
  });

  // サークル一覧取得
  const { data: publishers = [] } = useQuery({
    queryKey: ["publishers-for-coupons"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/accounts/publishers`, {
        headers,
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.publishers || []) as Publisher[];
    },
  });

  // イベント一覧取得
  const { data: events = [] } = useQuery({
    queryKey: ["events-for-coupons"],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_GATEWAY_BASE}/accounts/events`, {
        headers,
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data.events || []) as Event[];
    },
  });

  // クーポン作成
  const createMutation = useMutation({
    mutationFn: async (data: CreateCouponForm) => {
      const headers = await getAuthHeaders();
      const body = {
        ...data,
        publisher_id: data.publisher_id || undefined,
        event_id: data.event_id || undefined,
        max_discount_amount: data.max_discount_amount || undefined,
        valid_from: data.valid_from || undefined,
        valid_until: data.valid_until || undefined,
        usage_limit: data.usage_limit || undefined,
      };
      const response = await fetch(`${API_GATEWAY_BASE}/accounts/coupons`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create coupon");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setIsCreateModalOpen(false);
      setFormData(initialFormState);
    },
  });

  // クーポン更新
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreateCouponForm>;
    }) => {
      const headers = await getAuthHeaders();
      const body = {
        ...data,
        publisher_id: data.publisher_id || undefined,
        event_id: data.event_id || undefined,
        max_discount_amount: data.max_discount_amount || undefined,
        valid_from: data.valid_from || undefined,
        valid_until: data.valid_until || undefined,
        usage_limit: data.usage_limit || undefined,
      };
      const response = await fetch(
        `${API_GATEWAY_BASE}/accounts/coupons/${id}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update coupon");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
      setEditCoupon(null);
    },
  });

  // クーポン削除
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_GATEWAY_BASE}/accounts/coupons/${id}`,
        {
          method: "DELETE",
          headers,
        },
      );
      if (!response.ok) throw new Error("Failed to delete coupon");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coupons"] });
    },
  });

  const filteredCoupons = coupons.filter(
    (coupon) =>
      coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      coupon.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "fixed") {
      return `¥${coupon.discount_value.toLocaleString()} 引き`;
    }
    return `${coupon.discount_value}% 割引`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const columns = [
    {
      key: "code",
      header: "コード",
      render: (item: Coupon) => (
        <span
          className={css({
            fontFamily: "mono",
            fontWeight: "semibold",
            textTransform: "uppercase",
          })}
        >
          {item.code}
        </span>
      ),
    },
    { key: "name", header: "名前" },
    {
      key: "discount",
      header: "割引",
      render: (item: Coupon) => (
        <span
          className={css({
            display: "inline-flex",
            alignItems: "center",
            gap: "1",
          })}
        >
          {item.discount_type === "fixed" ? (
            <IconGift size={16} />
          ) : (
            <IconPercentage size={16} />
          )}
          {formatDiscount(item)}
        </span>
      ),
    },
    {
      key: "usage",
      header: "使用状況",
      render: (item: Coupon) => (
        <span>
          {item.usage_count}
          {item.usage_limit ? ` / ${item.usage_limit}` : " (無制限)"}
        </span>
      ),
    },
    {
      key: "validity",
      header: "有効期間",
      render: (item: Coupon) => (
        <span className={css({ fontSize: "xs" })}>
          {formatDate(item.valid_from)} 〜 {formatDate(item.valid_until)}
        </span>
      ),
    },
    {
      key: "active",
      header: "状態",
      render: (item: Coupon) => (
        <span
          className={css({
            display: "inline-flex",
            paddingX: "2",
            paddingY: "0.5",
            borderRadius: "full",
            fontSize: "xs",
            fontWeight: "medium",
            backgroundColor: item.active ? "green.100" : "gray.100",
            color: item.active ? "green.800" : "gray.800",
          })}
        >
          {item.active ? "有効" : "無効"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Coupon) => (
        <div
          className={css({
            display: "flex",
            gap: "1",
          })}
        >
          <Button variant="ghost" size="sm" onClick={() => setEditCoupon(item)}>
            <IconEdit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`クーポン「${item.code}」を削除しますか？`)) {
                deleteMutation.mutate(item.coupon_id);
              }
            }}
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
    if (editCoupon) {
      const updateData: Partial<CreateCouponForm> = {
        name: editCoupon.name,
        description: editCoupon.description || "",
        discount_type: editCoupon.discount_type,
        discount_value: editCoupon.discount_value,
        publisher_id: editCoupon.publisher_id || "",
        event_id: editCoupon.event_id || "",
        min_purchase_amount: editCoupon.min_purchase_amount,
        max_discount_amount: editCoupon.max_discount_amount || null,
        valid_from: editCoupon.valid_from || "",
        valid_until: editCoupon.valid_until || "",
        usage_limit: editCoupon.usage_limit || null,
        active: editCoupon.active,
      };
      updateMutation.mutate({
        id: editCoupon.coupon_id,
        data: updateData,
      });
    }
  };

  return (
    <>
      <Header title="クーポン管理" />
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
              placeholder="コード・名前で検索..."
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
            クーポン追加
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
            data={filteredCoupons}
            keyExtractor={(item) => item.coupon_id}
            emptyMessage="クーポンが見つかりません"
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
        title="クーポン追加"
      >
        <form onSubmit={handleCreateSubmit}>
          <CouponForm
            data={formData}
            onChange={setFormData}
            publishers={publishers}
            events={events}
            isNew
          />
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
          {createMutation.error && (
            <p
              className={css({
                color: "red.600",
                fontSize: "sm",
                marginTop: "2",
              })}
            >
              {createMutation.error.message}
            </p>
          )}
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editCoupon}
        onClose={() => setEditCoupon(null)}
        title="クーポン編集"
      >
        {editCoupon && (
          <form onSubmit={handleUpdateSubmit}>
            <CouponForm
              data={{
                code: editCoupon.code,
                name: editCoupon.name,
                description: editCoupon.description || "",
                discount_type: editCoupon.discount_type,
                discount_value: editCoupon.discount_value,
                publisher_id: editCoupon.publisher_id || "",
                event_id: editCoupon.event_id || "",
                min_purchase_amount: editCoupon.min_purchase_amount,
                max_discount_amount: editCoupon.max_discount_amount || null,
                valid_from: editCoupon.valid_from || "",
                valid_until: editCoupon.valid_until || "",
                usage_limit: editCoupon.usage_limit || null,
                active: editCoupon.active,
              }}
              onChange={(updated) =>
                setEditCoupon({
                  ...editCoupon,
                  ...updated,
                  max_discount_amount: updated.max_discount_amount ?? undefined,
                  valid_from: updated.valid_from || undefined,
                  valid_until: updated.valid_until || undefined,
                  usage_limit: updated.usage_limit ?? undefined,
                })
              }
              publishers={publishers}
              events={events}
              isNew={false}
            />
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
                onClick={() => setEditCoupon(null)}
                type="button"
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </div>
            {updateMutation.error && (
              <p
                className={css({
                  color: "red.600",
                  fontSize: "sm",
                  marginTop: "2",
                })}
              >
                {updateMutation.error.message}
              </p>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}

interface CouponFormProps {
  data: CreateCouponForm;
  onChange: (data: CreateCouponForm) => void;
  publishers: Publisher[];
  events: Event[];
  isNew: boolean;
}

function CouponForm({
  data,
  onChange,
  publishers,
  events,
  isNew,
}: CouponFormProps) {
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
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "4",
      })}
    >
      <div>
        <label htmlFor="code" className={labelClass}>
          クーポンコード *
        </label>
        <input
          id="code"
          type="text"
          required
          value={data.code}
          onChange={(e) =>
            onChange({ ...data, code: e.target.value.toUpperCase() })
          }
          className={inputClass}
          placeholder="例: SUMMER2024"
          disabled={!isNew}
          style={{ textTransform: "uppercase" }}
        />
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          クーポン名 *
        </label>
        <input
          id="name"
          type="text"
          required
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className={inputClass}
          placeholder="例: 夏の特別割引"
        />
      </div>

      <div className={css({ gridColumn: "span 2" })}>
        <label htmlFor="description" className={labelClass}>
          説明
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={2}
          className={`${inputClass} ${css({ resize: "vertical" })}`}
          placeholder="クーポンの説明..."
        />
      </div>

      <div>
        <label htmlFor="discount_type" className={labelClass}>
          割引タイプ *
        </label>
        <select
          id="discount_type"
          value={data.discount_type}
          onChange={(e) =>
            onChange({
              ...data,
              discount_type: e.target.value as "fixed" | "percentage",
            })
          }
          className={inputClass}
        >
          <option value="fixed">固定額</option>
          <option value="percentage">割引率</option>
        </select>
      </div>

      <div>
        <label htmlFor="discount_value" className={labelClass}>
          {data.discount_type === "fixed" ? "割引額 (円) *" : "割引率 (%) *"}
        </label>
        <input
          id="discount_value"
          type="number"
          required
          min="1"
          max={data.discount_type === "percentage" ? 100 : undefined}
          value={data.discount_value}
          onChange={(e) =>
            onChange({
              ...data,
              discount_value: Number.parseInt(e.target.value, 10) || 0,
            })
          }
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="min_purchase_amount" className={labelClass}>
          最低購入金額 (円)
        </label>
        <input
          id="min_purchase_amount"
          type="number"
          min="0"
          value={data.min_purchase_amount}
          onChange={(e) =>
            onChange({
              ...data,
              min_purchase_amount: Number.parseInt(e.target.value, 10) || 0,
            })
          }
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="max_discount_amount" className={labelClass}>
          最大割引額 (円)
        </label>
        <input
          id="max_discount_amount"
          type="number"
          min="0"
          value={data.max_discount_amount ?? ""}
          onChange={(e) =>
            onChange({
              ...data,
              max_discount_amount: e.target.value
                ? Number.parseInt(e.target.value, 10)
                : null,
            })
          }
          className={inputClass}
          placeholder="空白=無制限"
        />
        <p
          className={css({ fontSize: "xs", color: "gray.500", marginTop: "1" })}
        >
          割引率の場合に有効
        </p>
      </div>

      <div>
        <label htmlFor="valid_from" className={labelClass}>
          有効開始日
        </label>
        <input
          id="valid_from"
          type="date"
          value={data.valid_from ? data.valid_from.split("T")[0] : ""}
          onChange={(e) =>
            onChange({
              ...data,
              valid_from: e.target.value ? `${e.target.value}T00:00:00Z` : "",
            })
          }
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="valid_until" className={labelClass}>
          有効終了日
        </label>
        <input
          id="valid_until"
          type="date"
          value={data.valid_until ? data.valid_until.split("T")[0] : ""}
          onChange={(e) =>
            onChange({
              ...data,
              valid_until: e.target.value ? `${e.target.value}T23:59:59Z` : "",
            })
          }
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="usage_limit" className={labelClass}>
          使用回数上限
        </label>
        <input
          id="usage_limit"
          type="number"
          min="1"
          value={data.usage_limit ?? ""}
          onChange={(e) =>
            onChange({
              ...data,
              usage_limit: e.target.value
                ? Number.parseInt(e.target.value, 10)
                : null,
            })
          }
          className={inputClass}
          placeholder="空白=無制限"
        />
      </div>

      <div>
        <label htmlFor="active" className={labelClass}>
          状態
        </label>
        <select
          id="active"
          value={data.active ? "true" : "false"}
          onChange={(e) =>
            onChange({ ...data, active: e.target.value === "true" })
          }
          className={inputClass}
        >
          <option value="true">有効</option>
          <option value="false">無効</option>
        </select>
      </div>

      <div>
        <label htmlFor="publisher_id" className={labelClass}>
          対象サークル (任意)
        </label>
        <select
          id="publisher_id"
          value={data.publisher_id}
          onChange={(e) => onChange({ ...data, publisher_id: e.target.value })}
          className={inputClass}
        >
          <option value="">-- 全サークル --</option>
          {publishers.map((publisher) => (
            <option key={publisher.publisher_id} value={publisher.publisher_id}>
              {publisher.name}
            </option>
          ))}
        </select>
        <p
          className={css({ fontSize: "xs", color: "gray.500", marginTop: "1" })}
        >
          特定サークルの商品のみに適用
        </p>
      </div>

      <div>
        <label htmlFor="event_id" className={labelClass}>
          対象イベント (任意)
        </label>
        <select
          id="event_id"
          value={data.event_id}
          onChange={(e) => onChange({ ...data, event_id: e.target.value })}
          className={inputClass}
        >
          <option value="">-- 全イベント --</option>
          {events.map((event) => (
            <option key={event.event_id} value={event.event_id}>
              {event.name}
            </option>
          ))}
        </select>
        <p
          className={css({ fontSize: "xs", color: "gray.500", marginTop: "1" })}
        >
          特定イベントでの販売のみに適用
        </p>
      </div>
    </div>
  );
}
