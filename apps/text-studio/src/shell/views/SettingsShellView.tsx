import React, { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  Input,
  Tab,
  TabList,
  Text,
  Title1,
  Title2,
  Title3,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowReset20Regular,
  Color20Regular,
  Desktop20Regular,
  Dismiss20Regular,
  DocumentSearch20Regular,
  Info20Regular,
  Search20Regular,
  TextQuote20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { validateCustomSeed } from "@prime-shell/design-tokens";
import { useThemeController } from "../../theme/ThemeContext";
import { useShellStore } from "../state/useShellStore";
import { useTextUtilityStore } from "../../features/text-utility/state";
import { useSettingsStore } from "../state/useSettingsStore";
import { useUpdateStore } from "../state/useUpdateStore";
import {
  BOTTOM_PANEL_MAX_RATIO,
  BOTTOM_PANEL_MIN_RATIO,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../types";

interface SearchableItem {
  id: string;
  title: string;
  description: string;
  section: "appearance" | "layout" | "text-utility";
  sectionTitle: string;
  keywords: string[];
}

const STATIC_SEARCHABLE_ITEMS: SearchableItem[] = [
  {
    id: "appearance.themeMode",
    title: "Theme Mode",
    description: "Choose between light, dark, or automatic system theme.",
    section: "appearance",
    sectionTitle: "Appearance",
    keywords: ["theme", "color", "dark", "light", "system", "mode"],
  },
  {
    id: "appearance.density",
    title: "Layout Density",
    description: "Controls the compact spacing of shell elements and controls.",
    section: "appearance",
    sectionTitle: "Appearance",
    keywords: ["density", "compact", "comfortable", "spacing", "padding"],
  },
  {
    id: "appearance.accentMode",
    title: "Accent Brand",
    description: "Configure the primary accent brand ramp or custom hex seed color.",
    section: "appearance",
    sectionTitle: "Appearance",
    keywords: ["accent", "brand", "color", "seed", "hex", "ramp"],
  },
  {
    id: "layout.sidebarWidth",
    title: "Sidebar Width",
    description: "Configures the width of the navigation and context sidebar.",
    section: "layout",
    sectionTitle: "Layout & Shell",
    keywords: ["sidebar", "width", "navigation", "pane", "panel"],
  },
  {
    id: "layout.inspectorWidth",
    title: "Inspector Width",
    description: "Configures the width of the right-hand details inspector panel.",
    section: "layout",
    sectionTitle: "Layout & Shell",
    keywords: ["inspector", "width", "details", "pane", "panel"],
  },
  {
    id: "layout.bottomPanelHeightRatio",
    title: "Bottom Panel Height Ratio",
    description: "Configures the proportional height of the bottom task and output panel.",
    section: "layout",
    sectionTitle: "Layout & Shell",
    keywords: ["bottom", "panel", "height", "ratio", "tasks", "terminal"],
  },
  {
    id: "textUtility.defaultMode",
    title: "Default Transformation Mode",
    description: "Initial transformation mode selected when opening the text utility.",
    section: "text-utility",
    sectionTitle: "Text Utility",
    keywords: ["text", "utility", "transform", "uppercase", "lowercase", "titlecase", "whitespace"],
  },
];

export const SettingsShellView: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<string>("appearance");

  const {
    themeMode,
    setThemeMode,
    effectiveTheme,
    accentMode,
    setAccentMode,
    density,
    setDensity,
    resolvedMaterial,
    accessibilityPreferences,
  } = useThemeController();

  const sidebarWidth = useShellStore((s) => s.sidebarWidth);
  const setSidebarWidth = useShellStore((s) => s.setSidebarWidth);
  const inspectorWidth = useShellStore((s) => s.inspectorWidth);
  const setInspectorWidth = useShellStore((s) => s.setInspectorWidth);
  const bottomPanelHeightRatio = useShellStore((s) => s.bottomPanelHeightRatio);
  const setBottomPanelHeightRatio = useShellStore((s) => s.setBottomPanelHeightRatio);
  const setActiveNavId = useShellStore((s) => s.setActiveNavId);
  const band = useShellStore((s) => s.band);
  const windowWidth = useShellStore((s) => s.windowWidth);
  const windowHeight = useShellStore((s) => s.windowHeight);

  const textUtilityDefaultMode = useTextUtilityStore((s) => s.defaultMode);
  const setTextUtilityDefaultMode = useTextUtilityStore((s) => s.setDefaultMode);

  // Settings store
  const settingsStatus = useSettingsStore((s) => s.document.status);
  const searchQuery = useSettingsStore((s) => s.searchQuery);
  const setSearchQuery = useSettingsStore((s) => s.setSearchQuery);
  const resetSetting = useSettingsStore((s) => s.resetSetting);

  const updateChannel = useUpdateStore((s) => s.channel);
  const updateStatus = useUpdateStore((s) => s.status);
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const availableVersion = useUpdateStore((s) => s.availableVersion);
  const updateError = useUpdateStore((s) => s.error);
  const isChecking = useUpdateStore((s) => s.isChecking);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const setChannel = useUpdateStore((s) => s.setChannel);
  const resetSection = useSettingsStore((s) => s.resetSection);
  const resetAll = useSettingsStore((s) => s.resetAll);

  const [customSeedInput, setCustomSeedInput] = useState("#0078D4");
  const [seedError, setSeedError] = useState("");
  const [resetFeedback, setResetFeedback] = useState("");

  const handleBackToWorkspace = () => {
    setActiveNavId("workspace");
    navigate("/");
  };

  const handleApplyCustomSeed = () => {
    const validation = validateCustomSeed(customSeedInput);
    if (!validation.valid) {
      setSeedError(validation.reason || "Invalid seed color.");
      return;
    }
    setSeedError("");
    setAccentMode({ mode: "custom", seedColor: customSeedInput });
  };

  const handleResetLayout = async () => {
    await resetSection("layout");
    setResetFeedback("Layout preferences reset to default values.");
    setTimeout(() => setResetFeedback(""), 3000);
  };

  const handleResetAppearance = async () => {
    await resetSection("appearance");
    setResetFeedback("Appearance settings reset to default values.");
    setTimeout(() => setResetFeedback(""), 3000);
  };

  const handleResetTextUtility = async () => {
    await resetSection("textUtility");
    setResetFeedback("Text utility settings reset to default values.");
    setTimeout(() => setResetFeedback(""), 3000);
  };

  const handleResetAll = async () => {
    await resetAll();
    setResetFeedback("All settings reset to default values.");
    setTimeout(() => setResetFeedback(""), 3000);
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return STATIC_SEARCHABLE_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "900px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button
            appearance="subtle"
            icon={<ArrowLeft20Regular />}
            onClick={handleBackToWorkspace}
            aria-label="Back to Workspace"
            data-testid="settings-back-btn"
          >
            Back
          </Button>
          <div>
            <Title1 as="h1">Settings</Title1>
            <Text size={200} style={{ color: "var(--colorNeutralForeground3)", display: "block" }}>
              In-window canonical application settings and layout configuration
            </Text>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            appearance="outline"
            icon={<ArrowReset20Regular />}
            onClick={() => void handleResetAll()}
            data-testid="reset-all-settings-btn"
            aria-label="Reset all settings to defaults"
          >
            Reset All
          </Button>
        </div>
      </header>

      {/* RECOVERY / STATUS ALERT */}
      {settingsStatus && settingsStatus.state !== "healthy" && (
        <Card
          role="alert"
          data-testid="settings-recovery-alert"
          style={{
            marginBottom: "20px",
            backgroundColor: "var(--colorPaletteYellowBackground1)",
            border: "1px solid var(--colorPaletteYellowBorder1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Warning20Regular style={{ color: "var(--colorPaletteYellowForeground1)" }} />
            <div>
              <Text weight="semibold">Settings Status Notice</Text>
              <Text size={200} style={{ display: "block" }}>
                {settingsStatus.state === "recovered_from_previous_copy" &&
                  "Settings were recovered from the previous valid copy because the primary file was corrupt or unreadable."}
                {settingsStatus.state === "section_recovered" &&
                  `Section '${settingsStatus.recoveredSection}' was recovered to default values due to invalid contents.`}
                {settingsStatus.state === "reset_to_defaults" &&
                  "Settings were reset to default values because persistence data was unreadable."}
                {settingsStatus.state === "unsupported_future_version" &&
                  "Settings file is from a newer version of the application and is currently read-only."}
              </Text>
            </div>
          </div>
        </Card>
      )}

      {/* SEARCH BOX */}
      <div style={{ marginBottom: "20px" }}>
        <Field label="Search Settings">
          <Input
            value={searchQuery}
            onChange={(_, d) => setSearchQuery(d.value)}
            placeholder="Search appearance, layout, analysis, or utility settings..."
            contentBefore={<Search20Regular />}
            contentAfter={
              hasSearch ? (
                <Button
                  appearance="subtle"
                  icon={<Dismiss20Regular />}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  data-testid="clear-search-btn"
                  size="small"
                />
              ) : undefined
            }
            aria-label="Search Settings"
            data-testid="settings-search-input"
          />
        </Field>
      </div>

      {resetFeedback && (
        <div style={{ marginBottom: "16px" }}>
          <Text
            size={200}
            style={{ color: "var(--colorStatusSuccessForeground1)" }}
            role="status"
            data-testid="settings-feedback-message"
          >
            {resetFeedback}
          </Text>
        </div>
      )}

      {/* SEARCH RESULTS VIEW */}
      {hasSearch ? (
        <div
          role="region"
          aria-label="Search Results"
          aria-live="polite"
          data-testid="search-results-region"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <Text size={300} weight="semibold" data-testid="search-results-count">
            {filteredItems.length === 0
              ? `No settings found matching "${searchQuery}"`
              : `Found ${filteredItems.length} matching setting${filteredItems.length > 1 ? "s" : ""}:`}
          </Text>

          {filteredItems.length === 0 ? (
            <Card style={{ padding: "24px", textAlign: "center" }}>
              <Text size={300} style={{ color: "var(--colorNeutralForeground3)", marginBottom: "12px", display: "block" }}>
                No settings match your search term. Try a different keyword or clear the search.
              </Text>
              <Button
                appearance="secondary"
                onClick={() => setSearchQuery("")}
                data-testid="no-results-clear-btn"
              >
                Clear Search
              </Button>
            </Card>
          ) : (
            filteredItems.map((item) => (
              <Card key={item.id} data-testid={`search-item-${item.id}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <Title3 as="h3">{item.title}</Title3>
                    <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
                      {item.description}
                    </Text>
                  </div>
                  <Badge appearance="tint" color="brand">
                    {item.sectionTitle}
                  </Badge>
                </div>

                <div style={{ marginTop: "12px" }}>
                  {item.id === "appearance.themeMode" && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Button
                        appearance={themeMode === "system" ? "primary" : "secondary"}
                        onClick={() => setThemeMode("system")}
                        size="small"
                      >
                        System
                      </Button>
                      <Button
                        appearance={themeMode === "light" ? "primary" : "secondary"}
                        onClick={() => setThemeMode("light")}
                        size="small"
                      >
                        Light
                      </Button>
                      <Button
                        appearance={themeMode === "dark" ? "primary" : "secondary"}
                        onClick={() => setThemeMode("dark")}
                        size="small"
                      >
                        Dark
                      </Button>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("appearance", "themeMode")}
                        size="small"
                        data-testid="reset-themeMode-btn"
                      >
                        Reset
                      </Button>
                    </div>
                  )}

                  {item.id === "appearance.density" && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Button
                        appearance={density === "comfortable" ? "primary" : "secondary"}
                        onClick={() => setDensity("comfortable")}
                        size="small"
                      >
                        Comfortable
                      </Button>
                      <Button
                        appearance={density === "compact" ? "primary" : "secondary"}
                        onClick={() => setDensity("compact")}
                        size="small"
                      >
                        Compact
                      </Button>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("appearance", "density")}
                        size="small"
                        data-testid="reset-density-btn"
                      >
                        Reset
                      </Button>
                    </div>
                  )}

                  {item.id === "layout.sidebarWidth" && (
                    <div>
                      <Text size={200}>Current: {sidebarWidth}px</Text>
                      <input
                        type="range"
                        min={SIDEBAR_MIN_WIDTH}
                        max={SIDEBAR_MAX_WIDTH}
                        value={sidebarWidth}
                        onChange={(e) => setSidebarWidth(Number(e.target.value))}
                        style={{ width: "100%", marginTop: "6px" }}
                        aria-label="Sidebar Width Slider"
                      />
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("layout", "sidebarWidth")}
                        size="small"
                        style={{ marginTop: "6px" }}
                        data-testid="reset-sidebarWidth-btn"
                      >
                        Reset
                      </Button>
                    </div>
                  )}

                  {item.id === "textUtility.defaultMode" && (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <Button
                        appearance={textUtilityDefaultMode === "uppercase" ? "primary" : "secondary"}
                        onClick={() => setTextUtilityDefaultMode("uppercase")}
                        size="small"
                      >
                        UPPERCASE
                      </Button>
                      <Button
                        appearance={textUtilityDefaultMode === "lowercase" ? "primary" : "secondary"}
                        onClick={() => setTextUtilityDefaultMode("lowercase")}
                        size="small"
                      >
                        lowercase
                      </Button>
                      <Button
                        appearance={textUtilityDefaultMode === "titlecase" ? "primary" : "secondary"}
                        onClick={() => setTextUtilityDefaultMode("titlecase")}
                        size="small"
                      >
                        Title Case
                      </Button>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("textUtility", "defaultMode")}
                        size="small"
                        data-testid="reset-defaultMode-btn"
                      >
                        Reset
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* STANDARD TABBED VIEW */
        <>
          <TabList
            selectedValue={selectedTab}
            onTabSelect={(_, d) => setSelectedTab(d.value as string)}
            style={{ marginBottom: "20px" }}
            aria-label="Settings Categories"
          >
            <Tab value="appearance" icon={<Color20Regular />} data-testid="tab-appearance">
              Appearance
            </Tab>
            <Tab value="layout" icon={<Desktop20Regular />} data-testid="tab-layout">
              Layout &amp; Shell
            </Tab>
            <Tab value="text-utility" icon={<TextQuote20Regular />} data-testid="tab-text-utility">
              Text Utility
            </Tab>
            <Tab value="system" icon={<Info20Regular />} data-testid="tab-system">
              System Info
            </Tab>
          </TabList>

          {/* APPEARANCE TAB */}
          {selectedTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card role="region" aria-label="Theme Mode Selection">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Title2 as="h2">Theme Mode</Title2>
                  <Button
                    appearance="subtle"
                    icon={<ArrowReset20Regular />}
                    onClick={() => void resetSetting("appearance", "themeMode")}
                    size="small"
                    aria-label="Reset theme mode"
                    data-testid="reset-theme-mode-btn"
                  >
                    Reset
                  </Button>
                </div>
                <Text size={300} style={{ marginBottom: "12px" }}>
                  Choose between light, dark, or automatic system theme.
                </Text>
                <div style={{ display: "flex", gap: "8px" }} role="group" aria-label="Theme Mode">
                  <Button
                    appearance={themeMode === "system" ? "primary" : "secondary"}
                    onClick={() => setThemeMode("system")}
                    aria-pressed={themeMode === "system"}
                  >
                    System ({effectiveTheme})
                  </Button>
                  <Button
                    appearance={themeMode === "light" ? "primary" : "secondary"}
                    onClick={() => setThemeMode("light")}
                    aria-pressed={themeMode === "light"}
                  >
                    Light
                  </Button>
                  <Button
                    appearance={themeMode === "dark" ? "primary" : "secondary"}
                    onClick={() => setThemeMode("dark")}
                    aria-pressed={themeMode === "dark"}
                  >
                    Dark
                  </Button>
                </div>
              </Card>

              <Card role="region" aria-label="Layout Density Selection">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Title2 as="h2">Layout Density</Title2>
                  <Button
                    appearance="subtle"
                    icon={<ArrowReset20Regular />}
                    onClick={() => void resetSetting("appearance", "density")}
                    size="small"
                    aria-label="Reset density"
                    data-testid="reset-density-setting-btn"
                  >
                    Reset
                  </Button>
                </div>
                <Text size={300} style={{ marginBottom: "12px" }}>
                  Controls the compact spacing of shell elements and controls.
                </Text>
                <div style={{ display: "flex", gap: "8px" }} role="group" aria-label="Layout Density">
                  <Button
                    appearance={density === "comfortable" ? "primary" : "secondary"}
                    onClick={() => setDensity("comfortable")}
                    aria-pressed={density === "comfortable"}
                  >
                    Comfortable (Standard)
                  </Button>
                  <Button
                    appearance={density === "compact" ? "primary" : "secondary"}
                    onClick={() => setDensity("compact")}
                    aria-pressed={density === "compact"}
                  >
                    Compact (High Information Density)
                  </Button>
                </div>
              </Card>

              <Card role="region" aria-label="Accent Brand Selection">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Title2 as="h2">Accent Brand</Title2>
                  <Button
                    appearance="subtle"
                    icon={<ArrowReset20Regular />}
                    onClick={() => void resetSetting("appearance", "accentMode")}
                    size="small"
                    aria-label="Reset accent mode"
                    data-testid="reset-accent-mode-btn"
                  >
                    Reset
                  </Button>
                </div>
                <Text size={300} style={{ marginBottom: "12px" }}>
                  Configure the primary accent brand ramp.
                </Text>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }} role="group" aria-label="Accent Brand">
                  <Button
                    appearance={accentMode.mode === "default" ? "primary" : "secondary"}
                    onClick={() => setAccentMode({ mode: "default" })}
                    aria-pressed={accentMode.mode === "default"}
                  >
                    Fluent Default (#0F6CBD)
                  </Button>
                  <Button
                    appearance={accentMode.mode === "system" ? "primary" : "secondary"}
                    onClick={() => setAccentMode({ mode: "system" })}
                    aria-pressed={accentMode.mode === "system"}
                  >
                    System Accent
                  </Button>
                </div>

                <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                  <Field
                    label="Custom Accent Hex Seed"
                    validationMessage={seedError}
                    validationState={seedError ? "error" : "none"}
                    style={{ maxWidth: "240px" }}
                  >
                    <Input
                      value={customSeedInput}
                      onChange={(_, d) => setCustomSeedInput(d.value)}
                      placeholder="#0078D4"
                      aria-label="Custom accent hex seed"
                    />
                  </Field>
                  <Button appearance="primary" onClick={handleApplyCustomSeed}>
                    Apply Custom Ramp
                  </Button>
                </div>
              </Card>

              <Divider style={{ margin: "8px 0" }} />

              <div>
                <Button
                  appearance="secondary"
                  icon={<ArrowReset20Regular />}
                  onClick={() => void handleResetAppearance()}
                  data-testid="reset-appearance-section-btn"
                >
                  Reset Appearance Section
                </Button>
              </div>
            </div>
          )}

          {/* LAYOUT TAB */}
          {selectedTab === "layout" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card role="region" aria-label="Shell Panel Dimensions">
                <Title2 as="h2">Shell Panel Dimensions &amp; Persistence</Title2>
                <Text size={300} style={{ marginBottom: "16px" }}>
                  These values represent user-preferred sizes. They clamp automatically based on viewport constraints and are persisted across restarts via Rust storage.
                </Text>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text weight="semibold">Sidebar Width: {sidebarWidth}px</Text>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("layout", "sidebarWidth")}
                        size="small"
                        aria-label="Reset sidebar width"
                        data-testid="reset-sidebar-width-btn"
                      >
                        Reset
                      </Button>
                    </div>
                    <Text size={200} style={{ display: "block", color: "var(--colorNeutralForeground3)" }}>
                      Range: {SIDEBAR_MIN_WIDTH}px – {SIDEBAR_MAX_WIDTH}px
                    </Text>
                    <input
                      type="range"
                      min={SIDEBAR_MIN_WIDTH}
                      max={SIDEBAR_MAX_WIDTH}
                      value={sidebarWidth}
                      onChange={(e) => setSidebarWidth(Number(e.target.value))}
                      style={{ width: "100%", marginTop: "6px" }}
                      aria-label="Sidebar Width Slider"
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text weight="semibold">Inspector Width: {inspectorWidth}px</Text>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("layout", "inspectorWidth")}
                        size="small"
                        aria-label="Reset inspector width"
                        data-testid="reset-inspector-width-btn"
                      >
                        Reset
                      </Button>
                    </div>
                    <Text size={200} style={{ display: "block", color: "var(--colorNeutralForeground3)" }}>
                      Range: {INSPECTOR_MIN_WIDTH}px – {INSPECTOR_MAX_WIDTH}px
                    </Text>
                    <input
                      type="range"
                      min={INSPECTOR_MIN_WIDTH}
                      max={INSPECTOR_MAX_WIDTH}
                      value={inspectorWidth}
                      onChange={(e) => setInspectorWidth(Number(e.target.value))}
                      style={{ width: "100%", marginTop: "6px" }}
                      aria-label="Inspector Width Slider"
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text weight="semibold">Bottom Panel Ratio: {Math.round(bottomPanelHeightRatio * 100)}%</Text>
                      <Button
                        appearance="subtle"
                        icon={<ArrowReset20Regular />}
                        onClick={() => void resetSetting("layout", "bottomPanelHeightRatio")}
                        size="small"
                        aria-label="Reset bottom panel ratio"
                        data-testid="reset-bottom-panel-ratio-btn"
                      >
                        Reset
                      </Button>
                    </div>
                    <Text size={200} style={{ display: "block", color: "var(--colorNeutralForeground3)" }}>
                      Range: {Math.round(BOTTOM_PANEL_MIN_RATIO * 100)}% – {Math.round(BOTTOM_PANEL_MAX_RATIO * 100)}%
                    </Text>
                    <input
                      type="range"
                      min={BOTTOM_PANEL_MIN_RATIO * 100}
                      max={BOTTOM_PANEL_MAX_RATIO * 100}
                      value={Math.round(bottomPanelHeightRatio * 100)}
                      onChange={(e) => setBottomPanelHeightRatio(Number(e.target.value) / 100)}
                      style={{ width: "100%", marginTop: "6px" }}
                      aria-label="Bottom Panel Height Ratio Slider"
                    />
                  </div>
                </div>

                <Divider style={{ margin: "16px 0" }} />

                <div>
                  <Button
                    appearance="secondary"
                    icon={<ArrowReset20Regular />}
                    onClick={() => void handleResetLayout()}
                    data-testid="reset-layout-btn"
                  >
                    Reset Layout to Defaults
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* TEXT UTILITY TAB */}
          {selectedTab === "text-utility" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card role="region" aria-label="Text Utility Settings">
                <Title2 as="h2">Text Utility Configuration</Title2>
                <Text size={300} style={{ marginBottom: "16px" }}>
                  Configure defaults for the local text transformation and inspection utility.
                </Text>

                <div>
                  <Text weight="semibold" data-testid="text-utility-mode-display">
                    Default Mode: {textUtilityDefaultMode}
                  </Text>
                  <Text
                    size={200}
                    style={{
                      display: "block",
                      color: "var(--colorNeutralForeground3)",
                      marginBottom: "8px",
                    }}
                  >
                    Initial transformation mode selected when opening the text utility.
                  </Text>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                    role="group"
                    aria-label="Default Transformation Mode"
                  >
                    <Button
                      appearance={textUtilityDefaultMode === "uppercase" ? "primary" : "secondary"}
                      onClick={() => setTextUtilityDefaultMode("uppercase")}
                      aria-pressed={textUtilityDefaultMode === "uppercase"}
                      data-testid="text-mode-uppercase-btn"
                    >
                      UPPERCASE (Default)
                    </Button>
                    <Button
                      appearance={textUtilityDefaultMode === "lowercase" ? "primary" : "secondary"}
                      onClick={() => setTextUtilityDefaultMode("lowercase")}
                      aria-pressed={textUtilityDefaultMode === "lowercase"}
                      data-testid="text-mode-lowercase-btn"
                    >
                      lowercase
                    </Button>
                    <Button
                      appearance={textUtilityDefaultMode === "titlecase" ? "primary" : "secondary"}
                      onClick={() => setTextUtilityDefaultMode("titlecase")}
                      aria-pressed={textUtilityDefaultMode === "titlecase"}
                      data-testid="text-mode-titlecase-btn"
                    >
                      Title Case
                    </Button>
                    <Button
                      appearance={
                        textUtilityDefaultMode === "normalize-whitespace" ? "primary" : "secondary"
                      }
                      onClick={() => setTextUtilityDefaultMode("normalize-whitespace")}
                      aria-pressed={textUtilityDefaultMode === "normalize-whitespace"}
                      data-testid="text-mode-whitespace-btn"
                    >
                      Normalize Whitespace
                    </Button>
                  </div>
                </div>

                <Divider style={{ margin: "16px 0" }} />

                <div>
                  <Button
                    appearance="secondary"
                    icon={<ArrowReset20Regular />}
                    onClick={() => void handleResetTextUtility()}
                    data-testid="reset-text-utility-settings-btn"
                  >
                    Reset Text Utility Settings
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* SYSTEM INFO TAB */}
          {selectedTab === "system" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Card role="region" aria-label="System and Responsive Diagnostics">
                <Title2 as="h2">System &amp; Shell Diagnostics</Title2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                  <div>
                    <Text weight="semibold">Responsive Band: </Text>
                    <Badge appearance="filled" color="brand">
                      {band.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Text weight="semibold">Viewport Resolution: </Text>
                    <Text>{windowWidth} × {windowHeight} px</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Effective Material: </Text>
                    <Text>{resolvedMaterial.effectiveMaterial.toUpperCase()}</Text>
                    {resolvedMaterial.isFallback && (
                      <Text size={200} style={{ marginLeft: "8px", color: "var(--colorNeutralForeground3)" }}>
                        ({resolvedMaterial.reason || "Solid semantic fallback active"})
                      </Text>
                    )}
                  </div>
                  <div>
                    <Text weight="semibold">Forced Colors: </Text>
                    <Text>{accessibilityPreferences.forcedColors ? "Active" : "Inactive"}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Reduced Motion: </Text>
                    <Text>{accessibilityPreferences.prefersReducedMotion ? "Active" : "Inactive"}</Text>
                  </div>
                  <div>
                    <Text weight="semibold">Reduced Transparency: </Text>
                    <Text>{accessibilityPreferences.prefersReducedTransparency ? "Active" : "Inactive"}</Text>
                  </div>
                </div>
              </Card>

              <Card role="region" aria-label="Application Updates and Channels" data-testid="updates-settings-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Title2 as="h2">Updates &amp; Release Channels</Title2>
                  <Badge appearance="tint" color={updateChannel === "stable" ? "brand" : "warning"}>
                    {updateChannel.toUpperCase()} CHANNEL
                  </Badge>
                </div>
                <Text size={300} style={{ marginBottom: "12px" }}>
                  Configure your update release channel and verify application integrity.
                </Text>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <Text weight="semibold">Installed Version: </Text>
                    <Text data-testid="installed-version-display">{currentVersion}</Text>
                  </div>

                  <div>
                    <Text weight="semibold" style={{ display: "block", marginBottom: "6px" }}>Release Channel:</Text>
                    <div style={{ display: "flex", gap: "8px" }} role="group" aria-label="Release Channel">
                      <Button
                        appearance={updateChannel === "stable" ? "primary" : "secondary"}
                        onClick={() => void setChannel("stable")}
                        aria-pressed={updateChannel === "stable"}
                        data-testid="channel-stable-btn"
                        size="small"
                      >
                        Stable (Production)
                      </Button>
                      <Button
                        appearance={updateChannel === "beta" ? "primary" : "secondary"}
                        onClick={() => void setChannel("beta")}
                        aria-pressed={updateChannel === "beta"}
                        data-testid="channel-beta-btn"
                        size="small"
                      >
                        Beta (Pre-release)
                      </Button>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                    <Button
                      appearance="primary"
                      onClick={() => void checkForUpdates()}
                      disabled={isChecking}
                      data-testid="check-for-updates-btn"
                    >
                      {isChecking ? "Checking for Updates..." : "Check for Updates"}
                    </Button>
                    {updateStatus === "upToDate" && (
                      <Text data-testid="update-status-uptodate" style={{ color: "var(--colorPaletteGreenForeground1)" }}>
                        ✓ Application is up to date.
                      </Text>
                    )}
                    {updateStatus === "available" && availableVersion && (
                      <Text data-testid="update-status-available" style={{ color: "var(--colorBrandForeground1)" }}>
                        Update available: {availableVersion}
                      </Text>
                    )}
                    {updateStatus === "error" && updateError && (
                      <Text data-testid="update-status-error" style={{ color: "var(--colorPaletteRedForeground1)" }}>
                        Check failed: {updateError}
                      </Text>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
};
