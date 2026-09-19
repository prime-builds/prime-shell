import type React from "react";

export const BACKEND_OPERATION_NAMES = [
  "spike.echo",
  "spike.count",
  "spike.crash",
  "spike.hang",
  "spike.largeRejected",
  "doc.analyze",
] as const;

export type BackendOperationName = (typeof BACKEND_OPERATION_NAMES)[number];

export interface RouteContribution {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly element: React.ReactElement;
  readonly index?: boolean;
}

export interface NavigationContribution {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly iconRegular: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly iconFilled: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly order?: number;
  readonly ariaLabel?: string;
}

export interface CommandContribution {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly shortcut?: string; // e.g. "Ctrl+Shift+T"
  readonly isEnabled?: () => boolean;
  readonly execute: () => void | Promise<void>;
}

export interface SettingOption {
  readonly label: string;
  readonly value: string | number | boolean;
}

export interface SettingContribution {
  readonly id: string;
  readonly section: string;
  readonly sectionTitle: string;
  readonly label: string;
  readonly description?: string;
  readonly type: "boolean" | "enum" | "number";
  readonly options?: readonly SettingOption[];
  readonly defaultValue: string | number | boolean;
  readonly getValue: () => string | number | boolean;
  readonly setValue: (value: string | number | boolean) => void;
  readonly reset: () => void;
}

export interface FeatureDefinition {
  readonly id: string;
  readonly name: string;
  readonly routes: readonly RouteContribution[];
  readonly navigation?: readonly NavigationContribution[];
  readonly commands?: readonly CommandContribution[];
  readonly settings?: readonly SettingContribution[];
  readonly requiredOperations?: readonly string[];
}
