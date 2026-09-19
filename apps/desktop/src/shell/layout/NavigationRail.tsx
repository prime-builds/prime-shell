import React from "react";
import { Button, makeStyles, tokens, Tooltip } from "@fluentui/react-components";
import {
  AppFolder24Filled,
  AppFolder24Regular,
  DarkTheme24Regular,
  DocumentSearch24Filled,
  DocumentSearch24Regular,
  PanelLeftExpand20Regular,
  Settings24Filled,
  Settings24Regular,
} from "@fluentui/react-icons";
import { RAIL_WIDTH } from "../types";
import { useThemeController } from "../../theme/ThemeContext";

const useStyles = makeStyles({
  rail: {
    width: `${RAIL_WIDTH}px`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground3,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingTop: "8px",
    paddingBottom: "8px",
    boxSizing: "border-box",
    flexShrink: 0,
    zIndex: 20,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    width: "100%",
  },
  railButton: {
    minWidth: "40px",
    width: "40px",
    height: "40px",
    borderRadius: tokens.borderRadiusMedium,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  activeButton: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    color: tokens.colorCompoundBrandForeground1,
    "::before": {
      content: '""',
      position: "absolute",
      left: 0,
      width: "3px",
      height: "20px",
      backgroundColor: tokens.colorCompoundBrandStroke,
      borderRadius: "0 2px 2px 0",
    },
  },
});

interface NavigationRailProps {
  activeId: string;
  onNavigate: (id: string, path: string) => void;
  onToggleSidebar?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeId,
  onNavigate,
  onToggleSidebar,
}) => {
  const styles = useStyles();
  const { themeMode, setThemeMode } = useThemeController();

  const handleCycleTheme = () => {
    if (themeMode === "system") setThemeMode("light");
    else if (themeMode === "light") setThemeMode("dark");
    else setThemeMode("system");
  };

  return (
    <nav className={styles.rail} aria-label="Main Navigation">
      <div className={styles.section}>
        {onToggleSidebar && (
          <Tooltip content="Toggle Sidebar (Ctrl+B)" relationship="label">
            <Button
              appearance="subtle"
              className={styles.railButton}
              icon={<PanelLeftExpand20Regular />}
              onClick={onToggleSidebar}
              aria-label="Toggle Sidebar"
            />
          </Tooltip>
        )}

        <Tooltip content="Document Analysis" relationship="label">
          <Button
            appearance="subtle"
            className={`${styles.railButton} ${activeId === "analysis" ? styles.activeButton : ""}`}
            icon={activeId === "analysis" ? <DocumentSearch24Filled /> : <DocumentSearch24Regular />}
            onClick={() => onNavigate("analysis", "/analysis")}
            aria-label="Document Analysis"
            aria-current={activeId === "analysis" ? "page" : undefined}
            data-testid="nav-analysis-btn"
          />
        </Tooltip>

        <Tooltip content="Workspace" relationship="label">
          <Button
            appearance="subtle"
            className={`${styles.railButton} ${activeId === "workspace" ? styles.activeButton : ""}`}
            icon={activeId === "workspace" ? <AppFolder24Filled /> : <AppFolder24Regular />}
            onClick={() => onNavigate("workspace", "/")}
            aria-label="Workspace"
            aria-current={activeId === "workspace" ? "page" : undefined}
            data-testid="nav-workspace-btn"
          />
        </Tooltip>

        <Tooltip content="Settings" relationship="label">
          <Button
            appearance="subtle"
            className={`${styles.railButton} ${activeId === "settings" ? styles.activeButton : ""}`}
            icon={activeId === "settings" ? <Settings24Filled /> : <Settings24Regular />}
            onClick={() => onNavigate("settings", "/settings")}
            aria-label="Settings"
            aria-current={activeId === "settings" ? "page" : undefined}
            data-testid="nav-settings-btn"
          />
        </Tooltip>
      </div>

      <div className={styles.section}>
        <Tooltip content={`Theme: ${themeMode} (click to cycle)`} relationship="label">
          <Button
            appearance="subtle"
            className={styles.railButton}
            icon={<DarkTheme24Regular />}
            onClick={handleCycleTheme}
            aria-label={`Current Theme: ${themeMode}. Click to cycle.`}
          />
        </Tooltip>
      </div>
    </nav>
  );
};
