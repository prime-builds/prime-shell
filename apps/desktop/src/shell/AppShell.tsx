import React, { useEffect } from "react";
import { makeStyles, tokens, Text, Badge } from "@fluentui/react-components";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TitleBarAdapter } from "./layout/TitleBarAdapter";
import { NavigationRail } from "./layout/NavigationRail";
import { ContextSidebar } from "./layout/ContextSidebar";
import { WorkspaceHost } from "./layout/WorkspaceHost";
import { InspectorHost } from "./layout/InspectorHost";
import { BottomPanelHost } from "./layout/BottomPanelHost";
import { StatusBar } from "./layout/StatusBar";
import { Splitter } from "./layout/Splitter";
import { ToastRegion } from "./layout/ToastRegion";
import { useShellStore } from "./state/useShellStore";
import {
  BOTTOM_PANEL_MAX_RATIO,
  BOTTOM_PANEL_MIN_HEIGHT,
  BOTTOM_PANEL_MIN_RATIO,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  STATUS_BAR_HEIGHT,
  TITLE_BAR_HEIGHT,
} from "./types";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    boxSizing: "border-box",
  },
  body: {
    display: "flex",
    flexGrow: 1,
    minHeight: 0,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  centerContainer: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    position: "relative",
  },
  panelPlaceholder: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

