import React, { useCallback, useEffect, useState } from "react";
import { Button, makeStyles, tokens } from "@fluentui/react-components";
import {
  Dismiss20Regular,
  Square20Regular,
  SquareMultiple20Regular,
  Subtract20Regular,
} from "@fluentui/react-icons";
import { TITLE_BAR_HEIGHT } from "../types";

const useStyles = makeStyles({
  titleBar: {
    height: `${TITLE_BAR_HEIGHT}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    userSelect: "none",
    paddingLeft: "12px",
    paddingRight: 0,
    boxSizing: "border-box",
    flexShrink: 0,
    zIndex: 100,
  },
  leftSection: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexGrow: 1,
    overflow: "hidden",
  },
  appTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
    whiteSpace: "nowrap",
  },
  viewTitle: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  windowControls: {
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
  controlButton: {
    minWidth: "46px",
    height: "100%",
    borderRadius: 0,
    border: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  closeButton: {
    minWidth: "46px",
    height: "100%",
    borderRadius: 0,
    border: "none",
    ":hover": {
      backgroundColor: tokens.colorStatusDangerBackground3,
      color: "#FFFFFF",
    },
  },
});

interface TitleBarAdapterProps {
  title?: string;
  viewName?: string;
}

export const TitleBarAdapter: React.FC<TitleBarAdapterProps> = ({
  title = "Prime Shell",
  viewName,
}) => {
  const styles = useStyles();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function checkMaximized() {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
      ) {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const win = getCurrentWindow();
          setIsMaximized(await win.isMaximized());
          unlisten = await win.onResized(async () => {
            setIsMaximized(await win.isMaximized());
          });
        } catch {
          // ignore outside Tauri
        }
      }
    }

    checkMaximized();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch {
      // ignore outside Tauri
    }
  }, []);

  const handleMaximizeToggle = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch {
      // ignore outside Tauri
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch {
      // ignore outside Tauri
    }
  }, []);

  return (
    <header
      data-tauri-drag-region
      className={styles.titleBar}
      aria-label="Application Title Bar"
    >
      <div data-tauri-drag-region className={styles.leftSection}>
        <span data-tauri-drag-region className={styles.appTitle}>
          {title}
        </span>
        {viewName && (
          <>
            <span data-tauri-drag-region style={{ color: tokens.colorNeutralStroke1 }}>
              /
            </span>
            <span data-tauri-drag-region className={styles.viewTitle}>
              {viewName}
            </span>
          </>
        )}
      </div>

      <div className={styles.windowControls} role="toolbar" aria-label="Window Controls">
        <Button
          appearance="subtle"
          className={styles.controlButton}
          icon={<Subtract20Regular />}
          onClick={handleMinimize}
          aria-label="Minimize Window"
          title="Minimize"
        />

        <Button
          appearance="subtle"
          className={styles.controlButton}
          icon={isMaximized ? <SquareMultiple20Regular /> : <Square20Regular />}
          onClick={handleMaximizeToggle}
          aria-label={isMaximized ? "Restore Window" : "Maximize Window"}
          title={isMaximized ? "Restore" : "Maximize"}
        />

        <Button
          appearance="subtle"
          className={styles.closeButton}
          icon={<Dismiss20Regular />}
          onClick={handleClose}
          aria-label="Close Window"
          title="Close"
        />
      </div>
    </header>
  );
};
