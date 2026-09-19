import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AccentMode,
  type AccessibilityPreferences,
  type BrandVariants,
  type DensityMode,
  type EffectiveTheme,
  type MaterialCapabilities,
  type ResolvedMaterial,
  type ThemeMode,
  type ThemeTokens,
  type WindowMaterialPreference,
  resolveAccentTokens,
  resolveMaterialFallback,
  semanticDarkTokens,
  semanticLightTokens,
} from "@prime-shell/design-tokens";

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  effectiveTheme: EffectiveTheme;
  accentMode: AccentMode;
  setAccentMode: (mode: AccentMode) => void;
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  materialPreference: WindowMaterialPreference;
  setMaterialPreference: (pref: WindowMaterialPreference) => void;
  materialCapabilities: MaterialCapabilities;
  resolvedMaterial: ResolvedMaterial;
  accessibilityPreferences: AccessibilityPreferences;
  tokens: ThemeTokens;
  brandRamp: BrandVariants;
}

const defaultMaterialCapabilities: MaterialCapabilities = {
  mica: false,
  micaAlt: false,
  transparencyEnabled: false,
  forcedColors: false,
  reducedTransparency: false,
  reason: undefined,
};

import { useSettingsStore } from "../shell/state/useSettingsStore";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProviderContext: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const appearance = useSettingsStore((s) => s.document.appearance);
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  const themeMode = appearance.themeMode;
  const accentMode = appearance.accentMode;
  const density = appearance.density;
  const materialPreference = appearance.materialPreference;

  useEffect(() => {
    useSettingsStore.getState().loadSettings();
  }, []);

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  const [reducedTransparency, setReducedTransparency] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
    }
    return false;
  });

  const [forcedColors, setForcedColors] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(forced-colors: active)").matches;
    }
    return false;
  });

  const [materialCapabilities, setMaterialCapabilities] =
    useState<MaterialCapabilities>(defaultMaterialCapabilities);

  const [systemAccentHex, setSystemAccentHex] = useState<string | null>(null);

  // Sync media queries
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const transQuery = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const forcedQuery = window.matchMedia("(forced-colors: active)");

    const onDarkChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const onMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    const onTransChange = (e: MediaQueryListEvent) => setReducedTransparency(e.matches);
    const onForcedChange = (e: MediaQueryListEvent) => setForcedColors(e.matches);

    darkQuery.addEventListener("change", onDarkChange);
    motionQuery.addEventListener("change", onMotionChange);
    transQuery.addEventListener("change", onTransChange);
    forcedQuery.addEventListener("change", onForcedChange);

    return () => {
      darkQuery.removeEventListener("change", onDarkChange);
      motionQuery.removeEventListener("change", onMotionChange);
      transQuery.removeEventListener("change", onTransChange);
      forcedQuery.removeEventListener("change", onForcedChange);
    };
  }, []);

  // Fetch host system theme & material state from Rust
  useEffect(() => {
    let mounted = true;
    invoke<{
      systemTheme: string;
      systemAccent: string | null;
      materialCapabilities: MaterialCapabilities;
    }>("get_theme_state")
      .then((res) => {
        if (!mounted) return;
        if (res.systemAccent) setSystemAccentHex(res.systemAccent);
        if (res.materialCapabilities) {
          setMaterialCapabilities({
            ...res.materialCapabilities,
            forcedColors,
            reducedTransparency,
          });
        }
      })
      .catch(() => {
        // Fall back gracefully in mock/test environments
      });

    return () => {
      mounted = false;
    };
  }, [forcedColors, reducedTransparency]);

  const effectiveTheme: EffectiveTheme = useMemo(() => {
    if (themeMode === "dark") return "dark";
    if (themeMode === "light") return "light";
    return systemDark ? "dark" : "light";
  }, [themeMode, systemDark]);

  const { tokens, brandRamp } = useMemo(() => {
    const baseTokens =
      effectiveTheme === "dark" ? semanticDarkTokens : semanticLightTokens;
    const { tokens: accentTokens, brandRamp: ramp } = resolveAccentTokens(
      accentMode,
      effectiveTheme,
      systemAccentHex,
    );

    const mergedTokens: ThemeTokens = {
      ...baseTokens,
      accent: accentTokens,
    };

    return { tokens: mergedTokens, brandRamp: ramp };
  }, [effectiveTheme, accentMode, systemAccentHex]);

  const resolvedMaterial = useMemo(() => {
    return resolveMaterialFallback(materialPreference, {
      ...materialCapabilities,
      forcedColors,
      reducedTransparency,
    });
  }, [materialPreference, materialCapabilities, forcedColors, reducedTransparency]);

  // Synchronize native window background with effective theme
  useEffect(() => {
    const bgHex = tokens.surfaces.appShell;
    invoke("sync_native_window_theme", {
      effectiveTheme,
      backgroundHex: bgHex,
    }).catch(() => {
      // Ignore if running outside Tauri
    });
  }, [effectiveTheme, tokens.surfaces.appShell]);

  const setThemeMode = (mode: ThemeMode) => {
    updateAppearance({ themeMode: mode });
  };

  const setAccentMode = (mode: AccentMode) => {
    updateAppearance({ accentMode: mode });
  };

  const setDensity = (d: DensityMode) => {
    updateAppearance({ density: d });
  };

  const setMaterialPreference = (pref: WindowMaterialPreference) => {
    updateAppearance({ materialPreference: pref });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      setThemeMode,
      effectiveTheme,
      accentMode,
      setAccentMode,
      density,
      setDensity,
      materialPreference,
      setMaterialPreference,
      materialCapabilities,
      resolvedMaterial,
      accessibilityPreferences: {
        prefersReducedMotion: reducedMotion,
        prefersReducedTransparency: reducedTransparency,
        forcedColors,
      },
      tokens,
      brandRamp,
    }),
    [
      themeMode,
      effectiveTheme,
      accentMode,
      density,
      materialPreference,
      materialCapabilities,
      resolvedMaterial,
      reducedMotion,
      reducedTransparency,
      forcedColors,
      tokens,
      brandRamp,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeController(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeController must be used within ThemeProviderContext");
  }
  return context;
}
