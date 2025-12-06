import {
  IconBox,
  IconBuildingStore,
  IconCalendar,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconCpu,
  IconDeviceDesktop,
  IconDownload,
  IconGift,
  IconHome,
  IconKey,
  IconLogout,
  IconPackage,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { useAuth } from "../../lib/auth";
import { useLayout } from "./context";

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
  { label: "クーポン管理", href: "/coupons", icon: <IconGift size={20} /> },
  { label: "レポート", href: "/reports", icon: <IconChartBar size={20} /> },
  { label: "ユーザー管理", href: "/users", icon: <IconUsers size={20} /> },
  {
    label: "POS従業員",
    href: "/pos-employees",
    icon: <IconDeviceDesktop size={20} />,
  },
  {
    label: "端末管理",
    href: "/terminals",
    icon: <IconCpu size={20} />,
  },
  {
    label: "クライアント",
    href: "/download",
    icon: <IconDownload size={20} />,
  },
  { label: "設定", href: "/settings", icon: <IconSettings size={20} /> },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { user, signOut } = useAuth();
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    isMobile,
    closeSidebar,
    toggleCollapse,
  } = useLayout();

  const handleSignOut = async () => {
    if (window.confirm("ログアウトしますか？")) {
      await signOut();
    }
  };

  const handleNavClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  const isVisible = isMobile ? isSidebarOpen : true;
  const isCollapsed = !isMobile && isSidebarCollapsed;

  if (!isVisible && isMobile) {
    return null;
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="サイドバーを閉じる"
          className={css({
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: "overlay",
            animation: "fadeIn 0.2s ease-out",
            border: "none",
            cursor: "pointer",
          })}
          onClick={closeSidebar}
          onKeyDown={(e) => e.key === "Escape" && closeSidebar()}
        />
      )}

      <aside
        className={css({
          position: isMobile ? "fixed" : "relative",
          top: 0,
          left: 0,
          bottom: 0,
          width: isCollapsed ? "sidebar-collapsed" : "sidebar",
          minHeight: "100vh",
          backgroundColor: "gray.900",
          color: "white",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          zIndex: "sidebar",
          boxShadow: isMobile ? "overlay" : "sidebar",
          transition: "width 0.2s ease-in-out",
          animation: isMobile ? "slideInLeft 0.2s ease-out" : undefined,
          overflowX: "hidden",
        })}
      >
        {/* Header */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            padding: isCollapsed ? "4" : "5",
            minHeight: "header",
            borderBottom: "1px solid",
            borderColor: "gray.800",
          })}
        >
          {!isCollapsed && (
            <h1
              className={css({
                fontSize: "lg",
                fontWeight: "bold",
                letterSpacing: "tight",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })}
            >
              版元管理センター
            </h1>
          )}

          {isMobile ? (
            <button
              type="button"
              onClick={closeSidebar}
              className={css({
                padding: "2",
                borderRadius: "md",
                backgroundColor: "transparent",
                border: "none",
                color: "gray.400",
                cursor: "pointer",
                _hover: { backgroundColor: "gray.800", color: "white" },
              })}
            >
              <IconX size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleCollapse}
              className={css({
                padding: "2",
                borderRadius: "md",
                backgroundColor: "transparent",
                border: "none",
                color: "gray.400",
                cursor: "pointer",
                _hover: { backgroundColor: "gray.800", color: "white" },
              })}
              title={
                isCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"
              }
            >
              {isCollapsed ? (
                <IconChevronRight size={18} />
              ) : (
                <IconChevronLeft size={18} />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={css({
            flex: "1",
            padding: isCollapsed ? "2" : "3",
            overflowY: "auto",
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
                    onClick={handleNavClick}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      justifyContent: isCollapsed ? "center" : "flex-start",
                      gap: "3",
                      padding: isCollapsed ? "3" : "3",
                      borderRadius: "lg",
                      textDecoration: "none",
                      color: isActive ? "white" : "gray.400",
                      backgroundColor: isActive ? "primary.600" : "transparent",
                      transition: "all 0.15s ease",
                      _hover: {
                        backgroundColor: isActive ? "primary.600" : "gray.800",
                        color: "white",
                      },
                    })}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span
                      className={css({
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      })}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span
                        className={css({
                          fontSize: "sm",
                          fontWeight: "medium",
                          whiteSpace: "nowrap",
                        })}
                      >
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div
          className={css({
            padding: isCollapsed ? "2" : "3",
            borderTop: "1px solid",
            borderColor: "gray.800",
          })}
        >
          {user && !isCollapsed && (
            <div
              className={css({
                marginBottom: "3",
                paddingX: "3",
                paddingY: "2",
              })}
            >
              <p
                className={css({
                  fontSize: "xs",
                  color: "gray.500",
                  marginBottom: "1",
                })}
              >
                ログイン中
              </p>
              <p
                className={css({
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "gray.300",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                {user.email}
              </p>
            </div>
          )}

          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "1",
            })}
          >
            <Link
              to="/change-password"
              onClick={handleNavClick}
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: isCollapsed ? "center" : "flex-start",
                gap: "3",
                padding: "3",
                borderRadius: "lg",
                textDecoration: "none",
                backgroundColor:
                  currentPath === "/change-password"
                    ? "primary.600"
                    : "transparent",
                color:
                  currentPath === "/change-password" ? "white" : "gray.400",
                transition: "all 0.15s ease",
                _hover: {
                  backgroundColor:
                    currentPath === "/change-password"
                      ? "primary.600"
                      : "gray.800",
                  color: "white",
                },
              })}
              title={isCollapsed ? "パスワード変更" : undefined}
            >
              <IconKey size={20} />
              {!isCollapsed && (
                <span
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                  })}
                >
                  パスワード変更
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: isCollapsed ? "center" : "flex-start",
                gap: "3",
                padding: "3",
                borderRadius: "lg",
                width: "100%",
                border: "none",
                backgroundColor: "transparent",
                color: "gray.400",
                cursor: "pointer",
                transition: "all 0.15s ease",
                _hover: {
                  backgroundColor: "red.600",
                  color: "white",
                },
              })}
              title={isCollapsed ? "ログアウト" : undefined}
            >
              <IconLogout size={20} />
              {!isCollapsed && (
                <span
                  className={css({
                    fontSize: "sm",
                    fontWeight: "medium",
                  })}
                >
                  ログアウト
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
