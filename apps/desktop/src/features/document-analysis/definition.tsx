import React from "react";
import {
  DocumentSearch24Filled,
  DocumentSearch24Regular,
} from "@fluentui/react-icons";
import type { FeatureDefinition } from "../contracts";
import { DocumentAnalysisView } from "../../shell/views/DocumentAnalysisView";
import { useDocumentAnalysisStore } from "../../shell/state/useDocumentAnalysisStore";

export const documentAnalysisFeature: FeatureDefinition = {
  id: "document-analysis",
  name: "Document Analysis",
  routes: [
    {
      id: "document-analysis-route",
      path: "/analysis",
      title: "Document Analysis",
      element: <DocumentAnalysisView />,
    },
  ],
  navigation: [
    {
      id: "analysis",
      label: "Document Analysis",
      path: "/analysis",
      iconRegular: DocumentSearch24Regular,
      iconFilled: DocumentSearch24Filled,
      order: 10,
      ariaLabel: "Document Analysis",
    },
  ],
  commands: [
    {
      id: "docAnalysis.openDocument",
      title: "Open Document for Analysis",
      description: "Open a document via file picker to analyze",
      category: "Document Analysis",
      shortcut: "Ctrl+O",
      execute: async () => {
        await useDocumentAnalysisStore.getState().openDocument();
      },
    },
    {
      id: "docAnalysis.runAnalysis",
      title: "Run Document Analysis",
      description: "Execute analysis task on currently opened document",
      category: "Document Analysis",
      shortcut: "Ctrl+Shift+A",
      isEnabled: () => {
        const state = useDocumentAnalysisStore.getState();
        return Boolean(state.selectedDocument && !state.isAnalyzing);
      },
      execute: async () => {
        await useDocumentAnalysisStore.getState().runAnalysis();
      },
    },
    {
      id: "docAnalysis.closeDocument",
      title: "Close Current Document",
      description: "Close the loaded document and clear analysis state",
      category: "Document Analysis",
      shortcut: "Ctrl+Shift+C",
      isEnabled: () =>
        Boolean(useDocumentAnalysisStore.getState().selectedDocument),
      execute: () => {
        useDocumentAnalysisStore.getState().closeDocument();
      },
    },
  ],
  settings: [
    {
      id: "docAnalysis.maxTopTerms",
      section: "analysis",
      sectionTitle: "Document Analysis",
      label: "Top Terms Limit",
      description:
        "Maximum number of frequent terms to extract and rank in analysis histograms (default: 20).",
      type: "enum",
      options: [
        { label: "10 terms", value: 10 },
        { label: "20 terms (Default)", value: 20 },
        { label: "50 terms", value: 50 },
      ],
      defaultValue: 20,
      getValue: () => useDocumentAnalysisStore.getState().maxTopTerms,
      setValue: (val) =>
        useDocumentAnalysisStore.getState().setMaxTopTerms(Number(val)),
      reset: () => useDocumentAnalysisStore.getState().setMaxTopTerms(20),
    },
  ],
  requiredOperations: ["doc.analyze"],
};
