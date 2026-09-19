import {
  BACKEND_OPERATION_NAMES,
  type FeatureDefinition,
} from "./contracts";

export interface ValidationError {
  code: string;
  message: string;
  featureId?: string;
  conflictingFeatureId?: string;
  targetId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export const RESERVED_SHELL_SHORTCUTS = new Set([
  "ctrl+b",
  "ctrl+j",
  "ctrl+alt+i",
  "ctrl+,",
  "ctrl+k",
  "ctrl+shift+p",
]);

export const RESERVED_ROUTE_PATHS = new Set([
  "/",
  "/workspace",
  "/settings",
]);

export const RESERVED_NAV_IDS = new Set([
  "workspace",
  "settings",
]);

/**
 * Normalizes a shortcut string into a deterministic canonical representation:
 * lowercase modifiers in order (ctrl -> alt -> shift -> meta) + lowercase key.
 * Example: "Ctrl+Shift+T" -> "ctrl+shift+t", "Alt + Ctrl + I" -> "ctrl+alt+i"
 */
export function normalizeShortcut(shortcut: string): string {
  const parts = shortcut
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);

  const modifiers: string[] = [];
  let key = "";

  for (const part of parts) {
    if (part === "ctrl" || part === "control") {
      if (!modifiers.includes("ctrl")) modifiers.push("ctrl");
    } else if (part === "alt" || part === "option") {
      if (!modifiers.includes("alt")) modifiers.push("alt");
    } else if (part === "shift") {
      if (!modifiers.includes("shift")) modifiers.push("shift");
    } else if (part === "meta" || part === "cmd" || part === "command" || part === "win") {
      if (!modifiers.includes("meta")) modifiers.push("meta");
    } else {
      key = part;
    }
  }

  // Canonical modifier sorting
  const order: Record<string, number> = { ctrl: 1, alt: 2, shift: 3, meta: 4 };
  modifiers.sort((a, b) => (order[a] || 99) - (order[b] || 99));

  return [...modifiers, key].join("+");
}

/**
 * Validates a list of feature definitions for deterministic collision and contract conformance.
 * Independent of feature array input order.
 */
