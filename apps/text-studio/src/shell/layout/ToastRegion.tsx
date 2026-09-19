import React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  toastRegion: {
    position: "fixed",
    bottom: "36px",
    right: "16px",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    pointerEvents: "none",
  },
  toastItem: {
    pointerEvents: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: "10px 14px",
    boxShadow: tokens.shadow8,
    fontSize: tokens.fontSizeBase200,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

export interface ToastMessage {
  id: string;
  text: string;
  type?: "info" | "success" | "warning" | "error";
}

interface ToastRegionProps {
  toasts?: ToastMessage[];
}

export const ToastRegion: React.FC<ToastRegionProps> = ({ toasts = [] }) => {
  const styles = useStyles();

  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.toastRegion}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={styles.toastItem}>
          <span>{toast.text}</span>
        </div>
      ))}
    </div>
  );
};
