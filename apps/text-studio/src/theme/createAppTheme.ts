import {
  createDarkTheme,
  createLightTheme,
  type Theme,
} from "@fluentui/react-components";
import type {
  BrandVariants,
  EffectiveTheme,
  ThemeTokens,
} from "@prime-shell/design-tokens";

export function createAppTheme(
  effectiveTheme: EffectiveTheme,
  tokens: ThemeTokens,
  brandRamp: BrandVariants,
): Theme {
  const baseTheme =
    effectiveTheme === "dark"
      ? createDarkTheme(brandRamp)
      : createLightTheme(brandRamp);

  return {
    ...baseTheme,
    // Accent roles
    colorBrandBackground: tokens.accent.accentBackground,
    colorBrandBackgroundHover: tokens.accent.accentBackgroundHover,
    colorBrandBackgroundPressed: tokens.accent.accentBackgroundPressed,
    colorNeutralForegroundOnBrand: tokens.accent.onAccentForeground,
    colorBrandForegroundLink: tokens.accent.accentLinkForeground,
    colorBrandBackground2: tokens.accent.accentSubtleBackground,
    colorStrokeFocus1: tokens.accent.focusStrokeInner,
    colorStrokeFocus2: tokens.accent.focusStrokeOuter,

    // Surface roles
    colorNeutralBackground1: tokens.surfaces.mainWorkspace,
    colorNeutralBackground2: tokens.surfaces.cardElevated,
    colorNeutralBackground3: tokens.surfaces.appShell,

    // Text roles
    colorNeutralForeground1: tokens.text.primaryText,
    colorNeutralForeground2: tokens.text.secondaryText,
    colorNeutralForeground3: tokens.text.tertiaryText,
    colorNeutralForegroundDisabled: tokens.text.disabledText,

    // Status roles
    colorPaletteRedForeground1: tokens.status.dangerForeground,
    colorPaletteRedBackground1: tokens.status.dangerSubtleBackground,
    colorPaletteGreenForeground1: tokens.status.successForeground,
    colorPaletteGreenBackground1: tokens.status.successSubtleBackground,
    colorPaletteMarigoldForeground1: tokens.status.warningForeground,
    colorPaletteMarigoldBackground1: tokens.status.warningSubtleBackground,
  };
}
