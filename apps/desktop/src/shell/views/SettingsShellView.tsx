import React, { useState } from "react";
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
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  ArrowReset20Regular,
  Color20Regular,
  Desktop20Regular,
  DocumentSearch20Regular,
  Info20Regular,
} from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { validateCustomSeed } from "@prime-shell/design-tokens";
import { useThemeController } from "../../theme/ThemeContext";
import { useShellStore } from "../state/useShellStore";
import { useDocumentAnalysisStore } from "../state/useDocumentAnalysisStore";
import {
  BOTTOM_PANEL_MAX_RATIO,
  BOTTOM_PANEL_MIN_RATIO,
  INSPECTOR_MAX_WIDTH,
  INSPECTOR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../types";

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
  const resetPreferences = useShellStore((s) => s.resetPreferences);
  const setActiveNavId = useShellStore((s) => s.setActiveNavId);
  const band = useShellStore((s) => s.band);
  const windowWidth = useShellStore((s) => s.windowWidth);
  const windowHeight = useShellStore((s) => s.windowHeight);

  const maxTopTerms = useDocumentAnalysisStore((s) => s.maxTopTerms);
  const setMaxTopTerms = useDocumentAnalysisStore((s) => s.setMaxTopTerms);

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
    await resetPreferences();
    setResetFeedback("Layout preferences reset to default values.");
    setTimeout(() => setResetFeedback(""), 3000);
  };

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
          gap: "12px",
          marginBottom: "20px",
        }}
      >
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
          <Text size={200} style={{ color: "var(--colorNeutralForeground3)" }}>
            In-window application settings and layout configuration
          </Text>
        </div>
      </header>

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
        <Tab value="analysis" icon={<DocumentSearch20Regular />} data-testid="tab-analysis">
          Document Analysis
        </Tab>
        <Tab value="system" icon={<Info20Regular />} data-testid="tab-system">
          System Info
        </Tab>
      </TabList>

      {/* APPEARANCE TAB */}
      {selectedTab === "appearance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Card role="region" aria-label="Theme Mode Selection">
            <Title2 as="h2">Theme Mode</Title2>
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
            <Title2 as="h2">Layout Density</Title2>
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
            <Title2 as="h2">Accent Brand</Title2>
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
                <Text weight="semibold">Sidebar Width:</Text> {sidebarWidth}px
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
                <Text weight="semibold">Inspector Width:</Text> {inspectorWidth}px
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
                <Text weight="semibold">Bottom Panel Ratio:</Text> {Math.round(bottomPanelHeightRatio * 100)}%
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
              {resetFeedback && (
                <Text
                  size={200}
                  style={{ marginLeft: "12px", color: "var(--colorStatusSuccessForeground1)" }}
                  role="status"
                >
                  {resetFeedback}
                </Text>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* DOCUMENT ANALYSIS TAB */}
      {selectedTab === "analysis" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Card role="region" aria-label="Document Analysis Settings">
            <Title2 as="h2">Document Analysis Configuration</Title2>
            <Text size={300} style={{ marginBottom: "16px" }}>
              Configure parameters for the local document analysis reference feature.
            </Text>

            <div>
              <Text weight="semibold" data-testid="terms-limit-display">
                Top Terms Limit (maxTopTerms): {maxTopTerms}
              </Text>
              <Text size={200} style={{ display: "block", color: "var(--colorNeutralForeground3)", marginBottom: "8px" }}>
                Maximum number of frequent terms to extract and rank in analysis histograms (default: 20).
              </Text>
              <div style={{ display: "flex", gap: "8px" }} role="group" aria-label="Top Terms Limit">
                <Button
                  appearance={maxTopTerms === 10 ? "primary" : "secondary"}
                  onClick={() => setMaxTopTerms(10)}
                  aria-pressed={maxTopTerms === 10}
                  data-testid="terms-limit-10-btn"
                >
                  10 terms
                </Button>
                <Button
                  appearance={maxTopTerms === 20 ? "primary" : "secondary"}
                  onClick={() => setMaxTopTerms(20)}
                  aria-pressed={maxTopTerms === 20}
                  data-testid="terms-limit-20-btn"
                >
                  20 terms (Default)
                </Button>
                <Button
                  appearance={maxTopTerms === 50 ? "primary" : "secondary"}
                  onClick={() => setMaxTopTerms(50)}
                  aria-pressed={maxTopTerms === 50}
                  data-testid="terms-limit-50-btn"
                >
                  50 terms
                </Button>
              </div>
            </div>

            <Divider style={{ margin: "16px 0" }} />

            <div>
              <Button
                appearance="secondary"
                icon={<ArrowReset20Regular />}
                onClick={() => setMaxTopTerms(20)}
                data-testid="reset-analysis-settings-btn"
              >
                Reset to Default (20)
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
        </div>
      )}
    </div>
  );
};
