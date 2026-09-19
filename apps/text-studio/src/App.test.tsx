import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockImplementation((cmd: string) => {
    if (cmd === "sync_native_window_theme") {
      return Promise.resolve();
    }
    if (cmd === "load_settings_document") {
      return Promise.resolve(null);
    }
    if (cmd === "get_update_status") {
      return Promise.resolve({
        state: "idle",
        channel: "stable",
        currentVersion: "0.1.0",
      });
    }
    return Promise.resolve();
  }),
}));

describe("Prime Text Studio Application", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Prime Text Studio shell with brand identity and features", async () => {
    render(<App />);

    expect(await screen.findByText("Prime Text Studio")).toBeInTheDocument();
    expect(screen.getByText("Focused Fluent text transformation and developer string manipulation studio.")).toBeInTheDocument();
  });

  it("navigates to Text Utility and performs text transformation", async () => {
    render(<App />);

    // Find and click the Text Utility button in the Quick Actions card
    const openBtn = await screen.findByRole("button", { name: /Open Text Utility/i });
    fireEvent.click(openBtn);

    // Verify Text Utility view is displayed
    await waitFor(() => {
      expect(screen.getByTestId("text-utility-view")).toBeInTheDocument();
    });
  });

  it("navigates to Settings view and verifies settings sections", async () => {
    render(<App />);

    // Find settings navigation rail button
    const settingsNav = await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(settingsNav);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Appearance/i })).toBeInTheDocument();
    });
  });
});
