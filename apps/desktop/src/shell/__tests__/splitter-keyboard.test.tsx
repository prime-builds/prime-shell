import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Splitter } from "../layout/Splitter";

afterEach(cleanup);

describe("Splitter Accessible Keyboard & Pointer Interaction", () => {
  it("renders with correct ARIA separator attributes", () => {
    render(
      <Splitter
        orientation="vertical"
        currentValue={280}
        minValue={220}
        maxValue={400}
        label="Test Splitter"
        onChange={vi.fn()}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Test Splitter" });
    expect(splitter).toBeInTheDocument();
    expect(splitter).toHaveAttribute("aria-orientation", "vertical");
    expect(splitter).toHaveAttribute("aria-valuenow", "280");
    expect(splitter).toHaveAttribute("aria-valuemin", "220");
    expect(splitter).toHaveAttribute("aria-valuemax", "400");
    expect(splitter).toHaveAttribute("tabindex", "0");
  });

  it("adjusts value using Arrow keys (step = 8px)", async () => {
    const handleChange = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={280}
        minValue={220}
        maxValue={400}
        step={8}
        label="Test Splitter"
        onChange={handleChange}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Test Splitter" });
    splitter.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith(288);

    await userEvent.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith(272);
  });

  it("adjusts value using Shift + Arrow keys (largeStep = 32px)", async () => {
    const handleChange = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={280}
        minValue={220}
        maxValue={400}
        step={8}
        largeStep={32}
        label="Test Splitter"
        onChange={handleChange}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Test Splitter" });
    splitter.focus();

    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(handleChange).toHaveBeenCalledWith(312);

    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(handleChange).toHaveBeenCalledWith(248);
  });

  it("handles Home and End keys for min and max bounds", async () => {
    const handleChange = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={280}
        minValue={220}
        maxValue={400}
        label="Test Splitter"
        onChange={handleChange}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Test Splitter" });
    splitter.focus();

    await userEvent.keyboard("{Home}");
    expect(handleChange).toHaveBeenCalledWith(220);

    await userEvent.keyboard("{End}");
    expect(handleChange).toHaveBeenCalledWith(400);
  });

  it("triggers onToggleCollapse when pressing Enter or Space", async () => {
    const handleToggle = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={280}
        minValue={220}
        maxValue={400}
        label="Test Splitter"
        onChange={vi.fn()}
        onToggleCollapse={handleToggle}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Test Splitter" });
    splitter.focus();

    await userEvent.keyboard("{Enter}");
    expect(handleToggle).toHaveBeenCalledTimes(1);

    await userEvent.keyboard(" ");
    expect(handleToggle).toHaveBeenCalledTimes(2);
  });

  it("handles inverted orientation for right inspector and bottom panels", async () => {
    const handleChange = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={340}
        minValue={280}
        maxValue={480}
        step={8}
        inverted={true}
        label="Inspector Splitter"
        onChange={handleChange}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Inspector Splitter" });
    splitter.focus();

    // Inverted: ArrowLeft increases width, ArrowRight decreases width
    await userEvent.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith(348);

    await userEvent.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenCalledWith(332);
  });

  it("clamps values to [minValue, maxValue]", async () => {
    const handleChange = vi.fn();
    render(
      <Splitter
        orientation="vertical"
        currentValue={222}
        minValue={220}
        maxValue={400}
        step={8}
        label="Clamping Splitter"
        onChange={handleChange}
      />,
    );

    const splitter = screen.getByRole("separator", { name: "Clamping Splitter" });
    splitter.focus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenCalledWith(220); // clamped to min
  });
});
