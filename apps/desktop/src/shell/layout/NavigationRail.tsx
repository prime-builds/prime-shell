import React from "react";
import { Button, makeStyles, mergeClasses, tokens, Tooltip } from "@fluentui/react-components";
import {
  AppFolder24Filled,
  AppFolder24Regular,
  DarkTheme24Regular,
  PanelLeftExpand20Regular,
  Search24Regular,
  Settings24Filled,
  Settings24Regular,
} from "@fluentui/react-icons";
import { RAIL_WIDTH } from "../types";
import { useThemeController } from "../../theme/ThemeContext";
import { featureRegistry } from "../../features";

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
  onOpenCommandPalette?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({
  activeId,
  onNavigate,
  onToggleSidebar,
  onOpenCommandPalette,
}) => {
  const styles = useStyles();
  const { themeMode, setThemeMode } = useThemeController();
  const featureNavItems = featureRegistry.getNavigationItems();

  const handleCycleTheme = () => {
    if (themeMode === "system") setThemeMode("light");
    else if (themeMode === "light") setThemeMode("dark");
    else setThemeMode("system");
  };

  return (
    <nav className={styles.rail} aria-label="Main Navigation">
      <div className={styles.section}>
        {onToggleSidebar && (
          <Tooltip content="Toggle Sidebar (Ctrl+B)" relationship="label" positioning="after">
            <Button
              appearance="subtle"
              className={styles.railButton}
              icon={<PanelLeftExpand20Regular />}
              onClick={onToggleSidebar}
              aria-label="Toggle Sidebar"
            />
          </Tooltip>
        )}

        {/* Workspace Root */}
        <Tooltip content="Workspace" relationship="label" positioning="after">
          <Button
            appearance="subtle"
            className={mergeClasses(styles.railButton, activeId === "workspace" && styles.activeButton)}
            icon={activeId === "workspace" ? <AppFolder24Filled /> : <AppFolder24Regular />}
            onClick={() => onNavigate("workspace", "/")}
            aria-label="Workspace"
            aria-current={activeId === "workspace" ? "page" : undefined}
            data-testid="nav-workspace-btn"
          />
        </Tooltip>

        {/* Dynamic Feature Navigation Items */}
        {featureNavItems.map((item) => {
          const isActive = activeId === item.id;
          const IconComponent = isActive ? item.iconFilled : item.iconRegular;
          return (
            <Tooltip key={item.id} content={item.label} relationship="label" positioning="after">
              <Button
                appearance="subtle"
                className={mergeClasses(styles.railButton, isActive && styles.activeButton)}
                icon={<IconComponent />}
                onClick={() => onNavigate(item.id, item.path)}
                aria-label={item.ariaLabel || item.label}
                aria-current={isActive ? "page" : undefined}
                data-testid={`nav-${item.id}-btn`}
              />
            </Tooltip>
          );
        })}

        {/* Settings */}
        <Tooltip content="Settings (Ctrl+,)" relationship="label" positioning="after">
          <Button
            appearance="subtle"
            className={mergeClasses(styles.railButton, activeId === "settings" && styles.activeButton)}
            icon={activeId === "settings" ? <Settings24Filled /> : <Settings24Regular />}
            onClick={() => onNavigate("settings", "/settings")}
            aria-label="Settings"
            aria-current={activeId === "settings" ? "page" : undefined}
            data-testid="nav-settings-btn"
          />
        </Tooltip>
      </div>

      <div className={styles.section}>
        {onOpenCommandPalette && (
          <Tooltip content="Command Palette (Ctrl+K)" relationship="label" positioning="after">
            <Button
              appearance="subtle"
              className={styles.railButton}
              icon={<Search24Regular />}
              onClick={onOpenCommandPalette}
              aria-label="Open Command Palette"
              data-testid="nav-command-palette-btn"
            />
          </Tooltip>
        )}

        <Tooltip content={`Theme: ${themeMode} (click to cycle)`} relationship="label" positioning="after">
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

