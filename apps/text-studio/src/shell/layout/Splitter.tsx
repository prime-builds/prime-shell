import React, { useCallback, useRef, useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

interface SplitterProps {
  orientation: "vertical" | "horizontal";
  currentValue: number;
  minValue: number;
  maxValue: number;
  step?: number;
  largeStep?: number;
  label: string;
  onChange: (newValue: number) => void;
  onToggleCollapse?: () => void;
  inverted?: boolean; // If true, dragging right/down decreases value (e.g., right inspector or bottom panel)
}

const useStyles = makeStyles({
  splitterVertical: {
    width: "6px",
    cursor: "col-resize",
    backgroundColor: "transparent",
    position: "relative",
    flexShrink: 0,
    zIndex: 10,
    touchAction: "none",
    userSelect: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus1}`,
      outlineOffset: "-1px",
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
    "::after": {
      content: '""',
      position: "absolute",
      top: 0,
      bottom: 0,
      left: "2px",
      width: "1px",
      backgroundColor: tokens.colorNeutralStroke2,
    },
  },
  splitterHorizontal: {
    height: "6px",
    cursor: "row-resize",
    backgroundColor: "transparent",
    position: "relative",
    flexShrink: 0,
    zIndex: 10,
    touchAction: "none",
    userSelect: "none",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ":focus-visible": {
      outline: `2px solid ${tokens.colorStrokeFocus1}`,
      outlineOffset: "-1px",
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
    "::after": {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      top: "2px",
      height: "1px",
      backgroundColor: tokens.colorNeutralStroke2,
    },
  },
  active: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
  },
});

export const Splitter: React.FC<SplitterProps> = ({
  orientation,
  currentValue,
  minValue,
  maxValue,
  step = 8,
  largeStep = 32,
  label,
  onChange,
  onToggleCollapse,
  inverted = false,
}) => {
  const styles = useStyles();
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);
  const startValRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(true);
      startPosRef.current = orientation === "vertical" ? e.clientX : e.clientY;
      startValRef.current = currentValue;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [currentValue, orientation],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      e.preventDefault();
      const currentPos = orientation === "vertical" ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      const effectiveDelta = inverted ? -delta : delta;
      const unclamped = startValRef.current + effectiveDelta;
      const clamped = Math.max(minValue, Math.min(maxValue, unclamped));
      onChange(clamped);
    },
    [inverted, isDragging, maxValue, minValue, onChange, orientation],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
    },
    [isDragging],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let delta = 0;
      const currentStep = e.shiftKey ? largeStep : step;

      if (orientation === "vertical") {
        if (e.key === "ArrowLeft") delta = inverted ? currentStep : -currentStep;
        if (e.key === "ArrowRight") delta = inverted ? -currentStep : currentStep;
      } else {
        if (e.key === "ArrowUp") delta = inverted ? currentStep : -currentStep;
        if (e.key === "ArrowDown") delta = inverted ? -currentStep : currentStep;
      }

      if (e.key === "Home") {
        e.preventDefault();
        onChange(minValue);
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        onChange(maxValue);
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (onToggleCollapse) {
          onToggleCollapse();
        }
        return;
      }

      if (delta !== 0) {
        e.preventDefault();
        const clamped = Math.max(minValue, Math.min(maxValue, currentValue + delta));
        onChange(clamped);
      }
    },
    [currentValue, inverted, largeStep, maxValue, minValue, onChange, onToggleCollapse, orientation, step],
  );

  const className = `${
    orientation === "vertical" ? styles.splitterVertical : styles.splitterHorizontal
  } ${isDragging ? styles.active : ""}`;

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-valuenow={Math.round(currentValue)}
      aria-valuemin={minValue}
      aria-valuemax={maxValue}
      aria-label={label}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={onToggleCollapse}
      title={`${label}: Drag or use Arrow keys to resize, double-click or press Enter to collapse`}
    />
  );
};
