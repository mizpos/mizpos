import { useCallback, useEffect, useRef } from "react";
import { css } from "styled-system/css";

const overlayStyles = css({
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.8)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  animation: "fadeIn 0.15s ease-out",
});

const contentStyles = css({
  background: "#1e293b",
  borderRadius: "16px",
  width: "100%",
  maxHeight: "90vh",
  overflow: "auto",
  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  color: "#f8fafc",
  animation: "slideUp 0.2s ease-out",
});

const headerStyles = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "20px 24px",
  borderBottom: "1px solid #334155",
});

const titleStyles = css({
  margin: 0,
  fontSize: "20px",
  fontWeight: 700,
});

const closeButtonStyles = css({
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#334155",
  border: "none",
  borderRadius: "8px",
  color: "#94a3b8",
  fontSize: "20px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  _hover: { background: "#475569", color: "#f8fafc" },
  _disabled: { cursor: "not-allowed", opacity: 0.5 },
});

const bodyStyles = css({
  padding: "24px",
});

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  disableClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "480px",
  disableClose = false,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disableClose) {
        onClose();
      }
    },
    [onClose, disableClose],
  );

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !disableClose) {
        onClose();
      }
    },
    [onClose, disableClose],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className={overlayStyles} onClick={handleOverlayClick}>
      <div
        ref={contentRef}
        className={contentStyles}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={headerStyles}>
          <h2 className={titleStyles}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            className={closeButtonStyles}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className={bodyStyles}>{children}</div>
      </div>
    </div>
  );
}
