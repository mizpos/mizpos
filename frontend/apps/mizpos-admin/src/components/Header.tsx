import { IconBell, IconUser } from "@tabler/icons-react";
import { css } from "styled-system/css";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header
      className={css({
        height: "16",
        backgroundColor: "white",
        borderBottom: "1px solid",
        borderColor: "gray.200",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingX: "6",
      })}
    >
      <h2
        className={css({
          fontSize: "lg",
          fontWeight: "semibold",
          color: "gray.900",
        })}
      >
        {title}
      </h2>

      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "4",
        })}
      >
        <button
          type="button"
          className={css({
            padding: "2",
            borderRadius: "full",
            color: "gray.500",
            transition: "colors 0.2s",
            _hover: {
              backgroundColor: "gray.100",
              color: "gray.700",
            },
          })}
        >
          <IconBell size={20} />
        </button>

        <button
          type="button"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "2",
            padding: "2",
            borderRadius: "full",
            color: "gray.500",
            transition: "colors 0.2s",
            _hover: {
              backgroundColor: "gray.100",
              color: "gray.700",
            },
          })}
        >
          <IconUser size={20} />
        </button>
      </div>
    </header>
  );
}
