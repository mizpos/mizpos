import { IconEdit, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});

type UserRole = "admin" | "manager" | "sales" | "viewer";

interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

const mockUsers: User[] = [
  {
    user_id: "usr_001",
    email: "admin@example.com",
    name: "管理者",
    role: "admin",
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    last_login: "2024-11-16T10:00:00Z",
  },
  {
    user_id: "usr_002",
    email: "manager@example.com",
    name: "マネージャー",
    role: "manager",
    is_active: true,
    created_at: "2024-02-01T00:00:00Z",
    last_login: "2024-11-15T14:30:00Z",
  },
  {
    user_id: "usr_003",
    email: "sales@example.com",
    name: "販売担当",
    role: "sales",
    is_active: true,
    created_at: "2024-03-01T00:00:00Z",
    last_login: "2024-11-16T09:00:00Z",
  },
];

interface UserForm {
  email: string;
  name: string;
  role: UserRole;
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserForm>({
    email: "",
    name: "",
    role: "viewer",
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      admin: { backgroundColor: "red.100", color: "red.800", label: "管理者" },
      manager: { backgroundColor: "blue.100", color: "blue.800", label: "マネージャー" },
      sales: { backgroundColor: "green.100", color: "green.800", label: "販売担当" },
      viewer: { backgroundColor: "gray.100", color: "gray.800", label: "閲覧者" },
    };
    const style = styles[role];

    return (
      <span
        className={css({
          display: "inline-flex",
          paddingX: "2",
          paddingY: "0.5",
          borderRadius: "full",
          fontSize: "xs",
          fontWeight: "medium",
          backgroundColor: style.backgroundColor,
          color: style.color,
        })}
      >
        {style.label}
      </span>
    );
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

  const columns = [
    { key: "name", header: "名前" },
    { key: "email", header: "メールアドレス" },
    {
      key: "role",
      header: "ロール",
      render: (item: User) => getRoleBadge(item.role),
    },
    {
      key: "is_active",
      header: "状態",
      render: (item: User) => (
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
      key: "last_login",
      header: "最終ログイン",
      render: (item: User) => (item.last_login ? formatDate(item.last_login) : "-"),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: User) => (
        <div className={css({ display: "flex", gap: "1" })}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditUser(item);
              setFormData({
                email: item.email,
                name: item.name,
                role: item.role,
              });
            }}
          >
            <IconEdit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`「${item.name}」を削除しますか？`)) {
                setUsers(users.filter((u) => u.user_id !== item.user_id));
              }
            }}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreate = () => {
    const newUser: User = {
      user_id: `usr_${Date.now()}`,
      email: formData.email,
      name: formData.name,
      role: formData.role,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setUsers([...users, newUser]);
    setIsCreateModalOpen(false);
    setFormData({ email: "", name: "", role: "viewer" });
  };

  const handleUpdate = () => {
    if (!editUser) return;
    setUsers(
      users.map((u) =>
        u.user_id === editUser.user_id
          ? { ...u, email: formData.email, name: formData.name, role: formData.role }
          : u
      )
    );
    setEditUser(null);
    setFormData({ email: "", name: "", role: "viewer" });
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
      <Header title="ユーザー管理" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
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
            ユーザー認証はAWS Cognitoで管理されています。ここではロールの割り当てと権限管理を行います。
          </p>
        </div>

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

        <Table
          columns={columns}
          data={filteredUsers}
          keyExtractor={(item) => item.user_id}
          emptyMessage="ユーザーが見つかりません"
        />

        {/* Role Description */}
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
          <h3 className={css({ fontSize: "lg", fontWeight: "semibold", marginBottom: "4" })}>
            ロール権限
          </h3>
          <div className={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4" })}>
            <div>
              <p className={css({ fontWeight: "semibold", fontSize: "sm", marginBottom: "1" })}>
                管理者 (Admin)
              </p>
              <p className={css({ fontSize: "xs", color: "gray.600" })}>
                全ての機能にアクセス可能。ユーザー管理、設定変更が可能。
              </p>
            </div>
            <div>
              <p className={css({ fontWeight: "semibold", fontSize: "sm", marginBottom: "1" })}>
                マネージャー (Manager)
              </p>
              <p className={css({ fontSize: "xs", color: "gray.600" })}>
                商品・在庫管理、レポート閲覧が可能。ユーザー管理は不可。
              </p>
            </div>
            <div>
              <p className={css({ fontWeight: "semibold", fontSize: "sm", marginBottom: "1" })}>
                販売担当 (Sales)
              </p>
              <p className={css({ fontSize: "xs", color: "gray.600" })}>
                販売処理、在庫確認が可能。商品登録や設定変更は不可。
              </p>
            </div>
            <div>
              <p className={css({ fontWeight: "semibold", fontSize: "sm", marginBottom: "1" })}>
                閲覧者 (Viewer)
              </p>
              <p className={css({ fontSize: "xs", color: "gray.600" })}>
                データの閲覧のみ可能。編集や操作は不可。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData({ email: "", name: "", role: "viewer" });
        }}
        title="ユーザー追加"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
            <div>
              <label htmlFor="create-email" className={labelClass}>
                メールアドレス *
              </label>
              <input
                id="create-email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="create-name" className={labelClass}>
                名前 *
              </label>
              <input
                id="create-name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="create-role" className={labelClass}>
                ロール
              </label>
              <select
                id="create-role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className={inputClass}
              >
                <option value="admin">管理者</option>
                <option value="manager">マネージャー</option>
                <option value="sales">販売担当</option>
                <option value="viewer">閲覧者</option>
              </select>
            </div>
          </div>
          <div className={css({ display: "flex", justifyContent: "flex-end", gap: "2", marginTop: "4" })}>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData({ email: "", name: "", role: "viewer" });
              }}
              type="button"
            >
              キャンセル
            </Button>
            <Button type="submit">作成</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="ユーザー編集">
        {editUser && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdate();
            }}
          >
            <div className={css({ display: "flex", flexDirection: "column", gap: "4" })}>
              <div>
                <label htmlFor="edit-email" className={labelClass}>
                  メールアドレス *
                </label>
                <input
                  id="edit-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit-name" className={labelClass}>
                  名前 *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit-role" className={labelClass}>
                  ロール
                </label>
                <select
                  id="edit-role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className={inputClass}
                >
                  <option value="admin">管理者</option>
                  <option value="manager">マネージャー</option>
                  <option value="sales">販売担当</option>
                  <option value="viewer">閲覧者</option>
                </select>
              </div>
            </div>
            <div className={css({ display: "flex", justifyContent: "flex-end", gap: "2", marginTop: "4" })}>
              <Button variant="secondary" onClick={() => setEditUser(null)} type="button">
                キャンセル
              </Button>
              <Button type="submit">更新</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
