import {
  IconBox,
  IconBuildingStore,
  IconCalendar,
  IconChartBar,
  IconHome,
  IconKey,
  IconLogout,
  IconPackage,
  IconSettings,
  IconShoppingCart,
  IconUsers,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { useAuth } from "../lib/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: <IconHome size={20} /> },
  { label: "在庫管理", href: "/stock", icon: <IconBox size={20} /> },
  { label: "商品管理", href: "/products", icon: <IconPackage size={20} /> },
  {
    label: "サークル管理",
    href: "/publishers",
    icon: <IconBuildingStore size={20} />,
  },
  {
    label: "イベント管理",
    href: "/events",
    icon: <IconCalendar size={20} />,
  },
  { label: "売上管理", href: "/sales", icon: <IconShoppingCart size={20} /> },
  { label: "レポート", href: "/reports", icon: <IconChartBar size={20} /> },
  { label: "ユーザー管理", href: "/users", icon: <IconUsers size={20} /> },
  { label: "設定", href: "/settings", icon: <IconSettings size={20} /> },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    if (window.confirm("ログアウトしますか？")) {
      await signOut();
    }
  };

  return (
    <aside
      className={css({
        width: "240px",
        minHeight: "100vh",
        backgroundColor: "gray.900",
        color: "white",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      })}
    >
      <div
        className={css({
          padding: "6",
          borderBottom: "1px solid",
          borderColor: "gray.700",
        })}
      >
        <h1
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            letterSpacing: "tight",
          })}
        >
          版元管理センター
        </h1>
      </div>

      <nav
        className={css({
          flex: "1",
          padding: "4",
        })}
      >
        <ul
          className={css({
            listStyle: "none",
            padding: "0",
            margin: "0",
            display: "flex",
            flexDirection: "column",
            gap: "1",
          })}
        >
          {navItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "3",
                    padding: "3",
                    borderRadius: "md",
                    textDecoration: "none",
                    color: isActive ? "white" : "gray.300",
                    backgroundColor: isActive ? "primary.600" : "transparent",
                    transition: "all 0.2s",
                    _hover: {
                      backgroundColor: isActive ? "primary.600" : "gray.800",
                      color: "white",
                    },
                  })}
                >
                  {item.icon}
                  <span
                    className={css({
                      fontSize: "sm",
                      fontWeight: "medium",
                    })}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={css({
          padding: "4",
          borderTop: "1px solid",
          borderColor: "gray.700",
        })}
      >
        {user && (
          <div
            className={css({
              marginBottom: "3",
              padding: "2",
            })}
          >
            <p
              className={css({
                fontSize: "xs",
                color: "gray.400",
                marginBottom: "1",
              })}
            >
              ログイン中
            </p>
            <p
              className={css({
                fontSize: "sm",
                fontWeight: "medium",
                color: "white",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              })}
            >
              {user.email}
            </p>
          </div>
        )}
        <Link
          to="/change-password"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "3",
            padding: "3",
            borderRadius: "md",
            width: "100%",
            textDecoration: "none",
            backgroundColor:
              currentPath === "/change-password"
                ? "primary.600"
                : "transparent",
            color: currentPath === "/change-password" ? "white" : "gray.300",
            transition: "all 0.2s",
            marginBottom: "2",
            _hover: {
              backgroundColor:
                currentPath === "/change-password" ? "primary.600" : "gray.800",
              color: "white",
            },
          })}
        >
          <IconKey size={20} />
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
            })}
          >
            パスワード変更
          </span>
        </Link>
        <button
          onClick={handleSignOut}
          type="button"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "3",
            padding: "3",
            borderRadius: "md",
            width: "100%",
            border: "none",
            backgroundColor: "transparent",
            color: "gray.300",
            cursor: "pointer",
            transition: "all 0.2s",
            _hover: {
              backgroundColor: "red.600",
              color: "white",
            },
          })}
        >
          <IconLogout size={20} />
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "medium",
            })}
          >
            ログアウト
          </span>
        </button>
      </div>
    </aside>
  );
}
