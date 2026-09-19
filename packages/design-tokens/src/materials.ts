import type { MaterialCapabilities, WindowMaterialPreference } from "./contract";

export interface ResolvedMaterial {
  effectiveMaterial: "solid" | "mica" | "micaAlt";
  isFallback: boolean;
  reason?: string;
}

export function resolveMaterialFallback(
  preference: WindowMaterialPreference,
  capabilities: MaterialCapabilities,
): ResolvedMaterial {
  if (preference === "solid") {
    return { effectiveMaterial: "solid", isFallback: false };
  }

  // Accessibility and environment overrides always force solid fallback
  if (capabilities.forcedColors) {
    return {
      effectiveMaterial: "solid",
      isFallback: true,
      reason: "High contrast (forced colors) mode active; falling back to solid semantic surface.",
    };
  }

  if (capabilities.reducedTransparency) {
    return {
      effectiveMaterial: "solid",
      isFallback: true,
      reason: "Reduced transparency preference active; falling back to solid semantic surface.",
    };
  }

  if (!capabilities.transparencyEnabled) {
    return {
      effectiveMaterial: "solid",
      isFallback: true,
      reason: "System transparency disabled; falling back to solid semantic surface.",
    };
  }

  if (preference === "micaAlt") {
    if (capabilities.micaAlt) {
      return { effectiveMaterial: "micaAlt", isFallback: false };
    }
    if (capabilities.mica) {
      return {
        effectiveMaterial: "mica",
        isFallback: true,
        reason: "Mica Alt unavailable on this platform/configuration; using standard Mica.",
      };
    }
    return {
      effectiveMaterial: "solid",
      isFallback: true,
      reason: capabilities.reason || "Mica materials unsupported on host system; falling back to solid semantic surface.",
    };
  }

  if (preference === "mica" || preference === "system") {
    if (capabilities.mica) {
      return { effectiveMaterial: "mica", isFallback: false };
    }
    return {
      effectiveMaterial: "solid",
      isFallback: true,
      reason: capabilities.reason || "Mica unsupported on host system; falling back to solid semantic surface.",
    };
  }

  return { effectiveMaterial: "solid", isFallback: false };
}
