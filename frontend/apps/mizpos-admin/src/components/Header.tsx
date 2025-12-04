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
    </header>
  );
}