export const AppShell: React.FC = () => {
  const styles = useStyles();
  const navigate = useNavigate();
  const location = useLocation();

  // Store state and actions
  const band = useShellStore((s) => s.band);
  const windowHeight = useShellStore((s) => s.windowHeight);
  const sidebarWidth = useShellStore((s) => s.sidebarWidth);
  const isSidebarCollapsed = useShellStore((s) => s.isSidebarCollapsed);
  const isSidebarOverlayOpen = useShellStore((s) => s.isSidebarOverlayOpen);
  const inspectorWidth = useShellStore((s) => s.inspectorWidth);
  const isInspectorOpen = useShellStore((s) => s.isInspectorOpen);
  const isInspectorDrawerOpen = useShellStore((s) => s.isInspectorDrawerOpen);
  const bottomPanelHeightRatio = useShellStore((s) => s.bottomPanelHeightRatio);
  const isBottomPanelOpen = useShellStore((s) => s.isBottomPanelOpen);
  const activeNavId = useShellStore((s) => s.activeNavId);

  const setWindowDimensions = useShellStore((s) => s.setWindowDimensions);
  const setSidebarWidth = useShellStore((s) => s.setSidebarWidth);
  const toggleSidebar = useShellStore((s) => s.toggleSidebar);
  const setSidebarOverlayOpen = useShellStore((s) => s.setSidebarOverlayOpen);
  const setInspectorWidth = useShellStore((s) => s.setInspectorWidth);
  const toggleInspector = useShellStore((s) => s.toggleInspector);
  const setInspectorDrawerOpen = useShellStore((s) => s.setInspectorDrawerOpen);
  const setBottomPanelHeightRatio = useShellStore((s) => s.setBottomPanelHeightRatio);
  const toggleBottomPanel = useShellStore((s) => s.toggleBottomPanel);
  const setActiveNavId = useShellStore((s) => s.setActiveNavId);
  const loadPreferences = useShellStore((s) => s.loadPreferences);

  // Load persisted preferences on mount
  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  // Sync window dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setWindowDimensions]);

  // Sync activeNavId with current route path
  useEffect(() => {
    if (location.pathname === "/settings") {
      setActiveNavId("settings");
    } else if (location.pathname === "/analysis") {
      setActiveNavId("analysis");
    } else {
      setActiveNavId("workspace");
    }
  }, [location.pathname, setActiveNavId]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when inside input/textarea/editable
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Ctrl+B: Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
      }

      // Ctrl+J: Toggle Bottom Panel
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        toggleBottomPanel();
      }

      // Ctrl+Alt+I: Toggle Inspector
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggleInspector();
      }

      // Ctrl+,: Open Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setActiveNavId("settings");
        navigate("/settings");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, setActiveNavId, toggleBottomPanel, toggleInspector, toggleSidebar]);

  const handleNavigate = (id: string, path: string) => {
    setActiveNavId(id);
    navigate(path);
  };

  // Calculate pixel height for bottom panel
  const availableCenterHeight =
    windowHeight - TITLE_BAR_HEIGHT - STATUS_BAR_HEIGHT;
  const bottomPanelPx = Math.max(
    BOTTOM_PANEL_MIN_HEIGHT,
    Math.round(availableCenterHeight * bottomPanelHeightRatio),
  );

  const viewName =
    location.pathname === "/settings"
      ? "Settings"
      : location.pathname === "/analysis"
        ? "Document Analysis"
        : "Workspace";

  return (
    <div className={styles.root} data-testid="prime-app-shell">
      {/* 1. Title Bar */}
      <TitleBarAdapter title="Prime Shell Desktop" viewName={viewName} />

      {/* 2. Main Shell Body */}
      <div className={styles.body}>
        {/* Navigation Rail (48px fixed) */}
        <NavigationRail
          activeId={activeNavId}
          onNavigate={handleNavigate}
          onToggleSidebar={toggleSidebar}
        />

        {/* Context Sidebar */}
        <ContextSidebar
          width={sidebarWidth}
          isCollapsed={isSidebarCollapsed}
          isOverlayOpen={isSidebarOverlayOpen}
          band={band}
          onCloseOverlay={() => setSidebarOverlayOpen(false)}
          onToggleCollapse={toggleSidebar}
        >
          <div className={styles.panelPlaceholder}>
            <Text weight="semibold" size={200}>
              EXPLORER
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Project workspace files and resources.
            </Text>
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <Badge appearance="tint" color="brand" style={{ alignSelf: "flex-start" }}>
                Active Project
              </Badge>
              <Text size={200}>📁 src/shell/layout</Text>
              <Text size={200}>📁 src/shell/views</Text>
              <Text size={200}>📁 src-tauri/src</Text>
            </div>
          </div>
        </ContextSidebar>

        {/* Vertical Splitter between Sidebar and Center (when sidebar is docked and not collapsed) */}
        {band !== "compact" && !isSidebarCollapsed && (
          <Splitter
            orientation="vertical"
            currentValue={sidebarWidth}
            minValue={SIDEBAR_MIN_WIDTH}
            maxValue={SIDEBAR_MAX_WIDTH}
            label="Context Sidebar Width"
            onChange={setSidebarWidth}
            onToggleCollapse={toggleSidebar}
          />
        )}

        {/* Center Workspace & Bottom Panel Container */}
        <div className={styles.centerContainer}>
          <WorkspaceHost>
            <Outlet />
          </WorkspaceHost>

          {/* Horizontal Splitter between Workspace and Bottom Panel */}
          {isBottomPanelOpen && (
            <Splitter
              orientation="horizontal"
              currentValue={bottomPanelPx}
              minValue={Math.round(availableCenterHeight * BOTTOM_PANEL_MIN_RATIO)}
              maxValue={Math.round(availableCenterHeight * BOTTOM_PANEL_MAX_RATIO)}
              label="Bottom Panel Height"
              inverted={true}
              onChange={(newPx) => {
                const newRatio = newPx / availableCenterHeight;
                setBottomPanelHeightRatio(newRatio);
              }}
              onToggleCollapse={toggleBottomPanel}
            />
          )}

          {/* Bottom Panel */}
          <BottomPanelHost
            height={bottomPanelPx}
            isOpen={isBottomPanelOpen}
            onToggleOpen={toggleBottomPanel}
          >
            <div className={styles.panelPlaceholder}>
              <Text weight="semibold" size={200}>
                TASKS &amp; LOGS
              </Text>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Background task execution logs and system output stream.
              </Text>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "12px",
                  padding: "8px",
                  backgroundColor: tokens.colorNeutralBackground3,
                  borderRadius: "4px",
                  marginTop: "8px",
                }}
              >
                [system] Responsive Application Shell initialized. Band: {band}.
              </div>
            </div>
          </BottomPanelHost>
        </div>

        {/* Vertical Splitter between Center and Inspector (when inspector is docked and open in desktop/wide bands) */}
        {(band === "wide" || band === "desktop") && isInspectorOpen && (
          <Splitter
            orientation="vertical"
            currentValue={inspectorWidth}
            minValue={INSPECTOR_MIN_WIDTH}
            maxValue={INSPECTOR_MAX_WIDTH}
            label="Inspector Width"
            inverted={true}
            onChange={setInspectorWidth}
            onToggleCollapse={toggleInspector}
          />
        )}

        {/* Inspector Panel */}
        <InspectorHost
          width={inspectorWidth}
          isOpen={isInspectorOpen}
          isDrawerOpen={isInspectorDrawerOpen}
          band={band}
          onCloseDrawer={() => setInspectorDrawerOpen(false)}
          onToggleOpen={toggleInspector}
        >
          <div className={styles.panelPlaceholder}>
            <Text weight="semibold" size={200}>
              PROPERTIES
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Contextual properties for selected workspace item.
            </Text>
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <Text size={200} weight="semibold">Shell Mode:</Text>
                <Text size={200} style={{ display: "block" }}>{band.toUpperCase()} Viewport</Text>
              </div>
              <div>
                <Text size={200} weight="semibold">Inspector Width:</Text>
                <Text size={200} style={{ display: "block" }}>{inspectorWidth}px</Text>
              </div>
            </div>
          </div>
        </InspectorHost>
      </div>

      {/* 3. Status Bar */}
      <StatusBar backendReady={true} />

      {/* 4. Global Toast Notifications */}
      <ToastRegion />
    </div>
  );
};
