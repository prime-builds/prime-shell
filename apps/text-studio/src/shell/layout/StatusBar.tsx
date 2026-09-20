import React from "react";
import { Button, makeStyles, tokens } from "@fluentui/react-components";
import {
  CheckmarkCircle16Regular,
  ChevronDown16Regular,
  ChevronUp16Regular,
  DismissCircle16Regular,
  Save16Regular,
} from "@fluentui/react-icons";
import { STATUS_BAR_HEIGHT } from "../types";
import { useShellStore } from "../state/useShellStore";

const useStyles = makeStyles({
  statusBar: {
    height: `${STATUS_BAR_HEIGHT}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground3,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingLeft: "12px",
    paddingRight: "12px",
    boxSizing: "border-box",
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    userSelect: "none",
    flexShrink: 0,
    zIndex: 30,
  },
  section: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  panelToggle: {
    height: "22px",
    padding: "0 6px",
    fontSize: tokens.fontSizeBase100,
  },
  bandButton: {
    height: "22px",
    padding: "0 6px",
    fontSize: tokens.fontSizeBase100,
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  bandLabel: {
    fontWeight: tokens.fontWeightSemibold,
  },
  resolutionLabel: {
    color: tokens.colorNeutralForeground4,
  },
});

interface StatusBarProps {
  backendReady?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({ backendReady = true }) => {
  const styles = useStyles();
  const band = useShellStore((s) => s.band);
  const windowWidth = useShellStore((s) => s.windowWidth);
  const windowHeight = useShellStore((s) => s.windowHeight);
  const isSaving = useShellStore((s) => s.isSaving);
  const isBottomPanelOpen = useShellStore((s) => s.isBottomPanelOpen);
  const toggleBottomPanel = useShellStore((s) => s.toggleBottomPanel);

  return (
    <footer className={styles.statusBar} aria-label="Status Bar">
      <div className={styles.section}>
        <div className={styles.statusItem} role="status">
          {backendReady ? (
            <>
              <CheckmarkCircle16Regular style={{ color: tokens.colorStatusSuccessForeground1 }} />
              <span>Backend Ready</span>
            </>
          ) : (
            <>
              <DismissCircle16Regular style={{ color: tokens.colorStatusDangerForeground1 }} />
              <span>Backend Offline</span>
            </>
          )}
        </div>

        {isSaving && (
          <div className={styles.statusItem} aria-live="polite">
            <Save16Regular style={{ color: tokens.colorCompoundBrandForeground1 }} />
            <span>Saving layout...</span>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <Button
          appearance="subtle"
          className={styles.bandButton}
          aria-label={`Current Band: ${band}. Viewport: ${windowWidth} by ${windowHeight}`}
          title="Current Responsive Band and Viewport Dimensions"
        >
          <span className={styles.bandLabel}>{band.toUpperCase()}</span>
          <span className={styles.resolutionLabel}>
            ({windowWidth}&times;{windowHeight})
          </span>
        </Button>

        <Button
          appearance="subtle"
          className={styles.panelToggle}
          icon={isBottomPanelOpen ? <ChevronDown16Regular /> : <ChevronUp16Regular />}
          onClick={toggleBottomPanel}
          aria-label={isBottomPanelOpen ? "Hide Output Panel" : "Show Output Panel"}
        >
          Output
        </Button>
      </div>
    </footer>
  );
};
