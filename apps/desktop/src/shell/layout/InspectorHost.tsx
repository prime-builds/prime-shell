import React, { useEffect, useRef } from "react";
import { Button, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { Dismiss20Regular, PanelRightContract20Regular } from "@fluentui/react-icons";
import type { ResponsiveBand } from "../types";

const useStyles = makeStyles({
  inspector: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    height: "100%",
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
    transition: "width 0.15s cubic-bezier(0, 0, 0, 1)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 50,
    boxShadow: tokens.shadow16,
    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    height: "40px",
    boxSizing: "border-box",
    flexShrink: 0,
  },
  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "16px",
    boxSizing: "border-box",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 40,
  },
});

interface InspectorHostProps {
  band: ResponsiveBand;
  width: number;
  isOpen: boolean;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onToggleOpen: () => void;
  children?: React.ReactNode;
}

export const InspectorHost: React.FC<InspectorHostProps> = ({
  band,
  width,
  isOpen,
  isDrawerOpen,
  onCloseDrawer,
  onToggleOpen,
  children,
}) => {
  const styles = useStyles();
  const isDrawerMode = band === "compact" || band === "tablet";
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close drawer on Escape
  useEffect(() => {
    if (!isDrawerMode || !isDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerMode, isDrawerOpen, onCloseDrawer]);

  // Trap focus to close button when drawer opens
  useEffect(() => {
    if (isDrawerMode && isDrawerOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isDrawerMode, isDrawerOpen]);

  if (isDrawerMode && !isDrawerOpen) return null;
  if (!isDrawerMode && !isOpen) return null;

  return (
    <>
      {isDrawerMode && (
        <div
          className={styles.backdrop}
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      )}
      <section
        className={mergeClasses(styles.inspector, isDrawerMode && styles.drawer)}
        style={{ width: `${width}px` }}
        aria-label="Inspector Panel"
      >
        <div className={styles.header}>
          <span className={styles.headerTitle}>Inspector</span>
          {isDrawerMode ? (
            <Button
              ref={closeButtonRef}
              appearance="subtle"
              icon={<Dismiss20Regular />}
              onClick={onCloseDrawer}
              aria-label="Close Inspector"
              title="Close Inspector"
            />
          ) : (
            <Button
              appearance="subtle"
              icon={<PanelRightContract20Regular />}
              onClick={onToggleOpen}
              aria-label="Collapse Inspector"
              title="Collapse Inspector"
            />
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </section>
    </>
  );
};
