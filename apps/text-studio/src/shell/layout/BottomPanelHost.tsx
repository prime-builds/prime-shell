import React from "react";
import { Button, makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import {
  ChevronDown20Regular,
  ChevronUp20Regular,
  TaskListSquareDatabase20Regular,
} from "@fluentui/react-icons";
import { BOTTOM_PANEL_MIN_HEIGHT } from "../types";

const useStyles = makeStyles({
  panel: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    width: "100%",
    boxSizing: "border-box",
    flexShrink: 0,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 12px",
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    padding: "12px",
  },
});

interface BottomPanelHostProps {
  height: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  children?: React.ReactNode;
}

export const BottomPanelHost: React.FC<BottomPanelHostProps> = ({
  height,
  isOpen,
  onToggleOpen,
  children,
}) => {
  const styles = useStyles();

  if (!isOpen) {
    return null;
  }

  const effectiveHeight = Math.max(BOTTOM_PANEL_MIN_HEIGHT, height);

  return (
    <section
      className={styles.panel}
      style={{ height: `${effectiveHeight}px` }}
      aria-label="Bottom Task and Output Panel"
    >
      <div className={styles.header}>
        <div className={styles.leftSection}>
          <TaskListSquareDatabase20Regular style={{ color: tokens.colorCompoundBrandForeground1 }} />
          <span className={styles.headerTitle}>Tasks &amp; Output</span>
        </div>
        <Tooltip content={isOpen ? "Collapse Panel" : "Expand Panel"} relationship="label">
          <Button
            appearance="subtle"
            icon={isOpen ? <ChevronDown20Regular /> : <ChevronUp20Regular />}
            onClick={onToggleOpen}
            aria-label={isOpen ? "Collapse Bottom Panel" : "Expand Bottom Panel"}
          />
        </Tooltip>
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
};
