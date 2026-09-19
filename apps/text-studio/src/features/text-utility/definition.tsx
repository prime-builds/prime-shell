import React from "react";
import { TextQuote24Filled, TextQuote24Regular } from "@fluentui/react-icons";
import type { FeatureDefinition } from "../contracts";
import { useTextUtilityStore } from "./state";
import { TextUtilityView } from "./TextUtilityView";
import type { TextTransformMode } from "./transform";

export const textUtilityFeature: FeatureDefinition = {
  id: "text-utility",
  name: "Text Utility",
  routes: [
    {
      id: "text-utility-route",
      path: "/text-utility",
      title: "Text Utility",
      element: <TextUtilityView />,
    },
  ],
  navigation: [
    {
      id: "text-utility",
      label: "Text Utility",
      path: "/text-utility",
      iconRegular: TextQuote24Regular,
      iconFilled: TextQuote24Filled,
      order: 20,
      ariaLabel: "Text Utility",
    },
  ],
  commands: [
    {
      id: "textUtility.applyTransform",
      title: "Apply Text Transform",
      description: "Apply selected transformation to input text",
      category: "Text Utility",
      shortcut: "Ctrl+Shift+T",
      isEnabled: () => Boolean(useTextUtilityStore.getState().inputText),
      execute: () => {
        useTextUtilityStore.getState().apply();
      },
    },
    {
      id: "textUtility.clearText",
      title: "Clear Text Utility",
      description: "Clear input and result text",
      category: "Text Utility",
      shortcut: "Ctrl+Shift+X",
      isEnabled: () =>
        Boolean(
          useTextUtilityStore.getState().inputText ||
            useTextUtilityStore.getState().resultText,
        ),
      execute: () => {
        useTextUtilityStore.getState().clear();
      },
    },
  ],
  settings: [
    {
      id: "textUtility.defaultMode",
      section: "text-utility",
      sectionTitle: "Text Utility",
      label: "Default Transformation Mode",
      description:
        "Initial transformation mode selected when opening the text utility.",
      type: "enum",
      options: [
        { label: "UPPERCASE", value: "uppercase" },
        { label: "lowercase", value: "lowercase" },
        { label: "Title Case", value: "titlecase" },
        { label: "Normalize Whitespace", value: "normalize-whitespace" },
      ],
      defaultValue: "uppercase",
      getValue: () => useTextUtilityStore.getState().defaultMode,
      setValue: (val) =>
        useTextUtilityStore.getState().setDefaultMode(val as TextTransformMode),
      reset: () => useTextUtilityStore.getState().setDefaultMode("uppercase"),
    },
  ],
  requiredOperations: [],
};
