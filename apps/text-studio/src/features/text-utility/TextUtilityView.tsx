import React, { useCallback, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  makeStyles,
  Select,
  Text,
  Textarea,
  Title1,
  Title2,
  tokens,
  Tooltip,
} from "@fluentui/react-components";
import {
  Copy20Regular,
  Dismiss20Regular,
  Play20Regular,
} from "@fluentui/react-icons";
import { useTextUtilityStore } from "./state";
import { MAX_INPUT_CHARS, type TextTransformMode } from "./transform";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    width: "100%",
    maxWidth: "1100px",
    margin: "0 auto",
    boxSizing: "border-box",
    minHeight: 0,
    overflowY: "auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
  },
  headerTitleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
  },
  metricCard: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  editorSection: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "16px",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  controlsRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  feedbackText: {
    color: tokens.colorStatusSuccessForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export const TextUtilityView: React.FC = () => {
  const styles = useStyles();

  const inputText = useTextUtilityStore((s) => s.inputText);
  const resultText = useTextUtilityStore((s) => s.resultText);
  const mode = useTextUtilityStore((s) => s.mode);
  const metrics = useTextUtilityStore((s) => s.metrics);
  const copyFeedback = useTextUtilityStore((s) => s.copyFeedback);

  const setInputText = useTextUtilityStore((s) => s.setInputText);
  const setMode = useTextUtilityStore((s) => s.setMode);
  const apply = useTextUtilityStore((s) => s.apply);
  const clear = useTextUtilityStore((s) => s.clear);
  const setCopyFeedback = useTextUtilityStore((s) => s.setCopyFeedback);

  const [copying, setCopying] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!resultText) return;
    try {
      setCopying(true);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(resultText);
      }
      setCopyFeedback("Copied to clipboard!");
      setTimeout(() => setCopyFeedback(""), 2500);
    } catch {
      setCopyFeedback("Failed to copy.");
      setTimeout(() => setCopyFeedback(""), 2500);
    } finally {
      setCopying(false);
    }
  }, [resultText, setCopyFeedback]);

  return (
    <div className={styles.container} data-testid="text-utility-view">
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <Title1 as="h1">Text Utility</Title1>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Deterministic local text transformation, formatting, and live inspection.
          </Text>
        </div>

        <div className={styles.headerActions} role="toolbar" aria-label="Text Utility Actions">
          <Button
            appearance="primary"
            icon={<Play20Regular />}
            onClick={apply}
            disabled={!inputText}
            data-testid="text-utility-apply-btn"
          >
            Apply Transform (Ctrl+Shift+T)
          </Button>

          <Button
            appearance="secondary"
            icon={<Dismiss20Regular />}
            onClick={clear}
            disabled={!inputText && !resultText}
            data-testid="text-utility-clear-btn"
          >
            Clear (Ctrl+Shift+X)
          </Button>
        </div>
      </header>

      {/* Metrics Bar */}
      <div className={styles.metricsGrid} role="region" aria-label="Text Metrics">
        <div className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Characters
          </Text>
          <Text size={500} weight="semibold" data-testid="metric-chars">
            {metrics.characterCount.toLocaleString()}
          </Text>
        </div>

        <div className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Words
          </Text>
          <Text size={500} weight="semibold" data-testid="metric-words">
            {metrics.wordCount.toLocaleString()}
          </Text>
        </div>

        <div className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Lines
          </Text>
          <Text size={500} weight="semibold" data-testid="metric-lines">
            {metrics.lineCount.toLocaleString()}
          </Text>
        </div>

        <div className={styles.metricCard}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Byte Length
          </Text>
          <Text size={500} weight="semibold" data-testid="metric-bytes">
            {metrics.byteLength.toLocaleString()} B
          </Text>
        </div>
      </div>

      {/* Controls Bar */}
      <Card className={styles.controlsRow} role="region" aria-label="Transformation Mode">
        <Field label="Transformation Mode" style={{ minWidth: "220px" }}>
          <Select
            value={mode}
            onChange={(_, data) => setMode(data.value as TextTransformMode)}
            data-testid="text-utility-mode-select"
            aria-label="Select transformation mode"
          >
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="titlecase">Title Case</option>
            <option value="normalize-whitespace">Normalize Whitespace</option>
          </Select>
        </Field>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <Text size={200} weight="semibold">
            Input Limit:
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {inputText.length} / {MAX_INPUT_CHARS.toLocaleString()} characters
          </Text>
        </div>
      </Card>

      {/* Dual Panel Editor: Input and Result */}
      <div className={styles.editorSection}>
        {/* Input Panel */}
        <section className={styles.panel} aria-label="Input Text Section">
          <div className={styles.panelHeader}>
            <Title2 as="h2">
              Input Text
            </Title2>
            <Badge appearance="tint" color="brand">
              Source
            </Badge>
          </div>

          <Textarea
            value={inputText}
            onChange={(_, data) => setInputText(data.value)}
            placeholder="Type or paste text to transform or inspect..."
            className={styles.textarea}
            textarea={{ "aria-label": "Input text area" }}
            data-testid="text-utility-input"
          />
        </section>

        {/* Result Panel */}
        <section className={styles.panel} aria-label="Result Text Section">
          <div className={styles.panelHeader}>
            <Title2 as="h2">
              Result Preview
            </Title2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {copyFeedback && (
                <Text size={200} className={styles.feedbackText} role="status">
                  {copyFeedback}
                </Text>
              )}
              <Tooltip content="Copy Result to Clipboard" relationship="label">
                <Button
                  appearance="subtle"
                  icon={<Copy20Regular />}
                  onClick={handleCopy}
                  disabled={!resultText || copying}
                  aria-label="Copy Result"
                  data-testid="text-utility-copy-btn"
                />
              </Tooltip>
            </div>
          </div>

          <Textarea
            readOnly
            value={resultText}
            placeholder={
              inputText
                ? "Click 'Apply Transform' to see the transformed output..."
                : "No input text provided."
            }
            className={styles.textarea}
            textarea={{ "aria-label": "Result text area" }}
            data-testid="text-utility-result"
          />
        </section>
      </div>
    </div>
  );
};