export function validateFeatures(features: readonly FeatureDefinition[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Sort features by ID to ensure deterministic processing regardless of input order
  const sortedFeatures = [...features].sort((a, b) => a.id.localeCompare(b.id));

  const seenFeatureIds = new Map<string, FeatureDefinition>();
  const seenRouteIds = new Map<string, { featureId: string; path: string }>();
  const seenRoutePaths = new Map<string, { featureId: string; routeId: string }>();
  const seenNavIds = new Map<string, { featureId: string }>();
  const seenCommandIds = new Map<string, { featureId: string }>();
  const seenShortcuts = new Map<string, { featureId: string; commandId: string }>();
  const seenSettingIds = new Map<string, { featureId: string; type: string }>();

  // 1. Feature ID Uniqueness & Validations
  for (const feat of sortedFeatures) {
    if (!feat.id || typeof feat.id !== "string" || feat.id.trim() === "") {
      errors.push({
        code: "ERR_INVALID_FEATURE_ID",
        message: `Feature has an invalid or empty ID.`,
        featureId: feat.id,
      });
      continue;
    }

    if (seenFeatureIds.has(feat.id)) {
      errors.push({
        code: "ERR_DUPLICATE_FEATURE_ID",
        message: `Duplicate feature ID '${feat.id}' detected.`,
        featureId: feat.id,
        conflictingFeatureId: seenFeatureIds.get(feat.id)!.id,
        targetId: feat.id,
      });
    } else {
      seenFeatureIds.set(feat.id, feat);
    }

    // 2. Route Contributions
    const featureRoutePaths = new Set<string>();
    for (const route of feat.routes || []) {
      if (!route.id || route.id.trim() === "") {
        errors.push({
          code: "ERR_INVALID_ROUTE_ID",
          message: `Route in feature '${feat.id}' has an empty or invalid ID.`,
          featureId: feat.id,
        });
      } else if (seenRouteIds.has(route.id)) {
        errors.push({
          code: "ERR_DUPLICATE_ROUTE_ID",
          message: `Duplicate route ID '${route.id}' detected in feature '${feat.id}'.`,
          featureId: feat.id,
          conflictingFeatureId: seenRouteIds.get(route.id)!.featureId,
          targetId: route.id,
        });
      } else {
        seenRouteIds.set(route.id, { featureId: feat.id, path: route.path });
      }

      const canonicalPath = route.path.startsWith("/") ? route.path : `/${route.path}`;
      featureRoutePaths.add(canonicalPath);

      if (RESERVED_ROUTE_PATHS.has(canonicalPath)) {
        errors.push({
          code: "ERR_RESERVED_ROUTE_PATH",
          message: `Feature '${feat.id}' uses reserved route path '${canonicalPath}'.`,
          featureId: feat.id,
          targetId: canonicalPath,
        });
      } else if (seenRoutePaths.has(canonicalPath)) {
        errors.push({
          code: "ERR_DUPLICATE_ROUTE_PATH",
          message: `Duplicate route path '${canonicalPath}' in feature '${feat.id}'.`,
          featureId: feat.id,
          conflictingFeatureId: seenRoutePaths.get(canonicalPath)!.featureId,
          targetId: canonicalPath,
        });
      } else {
        seenRoutePaths.set(canonicalPath, { featureId: feat.id, routeId: route.id });
      }
    }

    // 3. Navigation Contributions
    for (const nav of feat.navigation || []) {
      if (!nav.id || nav.id.trim() === "") {
        errors.push({
          code: "ERR_INVALID_NAV_ID",
          message: `Navigation item in feature '${feat.id}' has an empty or invalid ID.`,
          featureId: feat.id,
        });
      } else if (RESERVED_NAV_IDS.has(nav.id)) {
        errors.push({
          code: "ERR_RESERVED_NAV_ID",
          message: `Feature '${feat.id}' uses reserved navigation ID '${nav.id}'.`,
          featureId: feat.id,
          targetId: nav.id,
        });
      } else if (seenNavIds.has(nav.id)) {
        errors.push({
          code: "ERR_DUPLICATE_NAV_ID",
          message: `Duplicate navigation ID '${nav.id}' in feature '${feat.id}'.`,
          featureId: feat.id,
          conflictingFeatureId: seenNavIds.get(nav.id)!.featureId,
          targetId: nav.id,
        });
      } else {
        seenNavIds.set(nav.id, { featureId: feat.id });
      }

      // Check navigation target path exists in feature routes or global routes
      const navCanonicalPath = nav.path.startsWith("/") ? nav.path : `/${nav.path}`;
      if (!featureRoutePaths.has(navCanonicalPath) && !RESERVED_ROUTE_PATHS.has(navCanonicalPath)) {
        errors.push({
          code: "ERR_INVALID_NAV_TARGET",
          message: `Navigation item '${nav.id}' in feature '${feat.id}' points to unknown path '${nav.path}'.`,
          featureId: feat.id,
          targetId: nav.path,
        });
      }
    }

    // 4. Command Contributions
    for (const cmd of feat.commands || []) {
      if (!cmd.id || cmd.id.trim() === "") {
        errors.push({
          code: "ERR_INVALID_COMMAND_ID",
          message: `Command in feature '${feat.id}' has an empty or invalid ID.`,
          featureId: feat.id,
        });
      } else if (seenCommandIds.has(cmd.id)) {
        errors.push({
          code: "ERR_DUPLICATE_COMMAND_ID",
          message: `Duplicate command ID '${cmd.id}' in feature '${feat.id}'.`,
          featureId: feat.id,
          conflictingFeatureId: seenCommandIds.get(cmd.id)!.featureId,
          targetId: cmd.id,
        });
      } else {
        seenCommandIds.set(cmd.id, { featureId: feat.id });
      }

      // Shortcut validation
      if (cmd.shortcut && cmd.shortcut.trim() !== "") {
        const normalized = normalizeShortcut(cmd.shortcut);
        if (RESERVED_SHELL_SHORTCUTS.has(normalized)) {
          errors.push({
            code: "ERR_RESERVED_SHORTCUT",
            message: `Command '${cmd.id}' in feature '${feat.id}' uses reserved shell shortcut '${cmd.shortcut}'.`,
            featureId: feat.id,
            targetId: normalized,
          });
        } else if (seenShortcuts.has(normalized)) {
          const conflict = seenShortcuts.get(normalized)!;
          errors.push({
            code: "ERR_SHORTCUT_CONFLICT",
            message: `Shortcut '${cmd.shortcut}' (${normalized}) in feature '${feat.id}' conflicts with command '${conflict.commandId}' in feature '${conflict.featureId}'.`,
            featureId: feat.id,
            conflictingFeatureId: conflict.featureId,
            targetId: normalized,
          });
        } else {
          seenShortcuts.set(normalized, { featureId: feat.id, commandId: cmd.id });
        }
      }
    }

    // 5. Settings Contributions
    for (const setting of feat.settings || []) {
      if (!setting.id || setting.id.trim() === "") {
        errors.push({
          code: "ERR_INVALID_SETTING_ID",
          message: `Setting in feature '${feat.id}' has an empty or invalid ID.`,
          featureId: feat.id,
        });
      } else if (seenSettingIds.has(setting.id)) {
        const conflict = seenSettingIds.get(setting.id)!;
        errors.push({
          code: "ERR_DUPLICATE_SETTING_ID",
          message: `Duplicate setting ID '${setting.id}' in feature '${feat.id}'.`,
          featureId: feat.id,
          conflictingFeatureId: conflict.featureId,
          targetId: setting.id,
        });
      } else {
        seenSettingIds.set(setting.id, { featureId: feat.id, type: setting.type });
      }
    }

    // 6. Required Operations (Metadata check only)
    for (const op of feat.requiredOperations || []) {
      if (!BACKEND_OPERATION_NAMES.includes(op as (typeof BACKEND_OPERATION_NAMES)[number])) {
        errors.push({
          code: "ERR_UNKNOWN_REQUIRED_OPERATION",
          message: `Feature '${feat.id}' declares unknown required operation '${op}'.`,
          featureId: feat.id,
          targetId: op,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
