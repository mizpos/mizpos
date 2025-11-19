import { IconBell, IconUser } from "@tabler/icons-react";
import { css } from "styled-system/css";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header
      className={css({
        height: { base: "14", md: "16" },
        backgroundColor: "white",
        borderBottom: "1px solid",
        borderColor: "gray.200",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingX: { base: "3", sm: "4", md: "6" },
      })}
    >
      <h2
        className={css({
          fontSize: { base: "md", md: "lg" },
          fontWeight: "semibold",
          color: "gray.900",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: { base: "nowrap", md: "normal" },
        })}
      >
        {title}
      </h2>

      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: { base: "2", md: "4" },
        })}
      >
        <button
          type="button"
          className={css({
            padding: { base: "1.5", md: "2" },
            borderRadius: "full",
            color: "gray.500",
            transition: "colors 0.2s",
            _hover: {
              backgroundColor: "gray.100",
              color: "gray.700",
            },
          })}
          aria-label="通知"
        >
          <IconBell size={20} />
        </button>

        <button
          type="button"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "2",
            padding: { base: "1.5", md: "2" },
            borderRadius: "full",
            color: "gray.500",
            transition: "colors 0.2s",
            _hover: {
              backgroundColor: "gray.100",
              color: "gray.700",
            },
          })}
          aria-label="ユーザー"
        >
          <IconUser size={20} />
        </button>
      </div>
    </header>
  );
}
