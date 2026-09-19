import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { router } from "../routes";
import { useDocumentAnalysisStore } from "../state/useDocumentAnalysisStore";
import { useTaskStore } from "../state/useTaskStore";

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

beforeEach(async () => {
  useTaskStore.getState().reset();
  useDocumentAnalysisStore.getState().reset();
  window.location.hash = "#/analysis";
  await router.navigate("/analysis");
  invoke.mockReset();
  listen.mockReset();
  listen.mockResolvedValue(() => {});

  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  // Default mock implementations for Tauri commands
  invoke.mockImplementation((command: string) => {
    if (command === "get_theme_state") {
      return Promise.resolve({
        systemTheme: "light",
        systemAccent: null,
        materialCapabilities: {
          mica: true,
          micaAlt: false,
          transparencyEnabled: true,
          forcedColors: false,
          reducedTransparency: false,
        },
      });
    }
    if (command === "sync_native_window_theme") {
      return Promise.resolve();
    }
    if (command === "runtime_probe_config") {
      return Promise.resolve({ enabled: false, evidencePath: null });
    }
    if (command === "backend_status") {
      return Promise.resolve({
        state: "ready",
        ready: true,
        backendVersion: "0.1.0",
        circuitOpen: false,
      });
    }
    if (command === "get_settings") {
      return Promise.resolve({
        schemaVersion: 1,
        revision: 0,
        appearance: {
          themeMode: "system",
          accentMode: { mode: "default" },
          density: "comfortable",
          materialPreference: "system",
        },
        layout: {
          schemaVersion: 1,
          sidebarWidth: 280,
          sidebarCollapsed: false,
          inspectorWidth: 340,
          inspectorOpen: true,
          bottomPanelHeightRatio: 0.3,
          bottomPanelOpen: false,
          activeNavigationId: "analysis",
        },
        documentAnalysis: {
          maxTopTerms: 20,
        },
        textUtility: {
          defaultMode: "uppercase",
        },
        status: { state: "healthy" },
      });
    }
    if (command === "save_settings") {
      return Promise.resolve();
    }
    if (command === "reset_settings_section") {
      return Promise.resolve({
        schemaVersion: 1,
        revision: 0,
        appearance: {
          themeMode: "system",
          accentMode: { mode: "default" },
          density: "comfortable",
          materialPreference: "system",
        },
        layout: {
          schemaVersion: 1,
          sidebarWidth: 280,
          sidebarCollapsed: false,
          inspectorWidth: 340,
          inspectorOpen: true,
          bottomPanelHeightRatio: 0.3,
          bottomPanelOpen: false,
          activeNavigationId: "analysis",
        },
        documentAnalysis: {
          maxTopTerms: 20,
        },
        textUtility: {
          defaultMode: "uppercase",
        },
        status: { state: "healthy" },
      });
    }
    if (command === "get_shell_layout_preferences") {
      return Promise.resolve({
        schemaVersion: 1,
        sidebarWidth: 280,
        sidebarCollapsed: false,
        inspectorWidth: 340,
        inspectorOpen: true,
        bottomPanelHeightRatio: 0.3,
        bottomPanelOpen: false,
        activeNavigationId: "analysis",
      });
    }
    if (command === "save_shell_layout_preferences") {
      return Promise.resolve();
    }
    if (command === "get_task_snapshot") {
      return Promise.resolve(null);
    }
    return Promise.resolve();
  });
});

afterEach(cleanup);

