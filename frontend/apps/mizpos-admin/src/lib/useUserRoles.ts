import { useQuery } from "@tanstack/react-query";
import { getAuthenticatedClients } from "./api";
import { useAuth } from "./auth";

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

interface UseUserRolesResult {
  roles: Role[];
  isLoading: boolean;
  isSystemAdmin: boolean;
  isPublisherAdmin: boolean;
  publisherIds: string[];
  hasPublisherRole: (publisherId: string) => boolean;
  hasPublisherAdminRole: (publisherId: string) => boolean;
  canAccessPublishers: boolean;
  canAddPublisher: boolean;
}

export function useUserRoles(): UseUserRolesResult {
  const { user } = useAuth();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["current-user-roles", user?.userId],
    queryFn: async () => {
      if (!user?.userId) return [];
      const { accounts } = await getAuthenticatedClients();
      const { data, error } = await accounts.GET("/users/{user_id}/roles", {
        params: { path: { user_id: user.userId } },
      });
      if (error) throw error;
      const rolesData = (data as unknown as { roles: Role[] }).roles || [];
      console.log("[useUserRoles] userId:", user.userId, "roles:", rolesData);
      return rolesData;
    },
    enabled: !!user?.userId,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  // システム管理者かどうか
  const isSystemAdmin = roles.some((role) => role.role_type === "system_admin");

  // サークル管理者ロールを持っているかどうか（どれか1つでも）
  const isPublisherAdmin = roles.some(
    (role) => role.role_type === "publisher_admin"
  );

  // ユーザーが紐づいているサークルIDの一覧
  // Note: APIレスポンスにscopeが含まれない場合もあるため、role_typeとpublisher_idで判定
  const publisherIds = [
    ...new Set(
      roles
        .filter(
          (role) =>
            role.publisher_id &&
            (role.role_type === "publisher_admin" ||
              role.role_type === "publisher_sales")
        )
        .map((role) => role.publisher_id as string)
    ),
  ];

  // デバッグ用
  if (roles.length > 0) {
    console.log("[useUserRoles] publisherIds:", publisherIds, "isSystemAdmin:", isSystemAdmin);
  }

  // 特定のサークルに対するロールを持っているか
  const hasPublisherRole = (publisherId: string): boolean => {
    if (isSystemAdmin) return true;
    return roles.some(
      (role) =>
        role.publisher_id === publisherId &&
        (role.role_type === "publisher_admin" ||
          role.role_type === "publisher_sales")
    );
  };

  // 特定のサークルに対する管理者ロールを持っているか
  const hasPublisherAdminRole = (publisherId: string): boolean => {
    if (isSystemAdmin) return true;
    return roles.some(
      (role) =>
        role.publisher_id === publisherId &&
        role.role_type === "publisher_admin"
    );
  };

  // サークル管理ページにアクセスできるか（システム管理者のみ）
  const canAccessPublishers = isSystemAdmin;

  // サークルを追加できるか（システム管理者のみ）
  const canAddPublisher = isSystemAdmin;

  return {
    roles,
    isLoading,
    isSystemAdmin,
    isPublisherAdmin,
    publisherIds,
    hasPublisherRole,
    hasPublisherAdminRole,
    canAccessPublishers,
    canAddPublisher,
  };
}
