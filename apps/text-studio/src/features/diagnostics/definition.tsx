import React from "react";
import {
  HeartPulse24Filled,
  HeartPulse24Regular,
} from "@fluentui/react-icons";
import type { FeatureDefinition } from "../contracts";
import { DiagnosticsShellView } from "../../shell/views/DiagnosticsShellView";
import { useDiagnosticsStore } from "../../shell/state/useDiagnosticsStore";

export const diagnosticsFeature: FeatureDefinition = {
  id: "diagnostics",
  name: "Diagnostics & Recovery",
  routes: [
    {
      id: "diagnostics-route",
      path: "/diagnostics",
      title: "Diagnostics & Recovery",
      element: <DiagnosticsShellView />,
    },
  ],
  navigation: [
    {
      id: "diagnostics",
      label: "Diagnostics",
      path: "/diagnostics",
      iconRegular: HeartPulse24Regular,
      iconFilled: HeartPulse24Filled,
      order: 90,
      ariaLabel: "Open Diagnostics and Recovery",
    },
  ],
  commands: [
    {
      id: "open-diagnostics",
      title: "Diagnostics: Open System Diagnostics",
      description: "Review system health, safe errors, and recovery tools.",
      category: "Diagnostics",
      execute: () => {
        window.location.hash = "#/diagnostics";
      },
    },
    {
      id: "recover-backend",
      title: "Diagnostics: Recover Backend",
      description: "Recover sidecar backend process within circuit breaker policy.",
      category: "Diagnostics",
      execute: async () => {
        await useDiagnosticsStore.getState().recoverBackend();
      },
    },
  ],
};
