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
  mizposUserId: string | null;
}

export function useUserRoles(): UseUserRolesResult {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["current-user-roles"],
    queryFn: async () => {
      const { accounts } = await getAuthenticatedClients();
      // /me/roles を使用して現在のユーザーのロールを取得
      // これにより、CognitoのユーザーIDではなくmizposの内部ユーザーIDでロールを検索できる
      const { data, error } = await accounts.GET("/me/roles", {});
      if (error) throw error;
      return data as unknown as { roles: Role[]; user_id: string };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5分間キャッシュ
  });

  const roles = data?.roles || [];
  const mizposUserId = data?.user_id || null;

  // システム管理者かどうか
  const isSystemAdmin = roles.some((role) => role.role_type === "system_admin");

  // サークル管理者ロールを持っているかどうか（どれか1つでも）
  const isPublisherAdmin = roles.some(
    (role) => role.role_type === "publisher_admin",
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
              role.role_type === "publisher_sales"),
        )
        .map((role) => role.publisher_id as string),
    ),
  ];

  // 特定のサークルに対するロールを持っているか
  const hasPublisherRole = (publisherId: string): boolean => {
    if (isSystemAdmin) return true;
    return roles.some(
      (role) =>
        role.publisher_id === publisherId &&
        (role.role_type === "publisher_admin" ||
          role.role_type === "publisher_sales"),
    );
  };

  // 特定のサークルに対する管理者ロールを持っているか
  const hasPublisherAdminRole = (publisherId: string): boolean => {
    if (isSystemAdmin) return true;
    return roles.some(
      (role) =>
        role.publisher_id === publisherId &&
        role.role_type === "publisher_admin",
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
    mizposUserId,
  };
}
