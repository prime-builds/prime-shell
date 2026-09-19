import { describe, expect, it } from "vitest";
import { getContrastRatio } from "../src/accent";
import { semanticDarkTokens } from "../src/semantic-dark";
import { semanticLightTokens } from "../src/semantic-light";

describe("WCAG 2.2 AA Contrast Matrix Tests", () => {
  describe("Light Theme Contrast Compliance", () => {
    const ws = semanticLightTokens.surfaces.mainWorkspace;

    it("primary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticLightTokens.text.primaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("secondary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticLightTokens.text.secondaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("tertiary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticLightTokens.text.tertiaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on accent background meets minimum WCAG AA component contrast (>= 4.5:1)", () => {
      const ratio = getContrastRatio(
        semanticLightTokens.accent.onAccentForeground,
        semanticLightTokens.accent.accentBackground,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accent link foreground on workspace meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticLightTokens.accent.accentLinkForeground, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("status messages meet WCAG AA on their subtle backgrounds (>= 4.5:1)", () => {
      const dangerRatio = getContrastRatio(
        semanticLightTokens.status.dangerForeground,
        semanticLightTokens.status.dangerSubtleBackground,
      );
      expect(dangerRatio).toBeGreaterThanOrEqual(4.5);

      const successRatio = getContrastRatio(
        semanticLightTokens.status.successForeground,
        semanticLightTokens.status.successSubtleBackground,
      );
      expect(successRatio).toBeGreaterThanOrEqual(4.5);

      const warningRatio = getContrastRatio(
        semanticLightTokens.status.warningForeground,
        semanticLightTokens.status.warningSubtleBackground,
      );
      expect(warningRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("dual-tone focus strokes have high internal contrast (>= 3.0:1)", () => {
      const ratio = getContrastRatio(
        semanticLightTokens.accent.focusStrokeInner,
        semanticLightTokens.accent.focusStrokeOuter,
      );
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("Dark Theme Contrast Compliance", () => {
    const ws = semanticDarkTokens.surfaces.mainWorkspace;

    it("primary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticDarkTokens.text.primaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("secondary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticDarkTokens.text.secondaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("tertiary text meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticDarkTokens.text.tertiaryText, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("text on accent background meets minimum WCAG AA component contrast (>= 4.5:1)", () => {
      const ratio = getContrastRatio(
        semanticDarkTokens.accent.onAccentForeground,
        semanticDarkTokens.accent.accentBackground,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("accent link foreground on workspace meets WCAG AA (>= 4.5:1)", () => {
      const ratio = getContrastRatio(semanticDarkTokens.accent.accentLinkForeground, ws);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("status messages meet WCAG AA on their subtle backgrounds (>= 4.5:1)", () => {
      const dangerRatio = getContrastRatio(
        semanticDarkTokens.status.dangerForeground,
        semanticDarkTokens.status.dangerSubtleBackground,
      );
      expect(dangerRatio).toBeGreaterThanOrEqual(4.5);

      const successRatio = getContrastRatio(
        semanticDarkTokens.status.successForeground,
        semanticDarkTokens.status.successSubtleBackground,
      );
      expect(successRatio).toBeGreaterThanOrEqual(4.5);

      const warningRatio = getContrastRatio(
        semanticDarkTokens.status.warningForeground,
        semanticDarkTokens.status.warningSubtleBackground,
      );
      expect(warningRatio).toBeGreaterThanOrEqual(4.5);
    });

    it("dual-tone focus strokes have high internal contrast (>= 3.0:1)", () => {
      const ratio = getContrastRatio(
        semanticDarkTokens.accent.focusStrokeInner,
        semanticDarkTokens.accent.focusStrokeOuter,
      );
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("Named WCAG Exemptions", () => {
    it("disabled text is explicitly documented under WCAG 2.2 SC 1.4.3 exemption", () => {
      // Disabled controls have lower contrast by design, which is explicitly allowed by WCAG
      const lightDisabledRatio = getContrastRatio(
        semanticLightTokens.text.disabledText,
        semanticLightTokens.surfaces.mainWorkspace,
      );
      expect(lightDisabledRatio).toBeGreaterThan(1.5);

      const darkDisabledRatio = getContrastRatio(
        semanticDarkTokens.text.disabledText,
        semanticDarkTokens.surfaces.mainWorkspace,
      );
      expect(darkDisabledRatio).toBeGreaterThan(1.5);
    });
  });
});
