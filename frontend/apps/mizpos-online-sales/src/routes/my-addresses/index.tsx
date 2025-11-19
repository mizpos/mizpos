import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchUserAttributes } from "aws-amplify/auth";
import { useState } from "react";
import { css } from "styled-system/css";
import {
  type CreateAddressRequest,
  createUserAddress,
  deleteUserAddress,
  getUserAddresses,
  type SavedAddress,
  setDefaultAddress,
  updateUserAddress,
} from "../../lib/api";

export const Route = createFileRoute("/my-addresses/")({
  component: MyAddressesPage,
});

function MyAddressesPage() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(
    null,
  );

  // ユーザー情報を取得
  const { data: userAttributes } = useQuery({
    queryKey: ["userAttributes"],
    queryFn: async () => {
      const attributes = await fetchUserAttributes();
      setUserId(attributes.sub || null);
      return attributes;
    },
  });

  // 住所一覧を取得
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", userId],
    queryFn: () => getUserAddresses(userId!),
    enabled: !!userId,
  });

  // 住所追加
  const createMutation = useMutation({
    mutationFn: (request: CreateAddressRequest) =>
      createUserAddress(userId!, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
      setIsAddingNew(false);
    },
  });

  // 住所更新
  const updateMutation = useMutation({
    mutationFn: ({
      addressId,
      data,
    }: {
      addressId: string;
      data: Partial<CreateAddressRequest>;
    }) => updateUserAddress(userId!, addressId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
      setEditingAddress(null);
    },
  });

  // 住所削除
  const deleteMutation = useMutation({
    mutationFn: (addressId: string) => deleteUserAddress(userId!, addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
    },
  });

  // デフォルト設定
  const setDefaultMutation = useMutation({
    mutationFn: (addressId: string) => setDefaultAddress(userId!, addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses", userId] });
    },
  });

  if (!userAttributes) {
    return (
      <div
        className={css({
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "32px 20px",
        })}
      >
        <div className={css({ textAlign: "center" })}>
          <p>ログインが必要です</p>
          <Link to="/login">
            <button
              type="button"
              className={css({
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
              })}
            >
              ログイン
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={css({
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "32px 20px",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          <h1 className={css({ fontSize: "24px", fontWeight: "bold" })}>
            登録住所管理
          </h1>
          <div className={css({ display: "flex", gap: "16px" })}>
            <Link to="/">
              <button
                type="button"
                className={css({
                  padding: "8px 16px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  borderRadius: "4px",
                  border: "none",
                  cursor: "pointer",
                })}
              >
                商品一覧へ
              </button>
            </Link>
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className={css({
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
              })}
            >
              新しい住所を追加
            </button>
          </div>
        </div>

        {isLoading && <p>読み込み中...</p>}

        {/* 住所追加フォーム */}
        {isAddingNew && (
          <AddressForm
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setIsAddingNew(false)}
            isLoading={createMutation.isPending}
          />
        )}

        {/* 住所編集フォーム */}
        {editingAddress && (
          <AddressForm
            initialData={editingAddress}
            onSubmit={(data) =>
              updateMutation.mutate({
                addressId: editingAddress.address_id,
                data,
              })
            }
            onCancel={() => setEditingAddress(null)}
            isLoading={updateMutation.isPending}
          />
        )}

        {/* 住所一覧 */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          })}
        >
          {addresses.map((address) => (
            <AddressCard
              key={address.address_id}
              address={address}
              onEdit={() => setEditingAddress(address)}
              onDelete={() => deleteMutation.mutate(address.address_id)}
              onSetDefault={() => setDefaultMutation.mutate(address.address_id)}
              isDeleting={deleteMutation.isPending}
              isSettingDefault={setDefaultMutation.isPending}
            />
          ))}
        </div>

        {addresses.length === 0 && !isLoading && !isAddingNew && (
          <div
            className={css({
              padding: "32px",
              textAlign: "center",
              borderWidth: "1px",
              borderRadius: "8px",
              borderStyle: "dashed",
            })}
          >
            <p>登録されている住所がありません</p>
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className={css({
                marginTop: "16px",
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
              })}
            >
              最初の住所を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 住所カードコンポーネント
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting,
  isSettingDefault,
}: {
  address: SavedAddress;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isDeleting: boolean;
  isSettingDefault: boolean;
}) {
  return (
    <div
      className={css({
        padding: "16px",
        borderWidth: "1px",
        borderRadius: "8px",
        backgroundColor: address.is_default ? "#e7f3ff" : "white",
        position: "relative",
      })}
    >
      {address.is_default && (
        <div
          className={css({
            position: "absolute",
            top: "8px",
            right: "8px",
            paddingX: "8px",
            paddingY: "4px",
            backgroundColor: "#007bff",
            color: "white",
            borderRadius: "8px",
            fontSize: "14px",
          })}
        >
          デフォルト
        </div>
      )}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        })}
      >
        <h3 className={css({ fontSize: "18px", fontWeight: "bold" })}>
          {address.label}
        </h3>
        <p>{address.name} 様</p>
        <p>〒{address.postal_code}</p>
        <p>
          {address.prefecture}
          {address.city}
          {address.address_line1}
        </p>
        {address.address_line2 && <p>{address.address_line2}</p>}
        <p>電話番号: {address.phone_number}</p>

        <div
          className={css({
            display: "flex",
            gap: "8px",
            marginTop: "8px",
          })}
        >
          <button
            type="button"
            onClick={onEdit}
            className={css({
              padding: "6px 12px",
              backgroundColor: "#ffc107",
              color: "black",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            })}
          >
            編集
          </button>
          {!address.is_default && (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={isSettingDefault}
              className={css({
                padding: "6px 12px",
                backgroundColor: "#17a2b8",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: isSettingDefault ? "not-allowed" : "pointer",
                fontSize: "14px",
                opacity: isSettingDefault ? 0.6 : 1,
              })}
            >
              {isSettingDefault ? "設定中..." : "デフォルトに設定"}
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className={css({
              padding: "6px 12px",
              backgroundColor: "#dc3545",
              color: "white",
              borderRadius: "4px",
              border: "none",
              cursor: isDeleting ? "not-allowed" : "pointer",
              fontSize: "14px",
              opacity: isDeleting ? 0.6 : 1,
            })}
          >
            {isDeleting ? "削除中..." : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 住所フォームコンポーネント
function AddressForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: {
  initialData?: SavedAddress;
  onSubmit: (data: CreateAddressRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateAddressRequest>({
    label: initialData?.label || "",
    name: initialData?.name || "",
    postal_code: initialData?.postal_code || "",
    prefecture: initialData?.prefecture || "",
    city: initialData?.city || "",
    address_line1: initialData?.address_line1 || "",
    address_line2: initialData?.address_line2 || "",
    phone_number: initialData?.phone_number || "",
    is_default: initialData?.is_default || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div
      className={css({
        padding: "16px",
        borderWidth: "1px",
        borderRadius: "8px",
        backgroundColor: "#f8f9fa",
      })}
    >
      <form onSubmit={handleSubmit}>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          })}
        >
          <h3 style={{ fontSize: "18px", fontWeight: "bold" }}>
            {initialData ? "住所を編集" : "新しい住所を追加"}
          </h3>

          <div>
            <label
              htmlFor="label"
              style={{ display: "block", marginBottom: "4px" }}
            >
              ラベル（例: 自宅、会社）
            </label>
            <input
              id="label"
              type="text"
              value={formData.label}
              onChange={(e) =>
                setFormData({ ...formData, label: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="name"
              style={{ display: "block", marginBottom: "4px" }}
            >
              お名前
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="postal_code"
              style={{ display: "block", marginBottom: "4px" }}
            >
              郵便番号
            </label>
            <input
              id="postal_code"
              type="text"
              value={formData.postal_code}
              onChange={(e) =>
                setFormData({ ...formData, postal_code: e.target.value })
              }
              placeholder="123-4567"
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="prefecture"
              style={{ display: "block", marginBottom: "4px" }}
            >
              都道府県
            </label>
            <input
              id="prefecture"
              type="text"
              value={formData.prefecture}
              onChange={(e) =>
                setFormData({ ...formData, prefecture: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="city"
              style={{ display: "block", marginBottom: "4px" }}
            >
              市区町村
            </label>
            <input
              id="city"
              type="text"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="address_line1"
              style={{ display: "block", marginBottom: "4px" }}
            >
              町名・番地
            </label>
            <input
              id="address_line1"
              type="text"
              value={formData.address_line1}
              onChange={(e) =>
                setFormData({ ...formData, address_line1: e.target.value })
              }
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="address_line2"
              style={{ display: "block", marginBottom: "4px" }}
            >
              建物名・部屋番号（任意）
            </label>
            <input
              id="address_line2"
              type="text"
              value={formData.address_line2}
              onChange={(e) =>
                setFormData({ ...formData, address_line2: e.target.value })
              }
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="phone_number"
              style={{ display: "block", marginBottom: "4px" }}
            >
              電話番号
            </label>
            <input
              id="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={(e) =>
                setFormData({ ...formData, phone_number: e.target.value })
              }
              placeholder="090-1234-5678"
              required
              style={{
                width: "100%",
                padding: "8px",
                borderWidth: "1px",
                borderRadius: "4px",
              }}
            />
          </div>

          <div>
            <label
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "8px",
              })}
            >
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) =>
                  setFormData({ ...formData, is_default: e.target.checked })
                }
              />
              デフォルトの配送先に設定
            </label>
          </div>

          <div className={css({ display: "flex", gap: "8px" })}>
            <button
              type="submit"
              disabled={isLoading}
              className={css({
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              })}
            >
              {isLoading ? "保存中..." : "保存"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className={css({
                padding: "8px 16px",
                backgroundColor: "#6c757d",
                color: "white",
                borderRadius: "4px",
                border: "none",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              })}
            >
              キャンセル
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
