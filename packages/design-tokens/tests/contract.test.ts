import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultBrandRamp,
  densityTokens,
  generateBrandRamp,
  resolveAccentTokens,
  resolveMaterialFallback,
  semanticDarkTokens,
  semanticLightTokens,
  validateCustomSeed,
} from "../src";
import lightSnapshot from "../snapshots/light.json";
import darkSnapshot from "../snapshots/dark.json";
import provenance from "../snapshots/provenance.json";

describe("Design Tokens Contract & Drift Tests", () => {
  it("semanticLightTokens exactly matches light.json snapshot", () => {
    expect(JSON.parse(JSON.stringify(semanticLightTokens))).toEqual(lightSnapshot);
  });

  it("semanticDarkTokens exactly matches dark.json snapshot", () => {
    expect(JSON.parse(JSON.stringify(semanticDarkTokens))).toEqual(darkSnapshot);
  });

  it("provenance.json SHA-256 hashes match snapshot files", () => {
    const lightPath = path.resolve(__dirname, "../snapshots/light.json");
    const darkPath = path.resolve(__dirname, "../snapshots/dark.json");

    const lightHash = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(lightPath)).digest("hex")}`;
    const darkHash = `sha256:${crypto.createHash("sha256").update(fs.readFileSync(darkPath)).digest("hex")}`;

    expect(provenance.snapshotHashes["light.json"]).toBe(lightHash);
    expect(provenance.snapshotHashes["dark.json"]).toBe(darkHash);
  });

  it("densityTokens defines comfortable and compact settings", () => {
    expect(densityTokens.comfortable.controlHeight).toBe("32px");
    expect(densityTokens.compact.controlHeight).toBe("24px");
    expect(densityTokens.comfortable.fontSizeBase).toBe("14px");
    expect(densityTokens.compact.fontSizeBase).toBe("12px");
  });

  it("defaultBrandRamp has all 16 Fluent brand variants", () => {
    const variants = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;
    for (const v of variants) {
      expect(defaultBrandRamp[v]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("generates deterministic brand ramp from seed color", () => {
    const rampA = generateBrandRamp("#0078D4");
    const rampB = generateBrandRamp("#0078D4");
    expect(rampA).toEqual(rampB);
    expect(rampA[80]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("validates and rejects invalid or low-contrast custom seeds", () => {
    const validSeed = validateCustomSeed("#0F6CBD");
    expect(validSeed.valid).toBe(true);

    const nearWhite = validateCustomSeed("#FAFAFA");
    expect(nearWhite.valid).toBe(false);
    expect(nearWhite.reason).toContain("too light");

    const nearBlack = validateCustomSeed("#050505");
    expect(nearBlack.valid).toBe(false);
    expect(nearBlack.reason).toContain("too dark");

    const invalidHex = validateCustomSeed("not-a-color");
    expect(invalidHex.valid).toBe(false);
  });

  it("resolves accent tokens for light and dark themes", () => {
    const lightResolved = resolveAccentTokens({ mode: "default" }, "light");
    expect(lightResolved.tokens.accentBackground).toBe(defaultBrandRamp[80]);
    expect(lightResolved.tokens.onAccentForeground).toBe("#FFFFFF");

    const darkResolved = resolveAccentTokens({ mode: "default" }, "dark");
    expect(darkResolved.tokens.accentBackground).toBe(defaultBrandRamp[70]);
    expect(darkResolved.tokens.onAccentForeground).toBe("#FFFFFF");
  });

  it("resolves material fallback deterministically", () => {
    // Solid preference
    const solid = resolveMaterialFallback("solid", {
      mica: true,
      micaAlt: true,
      transparencyEnabled: true,
      forcedColors: false,
      reducedTransparency: false,
    });
    expect(solid.effectiveMaterial).toBe("solid");
    expect(solid.isFallback).toBe(false);

    // Forced colors forces solid fallback
    const forced = resolveMaterialFallback("mica", {
      mica: true,
      micaAlt: true,
      transparencyEnabled: true,
      forcedColors: true,
      reducedTransparency: false,
    });
    expect(forced.effectiveMaterial).toBe("solid");
    expect(forced.isFallback).toBe(true);
    expect(forced.reason).toContain("forced colors");

    // Reduced transparency forces solid fallback
    const reducedTrans = resolveMaterialFallback("mica", {
      mica: true,
      micaAlt: true,
      transparencyEnabled: true,
      forcedColors: false,
      reducedTransparency: true,
    });
    expect(reducedTrans.effectiveMaterial).toBe("solid");
    expect(reducedTrans.isFallback).toBe(true);

    // Unsupported system forces solid fallback
    const unsupported = resolveMaterialFallback("mica", {
      mica: false,
      micaAlt: false,
      transparencyEnabled: true,
      forcedColors: false,
      reducedTransparency: false,
      reason: "unsupported",
    });
    expect(unsupported.effectiveMaterial).toBe("solid");
    expect(unsupported.isFallback).toBe(true);

    // Supported mica works
    const micaSupported = resolveMaterialFallback("mica", {
      mica: true,
      micaAlt: true,
      transparencyEnabled: true,
      forcedColors: false,
      reducedTransparency: false,
    });
    expect(micaSupported.effectiveMaterial).toBe("mica");
    expect(micaSupported.isFallback).toBe(false);
  });
});
