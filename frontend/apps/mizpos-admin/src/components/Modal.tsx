import { IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { css } from "styled-system/css";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className={css({
        position: "fixed",
        inset: "0",
        zIndex: "50",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4",
      })}
    >
      {/* biome-ignore lint/a11y/useSemanticElements: ちょっと実装上厳しいので */}
      <div
        className={css({
          position: "absolute",
          inset: "0",
          backgroundColor: "black",
          opacity: "0.5",
        })}
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
      />
      <div
        className={css({
          position: "relative",
          backgroundColor: "white",
          borderRadius: "lg",
          boxShadow: "xl",
          width: "100%",
          maxWidth: "lg",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4",
            borderBottom: "1px solid",
            borderColor: "gray.200",
          })}
        >
          <h3
            className={css({
              fontSize: "lg",
              fontWeight: "semibold",
              color: "gray.900",
            })}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={css({
              padding: "1",
              borderRadius: "md",
              color: "gray.500",
              _hover: {
                backgroundColor: "gray.100",
                color: "gray.700",
              },
            })}
          >
            <IconX size={20} />
          </button>
        </div>
        <div
          className={css({
            padding: "4",
            overflowY: "auto",
            flex: "1",
          })}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
