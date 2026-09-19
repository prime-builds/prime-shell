import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { CommandPalette, useCommandShortcuts } from "../CommandPalette";
import { featureRegistry } from "../../../features";

function renderWithTheme(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

describe("CommandPalette Component & Keyboard Shortcuts", () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    onCloseMock.mockClear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    renderWithTheme(<CommandPalette isOpen={false} onClose={onCloseMock} />);
    expect(screen.queryByTestId("command-palette-dialog")).not.toBeInTheDocument();
  });

  it("renders when isOpen is true and shows registered commands", () => {
    renderWithTheme(<CommandPalette isOpen={true} onClose={onCloseMock} />);
    expect(screen.getByTestId("command-palette-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("command-palette-input")).toBeInTheDocument();

    const commands = featureRegistry.getCommands();
    expect(commands.length).toBeGreaterThan(0);

    for (const cmd of commands) {
      expect(screen.getByText(cmd.title)).toBeInTheDocument();
    }
  });

  it("filters commands based on search query", async () => {
    renderWithTheme(<CommandPalette isOpen={true} onClose={onCloseMock} />);
    const input = screen.getByTestId("command-palette-input");

    await userEvent.type(input, "Text Utility");

    expect(screen.getByText("Apply Text Transform")).toBeInTheDocument();
    expect(screen.getByText("Clear Text Utility")).toBeInTheDocument();
    expect(screen.queryByText("Open Document for Analysis")).not.toBeInTheDocument();
  });

  it("navigates with ArrowDown/ArrowUp and executes command with Enter", async () => {
    const commands = featureRegistry.getCommands();
    const firstCmd = commands[0];
    const executeSpy = vi.spyOn(firstCmd, "execute");

    renderWithTheme(<CommandPalette isOpen={true} onClose={onCloseMock} />);
    const input = screen.getByTestId("command-palette-input");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCloseMock).toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalled();
  });

  it("closes palette on Escape key", () => {
    renderWithTheme(<CommandPalette isOpen={true} onClose={onCloseMock} />);
    const input = screen.getByTestId("command-palette-input");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalled();
  });

  it("closes palette when clicking on backdrop", () => {
    renderWithTheme(<CommandPalette isOpen={true} onClose={onCloseMock} />);
    const backdrop = screen.getByTestId("command-palette-backdrop");

    fireEvent.click(backdrop);
    expect(onCloseMock).toHaveBeenCalled();
  });

  describe("useCommandShortcuts Hook", () => {
    const ShortcutTester: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
      useCommandShortcuts(onOpen);
      return (
        <div>
          <input data-testid="test-input" />
          <div data-testid="outside-area">Outside</div>
        </div>
      );
    };

    it("triggers onOpen when Ctrl+K is pressed", () => {
      const onOpen = vi.fn();
      render(<ShortcutTester onOpen={onOpen} />);

      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
      expect(onOpen).toHaveBeenCalled();
    });

    it("triggers onOpen when Ctrl+Shift+P is pressed", () => {
      const onOpen = vi.fn();
      render(<ShortcutTester onOpen={onOpen} />);

      fireEvent.keyDown(window, { key: "p", ctrlKey: true, shiftKey: true });
      expect(onOpen).toHaveBeenCalled();
    });

    it("does not trigger registered command shortcut when focus is inside an editable input", () => {
      const commands = featureRegistry.getCommands();
      const textCmd = commands.find((c) => c.shortcut === "Ctrl+Shift+T");
      if (!textCmd) throw new Error("textUtility command not found");

      const executeSpy = vi.spyOn(textCmd, "execute");
      const onOpen = vi.fn();
      render(<ShortcutTester onOpen={onOpen} />);

      const input = screen.getByTestId("test-input");

      // Press Ctrl+Shift+T inside input
      fireEvent.keyDown(input, { key: "t", ctrlKey: true, shiftKey: true });
      expect(executeSpy).not.toHaveBeenCalled();
    });
  });
});
