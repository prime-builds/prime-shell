import React, { useEffect, useRef } from "react";
import { Button, makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { Dismiss20Regular, PanelLeftContract20Regular } from "@fluentui/react-icons";
import type { ResponsiveBand } from "../types";

const useStyles = makeStyles({
  sidebar: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    height: "100%",
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
    transition: "width 0.15s cubic-bezier(0, 0, 0, 1)",
  },
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "48px", // after NavigationRail
    zIndex: 50,
    boxShadow: tokens.shadow16,
    borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "48px",
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

interface ContextSidebarProps {
  width: number;
  isCollapsed: boolean;
  isOverlayOpen: boolean;
  band: ResponsiveBand;
  onCloseOverlay: () => void;
  onToggleCollapse: () => void;
  children?: React.ReactNode;
}

export const ContextSidebar: React.FC<ContextSidebarProps> = ({
  width,
  isCollapsed,
  isOverlayOpen,
  band,
  onCloseOverlay,
  onToggleCollapse,
  children,
}) => {
  const styles = useStyles();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: when opened as an overlay, move focus into the sidebar
  useEffect(() => {
    if (band === "compact" && isOverlayOpen) {
      closeButtonRef.current?.focus();
    }
  }, [band, isOverlayOpen]);

  // Handle Escape key to close overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOverlayOpen && band === "compact") {
        onCloseOverlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [band, isOverlayOpen, onCloseOverlay]);

  // If compact and not overlay open, don't render
  if (band === "compact" && !isOverlayOpen) {
    return null;
  }

  // If docked and collapsed, don't render (or render 0 width)
  if (band !== "compact" && isCollapsed) {
    return null;
  }

  const isOverlay = band === "compact" && isOverlayOpen;

  return (
    <>
      {isOverlay && (
        <div
          className={styles.backdrop}
          onClick={onCloseOverlay}
          aria-hidden="true"
        />
      )}
      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${isOverlay ? styles.overlay : ""}`}
        style={{ width: `${width}px` }}
        aria-label="Context Sidebar"
      >
        <div className={styles.header}>
          <span className={styles.headerTitle}>Context Sidebar</span>
          {isOverlay ? (
            <Button
              ref={closeButtonRef}
              appearance="subtle"
              icon={<Dismiss20Regular />}
              onClick={onCloseOverlay}
              aria-label="Close Context Sidebar"
              title="Close Sidebar"
            />
          ) : (
            <Button
              appearance="subtle"
              icon={<PanelLeftContract20Regular />}
              onClick={onToggleCollapse}
              aria-label="Collapse Context Sidebar"
              title="Collapse Sidebar"
            />
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </aside>
    </>
  );
};
