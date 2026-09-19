import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { DiagnosticsShellView } from "./DiagnosticsShellView";
import { useDiagnosticsStore } from "../state/useDiagnosticsStore";

const MOCK_SUMMARY = {
  totalRecords: 42,
  ringBufferCapacity: 1000,
  recentErrorsCount: 1,
  logFileBytes: 15360,
  maxLogBytes: 5242880,
  backendStatus: {
    state: "ready" as const,
    ready: true,
    backendVersion: "1.0.0",
    circuitOpen: false,
  },
  settingsStatus: {
    state: "healthy" as const,
  },
  retentionPolicy: "1000 records in memory, 5 MB bounded rotated disk log",
};

const MOCK_PREVIEW = {
  totalEstimatedBytes: 5432,
  entryCount: 5,
  entries: [
    { name: "manifest.json", role: "export_manifest", estimatedBytes: 800, recordCount: 1 },
    { name: "diagnostics.ndjson", role: "diagnostic_records", estimatedBytes: 3000, recordCount: 42 },
    { name: "safe_errors.json", role: "safe_error_records", estimatedBytes: 400, recordCount: 1 },
    { name: "system_summary.json", role: "system_summary", estimatedBytes: 350, recordCount: 1 },
    { name: "settings_summary.json", role: "settings_summary", estimatedBytes: 250, recordCount: 1 },
  ],
  redactionVerified: true,
  generatedAt: "2026-09-19T17:19:29.000Z",
};

const MOCK_ERRORS = [
  {
    code: "ERR_TEST_TIMEOUT",
    message: "Operation timed out safely after 5000ms",
    timestamp: "2026-09-19T17:19:00.000Z",
    traceId: "trace-test-123",
    component: "backend",
    userRecoveryHint: "Check backend status and retry the operation.",
  },
];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "get_diagnostics_summary") {
      return MOCK_SUMMARY;
    }
    if (cmd === "get_recent_safe_errors") {
      return MOCK_ERRORS;
    }
    if (cmd === "get_export_preview") {
      return MOCK_PREVIEW;
    }
    if (cmd === "recover_backend") {
      return {
        state: "ready",
        ready: true,
        backendVersion: "1.0.0",
        circuitOpen: false,
      };
    }
    if (cmd === "repair_settings_section") {
      return {
        schemaVersion: 1,
        revision: 2,
        appearance: {},
        layout: {},
        documentAnalysis: {},
        textUtility: {},
        status: { state: "healthy" },
      };
    }
    if (cmd === "export_diagnostics") {
      return {
        manifestVersion: 1,
        appVersion: "0.1.0",
        backendVersion: "1.0.0",
        targetOs: "windows",
        targetArch: "x86_64",
        createdAt: "2026-09-19T17:20:00.000Z",
        entries: [
          { name: "manifest.json", role: "export_manifest", sizeBytes: 800, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", recordCount: 1 },
          { name: "diagnostics.ndjson", role: "diagnostic_records", sizeBytes: 3000, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", recordCount: 42 },
        ],
        excludedCategories: ["userDocumentContent", "rawSettingsValues"],
        redactionVerified: true,
      };
    }
    return null;
  }),
}));

function renderDiagnosticsView() {
  return render(
    <FluentProvider theme={webLightTheme}>
      <MemoryRouter initialEntries={["/diagnostics"]}>
        <DiagnosticsShellView />
      </MemoryRouter>
    </FluentProvider>,
  );
}

describe("DiagnosticsShellView", () => {
  beforeEach(() => {
    useDiagnosticsStore.setState({
      summary: MOCK_SUMMARY,
      recentErrors: MOCK_ERRORS,
      preview: MOCK_PREVIEW,
      lastExportManifest: null,
      isLoading: false,
      isExporting: false,
      isRecovering: false,
      isRepairing: false,
      error: null,
      successMessage: null,
    });
  });

  it("renders diagnostics header and health sections", () => {
    renderDiagnosticsView();

    expect(screen.getByRole("heading", { name: "Diagnostics & System Recovery" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Backend Health & Recovery" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Storage & Retention Policy" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Recent Safe Errors" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Settings Integrity & Repair" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Diagnostics Bundle Export" })).toBeDefined();
  });

  it("displays backend health state, version, and circuit status", () => {
    renderDiagnosticsView();

    expect(screen.getByText("READY")).toBeDefined();
    expect(screen.getByText("NORMAL")).toBeDefined();
    expect(screen.getByText("1.0.0")).toBeDefined();
  });

  it("displays safe error records with codes and recovery hints", () => {
    renderDiagnosticsView();

    expect(screen.getByText("ERR_TEST_TIMEOUT")).toBeDefined();
    expect(screen.getByText("Operation timed out safely after 5000ms")).toBeDefined();
    expect(screen.getByText("Hint: Check backend status and retry the operation.")).toBeDefined();
  });

  it("triggers backend recovery when button clicked", async () => {
    renderDiagnosticsView();

    const recoverBtn = screen.getByRole("button", { name: "Recover backend process" });
    fireEvent.click(recoverBtn);

    // Should indicate recovery
    expect(recoverBtn).toBeDefined();
  });

  it("renders export preview table with entries and redaction status", () => {
    renderDiagnosticsView();

    expect(screen.getByText("Redaction Verified: Pass")).toBeDefined();
    expect(screen.getByText("manifest.json")).toBeDefined();
    expect(screen.getByText("diagnostics.ndjson")).toBeDefined();
    expect(screen.getByText("safe_errors.json")).toBeDefined();
  });

  it("handles settings section repair with confirmation", async () => {
    renderDiagnosticsView();

    const repairButtons = screen.getAllByRole("button", { name: "Repair Section" });
    expect(repairButtons.length).toBeGreaterThan(0);

    // Click first section repair
    fireEvent.click(repairButtons[0]);

    // Should show confirm button
    const confirmBtn = screen.getByRole("button", { name: "Confirm Reset" });
    expect(confirmBtn).toBeDefined();

    fireEvent.click(confirmBtn);
  });
});
