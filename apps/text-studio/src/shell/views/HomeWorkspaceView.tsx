import React, { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  Input,
  Text,
  Textarea,
  Title1,
  Title3,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { useThemeController } from "../../theme/ThemeContext";
import { useTextUtilityStore } from "../../features/text-utility/state";

export const HomeWorkspaceView: React.FC = () => {
  const navigate = useNavigate();
  const { tokens } = useThemeController();

  const [inputText, setInputText] = useState("");
  const [resultText, setResultText] = useState("");

  const handleTransform = (mode: "uppercase" | "lowercase" | "titlecase" | "normalize") => {
    let res = inputText;
    if (mode === "uppercase") {
      res = inputText.toUpperCase();
    } else if (mode === "lowercase") {
      res = inputText.toLowerCase();
    } else if (mode === "titlecase") {
      res = inputText.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    } else if (mode === "normalize") {
      res = inputText.trim().replace(/\s+/g, " ");
    }
    setResultText(res);
  };

  return (
    <div
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Title1>Prime Text Studio</Title1>
          <Badge appearance="filled" color="brand">
            v0.1.0
          </Badge>
        </div>
        <Text size={400} style={{ color: tokens.text.secondaryText }}>
          Focused Fluent text transformation and developer string manipulation studio.
        </Text>
      </div>

      <Divider />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        <Card style={{ padding: "16px" }}>
          <Title3>Text Utility</Title3>
          <Text size={300} style={{ color: tokens.text.secondaryText, marginBottom: "12px" }}>
            Comprehensive string transformations, case conversions, and whitespace normalization.
          </Text>
          <Button
            appearance="primary"
            onClick={() => navigate("/text-utility")}
          >
            Open Text Utility
          </Button>
        </Card>

        <Card style={{ padding: "16px" }}>
          <Title3>Diagnostics & Health</Title3>
          <Text size={300} style={{ color: tokens.text.secondaryText, marginBottom: "12px" }}>
            Local, privacy-preserving diagnostics and application health inspection.
          </Text>
          <Button
            appearance="secondary"
            onClick={() => navigate("/diagnostics")}
          >
            Open Diagnostics
          </Button>
        </Card>
      </div>

      <Card style={{ padding: "20px" }}>
        <Title3 style={{ marginBottom: "16px" }}>Quick Transform Workbench</Title3>
        <Field label="Input Text" style={{ marginBottom: "12px" }}>
          <Textarea
            value={inputText}
            onChange={(_, d) => setInputText(d.value)}
            placeholder="Type or paste text to transform..."
            rows={4}
          />
        </Field>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <Button
            size="small"
            appearance="outline"
            disabled={!inputText}
            onClick={() => handleTransform("uppercase")}
          >
            UPPERCASE
          </Button>
          <Button
            size="small"
            appearance="outline"
            disabled={!inputText}
            onClick={() => handleTransform("lowercase")}
          >
            lowercase
          </Button>
          <Button
            size="small"
            appearance="outline"
            disabled={!inputText}
            onClick={() => handleTransform("titlecase")}
          >
            Title Case
          </Button>
          <Button
            size="small"
            appearance="outline"
            disabled={!inputText}
            onClick={() => handleTransform("normalize")}
          >
            Normalize Whitespace
          </Button>
          <Button
            size="small"
            appearance="subtle"
            disabled={!inputText && !resultText}
            onClick={() => {
              setInputText("");
              setResultText("");
            }}
          >
            Clear
          </Button>
        </div>

        {resultText && (
          <Field label="Transformed Output">
            <Textarea value={resultText} readOnly rows={4} />
          </Field>
        )}
      </Card>
    </div>
  );
};