describe("Phase 4 — Local Document-Analysis Reference Feature (GFD-P4-WP01)", () => {
  it("renders Document Analysis workspace view with empty state and picker", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { level: 1, name: "Document Analysis" })).toBeInTheDocument();
    expect(screen.getByTestId("open-document-btn")).toBeInTheDocument();
    expect(screen.getByTestId("empty-document-state")).toBeInTheDocument();
    expect(screen.getByText("No Document Selected")).toBeInTheDocument();
  });

  it("handles document selection, content loading, and local search highlighting", async () => {
    const sampleText = "The quick brown fox jumps over the lazy dog. Quick foxes are swift.";

    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "open_document_intent") {
        return Promise.resolve({
          id: "doc-analysis-001",
          displayName: "sample-analysis.txt",
          size: sampleText.length,
          mediaType: "text/plain",
        });
      }
      if (command === "read_document_content") {
        expect(args).toEqual({ id: "doc-analysis-001" });
        return Promise.resolve(sampleText);
      }
      return Promise.resolve();
    });

    render(<App />);

    const openBtn = await screen.findByTestId("open-document-btn");
    await userEvent.click(openBtn);

    // DocumentRef details displayed in metadata card
    const metaCard = await screen.findByTestId("document-metadata-card");
    expect(metaCard).toHaveTextContent("sample-analysis.txt");
    expect(metaCard).toHaveTextContent("doc-analysis-001");
    expect(metaCard).toHaveTextContent(`${sampleText.length} bytes`);

    // Safe document preview rendered
    expect(await screen.findByTestId("document-content-preview")).toHaveTextContent(sampleText);

    // Search query testing
    const searchInput = screen.getByTestId("document-search-input");
    await userEvent.type(searchInput, "quick");

    expect(await screen.findByText("Match 1 of 2")).toBeInTheDocument();
  });

  it("executes document analysis task, streams progress, and renders metrics & term frequencies", async () => {
    const sampleText = "The quick brown fox jumps over the lazy dog. Quick foxes are swift and graceful.";
    let eventCallback: ((event: unknown) => void) | null = null;

    listen.mockImplementation((name: string, cb: (event: unknown) => void) => {
      if (name === "task-event") {
        eventCallback = cb;
      }
      return Promise.resolve(() => {});
    });

    invoke.mockImplementation((command: string, args?: Record<string, unknown>) => {
      if (command === "open_document_intent") {
        return Promise.resolve({
          id: "doc-analysis-002",
          displayName: "metrics-test.txt",
          size: sampleText.length,
          mediaType: "text/plain",
        });
      }
      if (command === "read_document_content") {
        return Promise.resolve(sampleText);
      }
      if (command === "start_document_analysis_task") {
        expect(args).toMatchObject({
          documentId: "doc-analysis-002",
          maxTopTerms: 20,
        });
        return Promise.resolve("task-analysis-42");
      }
      return Promise.resolve();
    });

    render(<App />);

    // Pick document
    const openBtn = await screen.findByTestId("open-document-btn");
    await userEvent.click(openBtn);
    await screen.findByTestId("document-metadata-card");

    // Start Analysis
    const runBtn = screen.getByTestId("run-analysis-btn");
    await userEvent.click(runBtn);

    expect(await screen.findByText(/Analysis task task-analysis-42 in progress/)).toBeInTheDocument();

    // Stream progress event (50%)
    if (eventCallback) {
      (eventCallback as (event: unknown) => void)({
        payload: {
          protocol: "generic-app",
          kind: "event",
          requestId: "req-analysis-1",
          traceId: "trace-analysis-1",
          taskId: "task-analysis-42",
          sequence: 1,
          event: "progress",
          payload: { current: 50, target: 100, message: "Tokenizing document words" },
        },
      });
    }

    expect(await screen.findByText("Tokenizing document words")).toBeInTheDocument();

    // Stream terminal event with result
    if (eventCallback) {
      (eventCallback as (event: unknown) => void)({
        payload: {
          protocol: "generic-app",
          kind: "event",
          requestId: "req-analysis-1",
          traceId: "trace-analysis-1",
          taskId: "task-analysis-42",
          sequence: 2,
          event: "terminal",
          payload: {
            current: 100,
            target: 100,
            status: "Succeeded",
            result: {
              metrics: {
                characterCount: 80,
                wordCount: 15,
                lineCount: 1,
                sentenceCount: 2,
                readingTimeSeconds: 5,
                lexicalDiversity: 0.9333,
                topTerms: [
                  { term: "quick", count: 2 },
                  { term: "the", count: 2 },
                  { term: "fox", count: 1 },
                ],
                keywordMatches: [],
              },
            },
          },
        },
      });
    }

    // Verify metrics grid
    expect(await screen.findByTestId("stat-word-count")).toHaveTextContent("15");
    expect(screen.getByTestId("stat-char-count")).toHaveTextContent("80");
    expect(screen.getByTestId("stat-line-count")).toHaveTextContent("1");
    expect(screen.getByTestId("stat-sentence-count")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-reading-time")).toHaveTextContent("5s");
    expect(screen.getByTestId("stat-lexical-diversity")).toHaveTextContent("93.3%");

    // Verify term frequencies histogram
    expect(screen.getByTestId("term-frequency-list")).toBeInTheDocument();
    expect(screen.getByText("quick")).toBeInTheDocument();
    expect(screen.getByText("the")).toBeInTheDocument();
  });

  it("handles cooperative task cancellation during analysis", async () => {
    let eventCallback: ((event: unknown) => void) | null = null;

    listen.mockImplementation((name: string, cb: (event: unknown) => void) => {
      if (name === "task-event") {
        eventCallback = cb;
      }
      return Promise.resolve(() => {});
    });

    invoke.mockImplementation((command: string) => {
      if (command === "open_document_intent") {
        return Promise.resolve({
          id: "doc-analysis-003",
          displayName: "cancel-test.txt",
          size: 1000,
          mediaType: "text/plain",
        });
      }
      if (command === "read_document_content") {
        return Promise.resolve("Some document text for cancellation test.");
      }
      if (command === "start_document_analysis_task") {
        return Promise.resolve("task-cancel-99");
      }
      if (command === "cancel_task") {
        setTimeout(() => {
          if (eventCallback) {
            eventCallback({
              payload: {
                protocol: "generic-app",
                kind: "event",
                requestId: "cancel-req",
                traceId: "cancel-trace",
                taskId: "task-cancel-99",
                sequence: 3,
                event: "terminal",
                payload: {
                  status: "Cancelled",
                  message: "Analysis cancelled by user",
                },
              },
            });
          }
        }, 10);
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    render(<App />);

    const openBtn = await screen.findByTestId("open-document-btn");
    await userEvent.click(openBtn);
    await screen.findByTestId("document-metadata-card");

    const runBtn = screen.getByTestId("run-analysis-btn");
    await userEvent.click(runBtn);

    const cancelBtn = await screen.findByTestId("cancel-analysis-btn");
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cancel_task", { taskId: "task-cancel-99" });
    });
  });

  it("configures maxTopTerms in Settings and resets to default", async () => {
    render(<App />);

    // Navigate to Settings
    const settingsNavBtn = await screen.findByTestId("nav-settings-btn");
    await userEvent.click(settingsNavBtn);

    // Switch to Document Analysis tab
    const analysisTab = await screen.findByTestId("tab-analysis");
    await userEvent.click(analysisTab);

    expect(screen.getByText("Document Analysis Configuration")).toBeInTheDocument();
    expect(screen.getByTestId("terms-limit-display")).toHaveTextContent("Top Terms Limit (maxTopTerms): 20");

    // Change to 50 terms
    const terms50Btn = screen.getByTestId("terms-limit-50-btn");
    await userEvent.click(terms50Btn);
    expect(useDocumentAnalysisStore.getState().maxTopTerms).toBe(50);

    // Reset to default
    const resetBtn = screen.getByTestId("reset-analysis-settings-btn");
    await userEvent.click(resetBtn);
    await waitFor(() => {
      expect(useDocumentAnalysisStore.getState().maxTopTerms).toBe(20);
    });
  });
});
