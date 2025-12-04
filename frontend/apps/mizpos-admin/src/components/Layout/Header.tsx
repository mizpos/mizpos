import { IconMenu2 } from "@tabler/icons-react";
import { css } from "styled-system/css";
import { useLayout } from "./context";

export function Header() {
  const { pageTitle, isMobile, toggleSidebar, isSidebarCollapsed } =
    useLayout();

  return (
    <header
      className={css({
        position: "sticky",
        top: 0,
        height: "header",
        backgroundColor: "white",
        borderBottom: "1px solid",
        borderColor: "gray.200",
        display: "flex",
        alignItems: "center",
        paddingX: { base: "4", md: "6" },
        gap: "4",
        zIndex: "header",
      })}
    >
      {/* Mobile menu button */}
      {isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2",
            borderRadius: "lg",
            border: "none",
            backgroundColor: "transparent",
            color: "gray.600",
            cursor: "pointer",
            transition: "all 0.15s ease",
            _hover: {
              backgroundColor: "gray.100",
              color: "gray.900",
            },
          })}
          aria-label="メニューを開く"
        >
          <IconMenu2 size={24} />
        </button>
      )}

      {/* Page title */}
      <h1
        className={css({
          fontSize: { base: "lg", md: "xl" },
          fontWeight: "semibold",
          color: "gray.900",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: "1",
        })}
      >
        {pageTitle}
      </h1>

      {/* Desktop: Show collapsed state indicator */}
      {!isMobile && isSidebarCollapsed && (
        <span
          className={css({
            fontSize: "sm",
            color: "gray.500",
            display: { base: "none", lg: "inline" },
          })}
        >
          版元管理センター
        </span>
      )}
    </header>
  );
}
