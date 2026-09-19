import React, { useEffect, useRef } from "react";
import { Button, makeStyles, tokens, Tooltip } from "@fluentui/react-components";
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
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 49,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
    padding: "12px",
  },
});

interface InspectorHostProps {
  width: number;
  isOpen: boolean;
  isDrawerOpen: boolean;
  band: ResponsiveBand;
  onCloseDrawer: () => void;
  onToggleOpen: () => void;
  children?: React.ReactNode;
}

export const InspectorHost: React.FC<InspectorHostProps> = ({
  width,
  isOpen,
  isDrawerOpen,
  band,
  onCloseDrawer,
  onToggleOpen,
  children,
}) => {
  const styles = useStyles();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isDrawerMode = band === "compact" || band === "tablet";

  // Focus management: when opened as a drawer, move focus into the close button
  useEffect(() => {
    if (isDrawerMode && isDrawerOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isDrawerMode, isDrawerOpen]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawerMode && isDrawerOpen) {
        onCloseDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerMode, isDrawerOpen, onCloseDrawer]);

  // If in drawer mode and not open, don't render
  if (isDrawerMode && !isDrawerOpen) {
    return null;
  }

  // If in docked mode and not open, don't render
  if (!isDrawerMode && !isOpen) {
    return null;
  }

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
        className={`${styles.inspector} ${isDrawerMode ? styles.drawer : ""}`}
        style={{ width: `${width}px` }}
        aria-label="Inspector Panel"
      >
        <div className={styles.header}>
          <span className={styles.headerTitle}>Inspector</span>
          {isDrawerMode ? (
            <Tooltip content="Close Inspector" relationship="label">
              <Button
                ref={closeButtonRef}
                appearance="subtle"
                icon={<Dismiss20Regular />}
                onClick={onCloseDrawer}
                aria-label="Close Inspector"
              />
            </Tooltip>
          ) : (
            <Tooltip content="Collapse Inspector" relationship="label">
              <Button
                appearance="subtle"
                icon={<PanelRightContract20Regular />}
                onClick={onToggleOpen}
                aria-label="Collapse Inspector"
              />
            </Tooltip>
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </section>
    </>
  );
};
