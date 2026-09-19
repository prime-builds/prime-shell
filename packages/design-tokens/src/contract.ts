export interface SemanticSurfaceTokens {
  appShell: string;
  titleBar: string;
  navigationRail: string;
  contextSidebar: string;
  mainWorkspace: string;
  inspector: string;
  bottomPanel: string;
  cardElevated: string;
  codeTerminal: string;
  panelBorder: string;
  subtleDivider: string;
  overlay: string;
}

export interface SemanticTextTokens {
  primaryText: string;
  secondaryText: string;
  tertiaryText: string;
  disabledText: string;
}

export interface SemanticInteractionTokens {
  subtleHover: string;
  subtlePressed: string;
  subtleSelected: string;
  workspaceHover: string;
  workspacePressed: string;
  disabledSurface: string;
}

export interface AccentTokens {
  accentBackground: string;
  accentBackgroundHover: string;
  accentBackgroundPressed: string;
  onAccentForeground: string;
  accentLinkForeground: string;
  accentSubtleBackground: string;
  focusStrokeInner: string;
  focusStrokeOuter: string;
}

export interface StatusTokens {
  dangerForeground: string;
  dangerSubtleBackground: string;
  successForeground: string;
  successSubtleBackground: string;
  warningForeground: string;
  warningSubtleBackground: string;
}

export type BrandVariants = {
  10: string;
  20: string;
  30: string;
  40: string;
  50: string;
  60: string;
  70: string;
  80: string;
  90: string;
  100: string;
  110: string;
  120: string;
  130: string;
  140: string;
  150: string;
  160: string;
};

export interface ThemeTokens {
  surfaces: SemanticSurfaceTokens;
  text: SemanticTextTokens;
  interaction: SemanticInteractionTokens;
  accent: AccentTokens;
  status: StatusTokens;
}

export type ThemeMode = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export type AccentMode =
  | { mode: "system" }
  | { mode: "default" }
  | { mode: "custom"; seedColor: string };

export type DensityMode = "comfortable" | "compact";

export interface DensityTokens {
  controlHeight: string;
  paddingHorizontal: string;
  paddingVertical: string;
  fontSizeBase: string;
  lineHeightBase: string;
  gap: string;
}

export type WindowMaterialPreference = "system" | "solid" | "mica" | "micaAlt";

export interface MaterialCapabilities {
  mica: boolean;
  micaAlt: boolean;
  transparencyEnabled: boolean;
  forcedColors: boolean;
  reducedTransparency: boolean;
  reason?: "unsupported" | "user-disabled" | "accessibility" | "remote-session" | "battery" | "error";
}

export interface AccessibilityPreferences {
  prefersReducedMotion: boolean;
  prefersReducedTransparency: boolean;
  forcedColors: boolean;
}
