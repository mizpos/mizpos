import type { ReactNode } from "react";
import { css } from "styled-system/css";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "データがありません",
}: TableProps<T>) {
  return (
    <div
      className={css({
        backgroundColor: "white",
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "gray.200",
        overflow: "hidden",
      })}
    >
      <div
        className={css({
          overflowX: "auto",
        })}
      >
        <table
          className={css({
            width: "100%",
            borderCollapse: "collapse",
          })}
        >
          <thead>
            <tr
              className={css({
                backgroundColor: "gray.50",
                borderBottom: "1px solid",
                borderColor: "gray.200",
              })}
            >
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={css({
                    padding: "3",
                    textAlign: "left",
                    fontSize: "xs",
                    fontWeight: "semibold",
                    color: "gray.600",
                    textTransform: "uppercase",
                    letterSpacing: "wide",
                  })}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={css({
                    padding: "8",
                    textAlign: "center",
                    color: "gray.500",
                    fontSize: "sm",
                  })}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={css({
                    borderBottom: "1px solid",
                    borderColor: "gray.100",
                    _hover: {
                      backgroundColor: "gray.50",
                    },
                  })}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={css({
                        padding: "3",
                        fontSize: "sm",
                        color: "gray.900",
                      })}
                    >
                      {column.render
                        ? column.render(item)
                        : String(
                            (item as Record<string, unknown>)[column.key] ?? "",
                          )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
