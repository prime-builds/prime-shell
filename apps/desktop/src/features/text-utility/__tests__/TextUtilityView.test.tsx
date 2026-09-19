import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { TextUtilityView } from "../TextUtilityView";
import { useTextUtilityStore } from "../state";
import { applyTransform, inspectText, MAX_INPUT_CHARS } from "../transform";

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <FluentProvider theme={webLightTheme}>
      {ui}
    </FluentProvider>,
  );
}

describe("TextUtility Component & Pure Logic", () => {
  beforeEach(() => {
    useTextUtilityStore.getState().clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Pure Transform Logic", () => {
    it("handles uppercase transform correctly with Unicode", () => {
      expect(applyTransform("hello world! café", "uppercase")).toBe("HELLO WORLD! CAFÉ");
    });

    it("handles lowercase transform correctly", () => {
      expect(applyTransform("HELLO WORLD!", "lowercase")).toBe("hello world!");
    });

    it("handles titlecase transform correctly", () => {
      expect(applyTransform("the quick brown fox", "titlecase")).toBe("The Quick Brown Fox");
    });

    it("handles normalize whitespace transform correctly", () => {
      const raw = "   hello   \t  world  \r\n   line   two   \n\n";
      expect(applyTransform(raw, "normalize-whitespace")).toBe("hello world\nline two");
    });

    it("inspects text metrics accurately", () => {
      const sample = "First line\nSecond line with 5 words.";
      const metrics = inspectText(sample);
      expect(metrics.lineCount).toBe(2);
      expect(metrics.wordCount).toBe(7);
      expect(metrics.characterCount).toBe(sample.length);
      expect(metrics.byteLength).toBe(new TextEncoder().encode(sample).length);
    });
  });

  describe("TextUtilityView UI Journey", () => {
    it("renders empty state with disabled action buttons", () => {
      renderWithTheme(<TextUtilityView />);

      expect(screen.getByText("Text Utility")).toBeInTheDocument();
      expect(screen.getByTestId("text-utility-apply-btn")).toBeDisabled();
      expect(screen.getByTestId("text-utility-clear-btn")).toBeDisabled();
      expect(screen.getByTestId("metric-chars")).toHaveTextContent("0");
      expect(screen.getByTestId("metric-words")).toHaveTextContent("0");
    });

    it("updates live metrics as user types input", async () => {
      renderWithTheme(<TextUtilityView />);
      const input = screen.getByTestId("text-utility-input");

      await userEvent.type(input, "Hello world!\nLine 2");

      expect(screen.getByTestId("metric-chars")).toHaveTextContent("19");
      expect(screen.getByTestId("metric-words")).toHaveTextContent("4");
      expect(screen.getByTestId("metric-lines")).toHaveTextContent("2");
      expect(screen.getByTestId("text-utility-apply-btn")).toBeEnabled();
    });

    it("applies transformation and renders result in read-only preview", async () => {
      renderWithTheme(<TextUtilityView />);
      const input = screen.getByTestId("text-utility-input");
      const applyBtn = screen.getByTestId("text-utility-apply-btn");

      await userEvent.type(input, "fluent desktop shell");
      await userEvent.click(applyBtn);

      const result = screen.getByTestId("text-utility-result");
      expect(result).toHaveValue("FLUENT DESKTOP SHELL");
    });

    it("changes transformation mode via select dropdown", async () => {
      renderWithTheme(<TextUtilityView />);
      const input = screen.getByTestId("text-utility-input");
      const modeSelect = screen.getByTestId("text-utility-mode-select");
      const applyBtn = screen.getByTestId("text-utility-apply-btn");

      await userEvent.type(input, "hello world");
      fireEvent.change(modeSelect, { target: { value: "titlecase" } });
      await userEvent.click(applyBtn);

      expect(screen.getByTestId("text-utility-result")).toHaveValue("Hello World");
    });

    it("copies result to clipboard when copy button is clicked", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      renderWithTheme(<TextUtilityView />);
      const input = screen.getByTestId("text-utility-input");
      const applyBtn = screen.getByTestId("text-utility-apply-btn");

      await userEvent.type(input, "copy this text");
      await userEvent.click(applyBtn);

      const copyBtn = screen.getByTestId("text-utility-copy-btn");
      await userEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledWith("COPY THIS TEXT");
      await waitFor(() => {
        expect(screen.getByText("Copied to clipboard!")).toBeInTheDocument();
      });
    });

    it("clears input and result when clear button is clicked", async () => {
      renderWithTheme(<TextUtilityView />);
      const input = screen.getByTestId("text-utility-input");
      const applyBtn = screen.getByTestId("text-utility-apply-btn");
      const clearBtn = screen.getByTestId("text-utility-clear-btn");

      await userEvent.type(input, "sample text to clear");
      await userEvent.click(applyBtn);
      expect(screen.getByTestId("text-utility-result")).toHaveValue("SAMPLE TEXT TO CLEAR");

      await userEvent.click(clearBtn);
      expect(screen.getByTestId("text-utility-input")).toHaveValue("");
      expect(screen.getByTestId("text-utility-result")).toHaveValue("");
      expect(screen.getByTestId("metric-chars")).toHaveTextContent("0");
    });

    it("enforces character limit boundary on input", () => {
      const hugeText = "a".repeat(MAX_INPUT_CHARS + 500);
      useTextUtilityStore.getState().setInputText(hugeText);

      expect(useTextUtilityStore.getState().inputText.length).toBe(MAX_INPUT_CHARS);
    });
  });
});
