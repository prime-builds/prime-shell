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
});

afterEach(cleanup);

describe("Prime Shell Desktop UI", () => {
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
      if (command === "start_count_task") {
        return Promise.resolve("task-test-42");
      }
      if (command === "cancel_task") {
        // Emit cancelled event
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

    // Simulate progress event
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
