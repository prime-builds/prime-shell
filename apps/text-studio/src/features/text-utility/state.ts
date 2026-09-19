import { create } from "zustand";
import { applyTransform, inspectText, MAX_INPUT_CHARS, type TextInspectionMetrics, type TextTransformMode } from "./transform";
import { useSettingsStore } from "../../shell/state/useSettingsStore";

interface TextUtilityState {
  inputText: string;
  resultText: string;
  mode: TextTransformMode;
  defaultMode: TextTransformMode;
  metrics: TextInspectionMetrics;
  copyFeedback: string;

  setInputText: (text: string) => void;
  setMode: (mode: TextTransformMode) => void;
  setDefaultMode: (mode: TextTransformMode) => void;
  apply: () => void;
  clear: () => void;
  setCopyFeedback: (feedback: string) => void;
}

export const useTextUtilityStore = create<TextUtilityState>((set, get) => ({
  inputText: "",
  resultText: "",
  mode: "uppercase",
  defaultMode: "uppercase",
  metrics: inspectText(""),
  copyFeedback: "",

  setInputText: (text: string) => {
    const bounded = text.slice(0, MAX_INPUT_CHARS);
    set({
      inputText: bounded,
      metrics: inspectText(bounded),
    });
  },

  setMode: (mode: TextTransformMode) => {
    set({ mode });
  },

  setDefaultMode: (defaultMode: TextTransformMode) => {
    set({ defaultMode, mode: defaultMode });
    useSettingsStore.getState().updateTextUtility({ defaultMode });
  },

  apply: () => {
    const { inputText, mode } = get();
    if (!inputText) {
      set({ resultText: "" });
      return;
    }
    const result = applyTransform(inputText, mode);
    set({ resultText: result });
  },

  clear: () => {
    const { defaultMode } = get();
    set({
      inputText: "",
      resultText: "",
      mode: defaultMode,
      metrics: inspectText(""),
      copyFeedback: "",
    });
  },

  setCopyFeedback: (copyFeedback: string) => {
    set({ copyFeedback });
  },
}));

useSettingsStore.subscribe((settingsState) => {
  const mode = settingsState.document.textUtility.defaultMode as TextTransformMode;
  if (mode && mode !== useTextUtilityStore.getState().defaultMode) {
    useTextUtilityStore.setState({ defaultMode: mode, mode });
  }
});

