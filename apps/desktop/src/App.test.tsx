import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const { invoke, listen } = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
  listen.mockResolvedValue(() => {});

  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  // Default handlers for theme commands
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
    return Promise.resolve();
  });
});

afterEach(cleanup);

describe("Prime Shell Desktop UI & Baseline Operations", () => {
  it("renders backend status and handles echo command", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "backend_status") {
        return Promise.resolve({
          state: "ready",
          ready: true,
          backendVersion: "0.1.0",
          circuitOpen: false,
        });
      }
      if (command === "runtime_probe_config") {
        return Promise.resolve({ enabled: false, evidencePath: null });
      }
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
      if (command === "echo_text") {
        return Promise.resolve({ text: "مرحبا 👋", traceId: "trace-1" });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    expect(await screen.findByText("Ready")).toBeInTheDocument();

    const input = screen.getByLabelText("Unicode text");
    await userEvent.clear(input);
    await userEvent.type(input, "مرحبا 👋");
    await userEvent.click(screen.getByRole("button", { name: "Echo" }));

    expect(await screen.findByText("مرحبا 👋")).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("echo_text", {
      text: "مرحبا 👋",
    });
  });

  it("starts count task and cancels it", async () => {
    let eventCallback: ((event: unknown) => void) | null = null;
    listen.mockImplementation((name: string, cb: (event: unknown) => void) => {
      if (name === "task-event") {
        eventCallback = cb;
      }
      return Promise.resolve(() => {});
    });

    invoke.mockImplementation((command: string) => {
      if (command === "backend_status") {
        return Promise.resolve({
          state: "ready",
          ready: true,
          backendVersion: "0.1.0",
          circuitOpen: false,
        });
      }
      if (command === "runtime_probe_config") {
        return Promise.resolve({ enabled: false, evidencePath: null });
      }
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
      if (command === "start_count_task") {
        return Promise.resolve("task-test-42");
      }
      if (command === "cancel_task") {
        setTimeout(() => {
          if (eventCallback) {
            eventCallback({
              payload: {
                protocol: "generic-app",
                kind: "event",
                requestId: "cancel-1",
                traceId: "trace-1",
                taskId: "task-test-42",
                sequence: 5,
                event: "terminal",
                payload: {
                  status: "Cancelled",
                  completed: 3,
                },
              },
            });
          }
        }, 10);
        return Promise.resolve({
          protocol: "generic-app",
          kind: "ack",
          requestId: "cancel-1",
          traceId: "trace-1",
          taskId: "task-test-42",
          status: "cancelling",
        });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    expect(await screen.findByText("Ready")).toBeInTheDocument();

    const startBtn = screen.getByRole("button", { name: "Start Count Task" });
    await userEvent.click(startBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("start_count_task", {
        target: 20,
        delayMs: 50,
      });
    });

    if (eventCallback) {
      (eventCallback as (event: unknown) => void)({
        payload: {
          protocol: "generic-app",
          kind: "event",
          requestId: "req-1",
          traceId: "trace-1",
          taskId: "task-test-42",
          sequence: 1,
          event: "progress",
          payload: {
            current: 5,
            target: 20,
          },
        },
      });
    }

    expect(await screen.findByText("Progress: 5 / 20")).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Cancel Task" });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("cancel_task", {
        taskId: "task-test-42",
      });
    });

    expect(await screen.findByText("Task terminated with state: Cancelled")).toBeInTheDocument();
  });

  it("shows open circuit badge and allows backend reset", async () => {
    invoke.mockImplementation((command: string) => {
      if (command === "backend_status") {
        return Promise.resolve({
          state: "faulted",
          ready: false,
          backendVersion: "0.1.0",
          circuitOpen: true,
        });
      }
      if (command === "runtime_probe_config") {
        return Promise.resolve({ enabled: false, evidencePath: null });
      }
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
      if (command === "reset_backend") {
        return Promise.resolve({
          state: "ready",
          ready: true,
          backendVersion: "0.1.0",
          circuitOpen: false,
        });
      }
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });

    render(<App />);
    expect(await screen.findByText("Circuit: OPEN")).toBeInTheDocument();
    expect(screen.getByText("Faulted")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: "Reset Backend" });
    await userEvent.click(resetBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("reset_backend");
    });
    expect(await screen.findByText("Backend reset completed.")).toBeInTheDocument();
  });
});

describe("Phase 2 — Theme, Tokens, and Accessibility Foundation", () => {
  it("switches theme modes (System, Light, Dark) and coordinates native window theme", async () => {
    render(<App />);

    const darkBtn = screen.getByTestId("theme-dark-btn");
    await userEvent.click(darkBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_native_window_theme", {
        effectiveTheme: "dark",
        backgroundHex: "#1F1F1F",
      });
    });

    const lightBtn = screen.getByTestId("theme-light-btn");
    await userEvent.click(lightBtn);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("sync_native_window_theme", {
        effectiveTheme: "light",
        backgroundHex: "#F5F5F5",
      });
    });
  });

  it("switches layout density modes between comfortable and compact", async () => {
    render(<App />);

    const compactBtn = screen.getByTestId("density-compact-btn");
    await userEvent.click(compactBtn);
    expect(compactBtn).toHaveAttribute("aria-pressed", "true");

    const comfortableBtn = screen.getByTestId("density-comfortable-btn");
    await userEvent.click(comfortableBtn);
    expect(comfortableBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("handles custom accent seed generation and rejects invalid seeds", async () => {
    render(<App />);

    const seedInput = screen.getByTestId("custom-seed-input");
    const applyBtn = screen.getByTestId("apply-custom-seed-btn");

    // Invalid near-white seed
    await userEvent.clear(seedInput);
    await userEvent.type(seedInput, "#FFFFFF");
    await userEvent.click(applyBtn);

    expect(await screen.findByText(/too light/i)).toBeInTheDocument();

    // Valid seed color
    await userEvent.clear(seedInput);
    await userEvent.type(seedInput, "#107C41");
    await userEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.queryByText(/too light/i)).not.toBeInTheDocument();
    });
  });

  it("renders portals (menu, tooltip, dialog) with theme inheritance and zero CSP violations", async () => {
    render(<App />);

    // Tooltip trigger
    const tooltipBtn = screen.getByTestId("tooltip-portal-trigger");
    expect(tooltipBtn).toBeInTheDocument();

    // Menu portal trigger
    const menuBtn = screen.getByTestId("menu-portal-trigger");
    await userEvent.click(menuBtn);
    expect(await screen.findByTestId("menu-item-1")).toBeInTheDocument();

    // Dialog portal trigger
    const dialogBtn = screen.getByTestId("dialog-portal-trigger");
    await userEvent.click(dialogBtn);
    expect(await screen.findByTestId("dialog-portal-surface")).toBeInTheDocument();

    // CSP violation verification element
    const cspCounter = screen.getByTestId("csp-violation-count");
    expect(cspCounter).toHaveAttribute("data-count", "0");
  });

  it("supports keyboard navigation and focus indicators across interactive elements", async () => {
    render(<App />);

    const focusTarget = screen.getByTestId("dual-tone-focus");
    expect(focusTarget).toHaveAttribute("tabIndex", "0");

    focusTarget.focus();
    expect(document.activeElement).toBe(focusTarget);

    // Status communications pair text and icons (never color alone)
    expect(screen.getByTestId("status-danger")).toHaveTextContent("Danger:");
    expect(screen.getByTestId("status-success")).toHaveTextContent("Success:");
    expect(screen.getByTestId("status-warning")).toHaveTextContent("Warning:");
  });
});
