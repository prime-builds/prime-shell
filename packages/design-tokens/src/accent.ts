import type {
  AccentMode,
  AccentTokens,
  BrandVariants,
  EffectiveTheme,
} from "./contract";

export const defaultBrandRamp: BrandVariants = {
  10: "#061724",
  20: "#082338",
  30: "#0a2e4a",
  40: "#0c3b5e",
  50: "#0e4873",
  60: "#0f548c",
  70: "#115ea3",
  80: "#0f6cbd",
  90: "#2886de",
  100: "#479ef5",
  110: "#62abf5",
  120: "#77b7f7",
  130: "#96c6fa",
  140: "#b4d6fa",
  150: "#cfe4fa",
  160: "#ebf3fc",
};

export function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) {
    throw new Error(`Invalid 6-character hex color: "${hex}"`);
  }
  const num = parseInt(sanitized, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (val: number) => clamp(val).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hNorm = (h % 360 + 360) % 360 / 360;
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tNorm = t;
    if (tNorm < 0) tNorm += 1;
    if (tNorm > 1) tNorm -= 1;
    if (tNorm < 1 / 6) return p + (q - p) * 6 * tNorm;
    if (tNorm < 1 / 2) return q;
    if (tNorm < 2 / 3) return p + (q - p) * (2 / 3 - tNorm) * 6;
    return p;
  };

  return [
    Math.round(hue2rgb(hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(hNorm) * 255),
    Math.round(hue2rgb(hNorm - 1 / 3) * 255),
  ];
}

export function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const norm = c / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getContrastRatio(colorA: string, colorB: string): number {
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);
  const lum1 = getRelativeLuminance(r1, g1, b1);
  const lum2 = getRelativeLuminance(r2, g2, b2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

const BRAND_LIGHTNESS_STEPS: Record<keyof BrandVariants, number> = {
  10: 0.08,
  20: 0.12,
  30: 0.16,
  40: 0.21,
  50: 0.26,
  60: 0.32,
  70: 0.38,
  80: 0.44,
  90: 0.52,
  100: 0.62,
  110: 0.68,
  120: 0.74,
  130: 0.80,
  140: 0.86,
  150: 0.92,
  160: 0.96,
};

export function generateBrandRamp(seedHex: string): BrandVariants {
  const [r, g, b] = hexToRgb(seedHex);
  const [h, s] = rgbToHsl(r, g, b);
  // Ensure sufficient saturation for brand recognition
  const effectiveSat = Math.max(0.3, Math.min(0.9, s));

  const variants = {} as BrandVariants;
  const keys = Object.keys(BRAND_LIGHTNESS_STEPS).map(Number) as (keyof BrandVariants)[];

  for (const step of keys) {
    const targetL = BRAND_LIGHTNESS_STEPS[step];
    const [stepR, stepG, stepB] = hslToRgb(h, effectiveSat, targetL);
    variants[step] = rgbToHex(stepR, stepG, stepB);
  }

  return variants;
}

export function validateCustomSeed(seedHex: string): { valid: boolean; reason?: string; adjustedSeed?: string } {
  try {
    const [r, g, b] = hexToRgb(seedHex);
    const lum = getRelativeLuminance(r, g, b);
    // Extreme near-white or near-black seeds lack contrast headroom
    if (lum > 0.85) {
      return {
        valid: false,
        reason: "Seed color is too light to achieve required contrast for accent elements.",
      };
    }
    if (lum < 0.02) {
      return {
        valid: false,
        reason: "Seed color is too dark to achieve required contrast in dark theme.",
      };
    }

    const ramp = generateBrandRamp(seedHex);
    const lightOnAccentContrast = getContrastRatio("#FFFFFF", ramp[80]);
    const darkOnAccentContrast = getContrastRatio("#FFFFFF", ramp[70]);

    if (lightOnAccentContrast < 3.0 || darkOnAccentContrast < 3.0) {
      return {
        valid: false,
        reason: "Generated ramp fails minimum WCAG 3:1 UI component contrast ratio on accent.",
      };
    }

    return { valid: true, adjustedSeed: seedHex };
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "Invalid hex color format.",
    };
  }
}

export function resolveAccentTokens(
  mode: AccentMode,
  effectiveTheme: EffectiveTheme,
  systemAccentHex?: string | null,
): { tokens: AccentTokens; brandRamp: BrandVariants } {
  let effectiveRamp = defaultBrandRamp;

  if (mode.mode === "system" && systemAccentHex) {
    const validation = validateCustomSeed(systemAccentHex);
    if (validation.valid) {
      effectiveRamp = generateBrandRamp(systemAccentHex);
    }
  } else if (mode.mode === "custom") {
    const validation = validateCustomSeed(mode.seedColor);
    if (validation.valid) {
      effectiveRamp = generateBrandRamp(mode.seedColor);
    }
  }

  if (effectiveTheme === "light") {
    return {
      brandRamp: effectiveRamp,
      tokens: {
        accentBackground: effectiveRamp[80],
        accentBackgroundHover: effectiveRamp[70],
        accentBackgroundPressed: effectiveRamp[40],
        onAccentForeground: "#FFFFFF",
        accentLinkForeground: effectiveRamp[70],
        accentSubtleBackground: effectiveRamp[160],
        focusStrokeInner: "#FFFFFF",
        focusStrokeOuter: "#000000",
      },
    };
  }

  return {
    brandRamp: effectiveRamp,
    tokens: {
      accentBackground: effectiveRamp[70],
      accentBackgroundHover: effectiveRamp[80],
      accentBackgroundPressed: effectiveRamp[40],
      onAccentForeground: "#FFFFFF",
      accentLinkForeground: effectiveRamp[100],
      accentSubtleBackground: effectiveRamp[20],
      focusStrokeInner: "#000000",
      focusStrokeOuter: "#FFFFFF",
    },
  };
}
