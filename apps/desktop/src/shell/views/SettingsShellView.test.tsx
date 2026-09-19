import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { SettingsShellView } from "./SettingsShellView";
import { useSettingsStore, DEFAULT_SETTINGS } from "../state/useSettingsStore";
import { ThemeProviderContext } from "../../theme/ThemeContext";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === "get_settings") {
      return DEFAULT_SETTINGS;
    }
    if (cmd === "get_theme_state") {
      return {
        systemTheme: "light",
        systemAccent: null,
        materialCapabilities: {
          mica: false,
          micaAlt: false,
          transparencyEnabled: false,
          forcedColors: false,
          reducedTransparency: false,
        },
      };
    }
    if (cmd === "save_settings") {
      const doc = (args as { document?: Record<string, unknown>; expectedRevision?: number } | undefined)?.document ?? {};
      const rev = (args as { document?: Record<string, unknown>; expectedRevision?: number } | undefined)?.expectedRevision ?? 0;
      return { ...doc, revision: rev + 1 };
    }
    if (cmd === "reset_setting") {
      return DEFAULT_SETTINGS;
    }
    if (cmd === "reset_settings_section") {
      return DEFAULT_SETTINGS;
    }
    if (cmd === "reset_all_settings") {
      return DEFAULT_SETTINGS;
    }
    if (cmd === "get_update_status") {
      return {
        status: "idle",
        currentVersion: "0.1.0",
        availableVersion: null,
        channel: "stable",
        error: null,
        downloadProgress: null,
        checkedAt: null,
      };
    }
    if (cmd === "check_for_updates") {
      return {
        status: "upToDate",
        currentVersion: "0.1.0",
        availableVersion: null,
        channel: (args as { channel?: string } | undefined)?.channel ?? "stable",
        error: null,
        downloadProgress: null,
        checkedAt: "2026-09-19T18:00:00Z",
      };
    }
    if (cmd === "set_update_channel") {
      return {
        status: "idle",
        currentVersion: "0.1.0",
        availableVersion: null,
        channel: (args as { channel?: string } | undefined)?.channel ?? "stable",
        error: null,
        downloadProgress: null,
        checkedAt: null,
      };
    }
    return null;
  }),
}));

function renderSettingsView() {
  return render(
    <FluentProvider theme={webLightTheme}>
      <ThemeProviderContext>
        <MemoryRouter initialEntries={["/settings"]}>
          <SettingsShellView />
        </MemoryRouter>
      </ThemeProviderContext>
    </FluentProvider>,
  );
}

describe("SettingsShellView", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      document: { ...DEFAULT_SETTINGS },
      isLoaded: true,
      searchQuery: "",
    });
  });

  it("renders Settings header and category tabs", () => {
    renderSettingsView();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeDefined();
    expect(screen.getByTestId("tab-appearance")).toBeDefined();
    expect(screen.getByTestId("tab-layout")).toBeDefined();
    expect(screen.getByTestId("tab-analysis")).toBeDefined();
    expect(screen.getByTestId("tab-text-utility")).toBeDefined();
    expect(screen.getByTestId("tab-system")).toBeDefined();
    expect(screen.getByTestId("settings-search-input")).toBeDefined();
    expect(screen.getByTestId("reset-all-settings-btn")).toBeDefined();
  });

  it("filters settings when searching and displays results count", () => {
    renderSettingsView();

    const searchInput = screen.getByTestId("settings-search-input");
    fireEvent.change(searchInput, { target: { value: "sidebar" } });

    expect(screen.getByTestId("search-results-region")).toBeDefined();
    expect(screen.getByTestId("search-results-count").textContent).toContain("Found 1 matching setting");
    expect(screen.getByTestId("search-item-layout.sidebarWidth")).toBeDefined();

    // Clear search
    const clearBtn = screen.getByTestId("clear-search-btn");
    fireEvent.click(clearBtn);

    expect(screen.queryByTestId("search-results-region")).toBeNull();
    expect(screen.getByTestId("tab-appearance")).toBeDefined();
  });

  it("displays no results state when query does not match", () => {
    renderSettingsView();

    const searchInput = screen.getByTestId("settings-search-input");
    fireEvent.change(searchInput, { target: { value: "nonexistentkeyword" } });

    expect(screen.getByText('No settings found matching "nonexistentkeyword"')).toBeDefined();
    expect(screen.getByTestId("no-results-clear-btn")).toBeDefined();

    fireEvent.click(screen.getByTestId("no-results-clear-btn"));
    expect(screen.queryByTestId("search-results-region")).toBeNull();
  });

  it("displays recovery alert when settings status indicates recovery", () => {
    useSettingsStore.setState({
      document: {
        ...DEFAULT_SETTINGS,
        status: {
          state: "recovered_from_previous_copy",
          message: "Recovered from previous copy",
        },
      },
    });

    renderSettingsView();

    const alert = screen.getByTestId("settings-recovery-alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("recovered from the previous valid copy");
  });

  it("displays section recovery alert when an isolated section was recovered", () => {
    useSettingsStore.setState({
      document: {
        ...DEFAULT_SETTINGS,
        status: {
          state: "section_recovered",
          recoveredSection: "documentAnalysis",
        },
      },
    });

    renderSettingsView();

    const alert = screen.getByTestId("settings-recovery-alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Section 'documentAnalysis' was recovered to default values");
  });

  it("triggers reset all settings and shows feedback message", async () => {
    renderSettingsView();

    const resetAllBtn = screen.getByTestId("reset-all-settings-btn");
    fireEvent.click(resetAllBtn);

    expect(await screen.findByTestId("settings-feedback-message")).toBeDefined();
    expect(screen.getByTestId("settings-feedback-message").textContent).toContain(
      "All settings reset to default values",
    );
  });

  it("renders update release channel card in system tab and allows checking for updates", async () => {
    renderSettingsView();

    const systemTab = screen.getByTestId("tab-system");
    fireEvent.click(systemTab);

    expect(screen.getByTestId("updates-settings-card")).toBeDefined();
    expect(screen.getByTestId("installed-version-display").textContent).toBe("0.1.0");

    const betaBtn = screen.getByTestId("channel-beta-btn");
    fireEvent.click(betaBtn);

    const checkBtn = screen.getByTestId("check-for-updates-btn");
    fireEvent.click(checkBtn);

    expect(await screen.findByTestId("update-status-uptodate")).toBeDefined();
  });
});
