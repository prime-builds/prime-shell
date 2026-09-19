import { describe, expect, it } from "vitest";
import React from "react";
import {
  createFeatureRegistry,
  defaultFeatures,
  FeatureRegistryError,
  normalizeShortcut,
  validateFeatures,
  type FeatureDefinition,
} from "../index";

describe("Feature Contracts & Deterministic Validation", () => {
  it("normalizes shortcuts deterministically regardless of modifier order or casing", () => {
    expect(normalizeShortcut("Ctrl+Shift+T")).toBe("ctrl+shift+t");
    expect(normalizeShortcut("shift + ctrl + t")).toBe("ctrl+shift+t");
    expect(normalizeShortcut("ALT+ctrl+I")).toBe("ctrl+alt+i");
    expect(normalizeShortcut("Cmd+Shift+P")).toBe("shift+meta+p");
  });

  it("validates the default registered features without errors", () => {
    const result = validateFeatures(defaultFeatures);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);

    const registry = createFeatureRegistry(defaultFeatures);
    expect(registry.getFeatures()).toHaveLength(3);
    expect(registry.getRoutes()).toHaveLength(3);
    expect(registry.getNavigationItems()).toHaveLength(3);
    expect(registry.getCommands().length).toBeGreaterThanOrEqual(7);
    expect(registry.getSettings().length).toBeGreaterThanOrEqual(2);
  });

  it("resolves active nav ID and route title accurately", () => {
    const registry = createFeatureRegistry(defaultFeatures);

    expect(registry.getActiveNavId("/analysis")).toBe("analysis");
    expect(registry.getActiveNavId("/text-utility")).toBe("text-utility");
    expect(registry.getActiveNavId("/diagnostics")).toBe("diagnostics");
    expect(registry.getActiveNavId("/settings")).toBe("settings");
    expect(registry.getActiveNavId("/")).toBe("workspace");
    expect(registry.getActiveNavId("/unknown")).toBe("workspace");

    expect(registry.getRouteTitle("/analysis")).toBe("Document Analysis");
    expect(registry.getRouteTitle("/text-utility")).toBe("Text Utility");
    expect(registry.getRouteTitle("/diagnostics")).toBe("Diagnostics & Recovery");
    expect(registry.getRouteTitle("/settings")).toBe("Settings");
    expect(registry.getRouteTitle("/")).toBe("Workspace");
  });

  it("detects duplicate feature IDs", () => {
    const dummy: FeatureDefinition = {
      id: "text-utility",
      name: "Duplicate Utility",
      routes: [],
    };
    const result = validateFeatures([...defaultFeatures, dummy]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_DUPLICATE_FEATURE_ID")).toBe(true);
  });

  it("detects duplicate route IDs and duplicate route paths", () => {
    const featureWithDupRoutes: FeatureDefinition = {
      id: "dup-routes",
      name: "Duplicate Routes",
      routes: [
        {
          id: "route-1",
          path: "/unique-1",
          title: "Unique 1",
          element: React.createElement("div"),
        },
        {
          id: "route-1", // duplicate route ID
          path: "/unique-2",
          title: "Unique 2",
          element: React.createElement("div"),
        },
        {
          id: "route-2",
          path: "/analysis", // duplicate route path with existing feature
          title: "Analysis Clash",
          element: React.createElement("div"),
        },
      ],
    };

    const result = validateFeatures([...defaultFeatures, featureWithDupRoutes]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_DUPLICATE_ROUTE_ID")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_DUPLICATE_ROUTE_PATH")).toBe(true);
  });

  it("detects reserved route paths and navigation IDs", () => {
    const featureWithReserved: FeatureDefinition = {
      id: "reserved-clash",
      name: "Reserved Clash",
      routes: [
        {
          id: "res-route",
          path: "/settings", // reserved path
          title: "Settings Clash",
          element: React.createElement("div"),
        },
      ],
      navigation: [
        {
          id: "settings", // reserved nav ID
          label: "Settings Clash",
          path: "/settings",
          iconRegular: () => null,
          iconFilled: () => null,
        },
      ],
    };

    const result = validateFeatures([featureWithReserved]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_RESERVED_ROUTE_PATH")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_RESERVED_NAV_ID")).toBe(true);
  });

  it("detects navigation item pointing to invalid route target", () => {
    const featureWithInvalidNav: FeatureDefinition = {
      id: "invalid-nav",
      name: "Invalid Nav",
      routes: [],
      navigation: [
        {
          id: "orphan-nav",
          label: "Orphan",
          path: "/does-not-exist",
          iconRegular: () => null,
          iconFilled: () => null,
        },
      ],
    };

    const result = validateFeatures([featureWithInvalidNav]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_INVALID_NAV_TARGET")).toBe(true);
  });

  it("detects duplicate command IDs and conflicting shortcuts", () => {
    const featureWithClashingCommands: FeatureDefinition = {
      id: "clashing-commands",
      name: "Clashing Commands",
      routes: [],
      commands: [
        {
          id: "docAnalysis.openDocument", // Duplicate command ID
          title: "Clash Open",
          execute: () => {},
        },
        {
          id: "custom.shortcutClash",
          title: "Clash Shortcut",
          shortcut: "ctrl+shift+t", // Conflicts with textUtility.applyTransform
          execute: () => {},
        },
        {
          id: "custom.reservedShortcut",
          title: "Reserved Shortcut",
          shortcut: "Ctrl+B", // Reserved shell shortcut
          execute: () => {},
        },
      ],
    };

    const result = validateFeatures([...defaultFeatures, featureWithClashingCommands]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_DUPLICATE_COMMAND_ID")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_SHORTCUT_CONFLICT")).toBe(true);
    expect(result.errors.some((e) => e.code === "ERR_RESERVED_SHORTCUT")).toBe(true);
  });

  it("detects duplicate setting IDs", () => {
    const featureWithDupSetting: FeatureDefinition = {
      id: "dup-setting-feature",
      name: "Dup Setting",
      routes: [],
      settings: [
        {
          id: "docAnalysis.maxTopTerms", // Duplicate setting ID
          section: "custom",
          sectionTitle: "Custom",
          label: "Clash",
          type: "number",
          defaultValue: 10,
          getValue: () => 10,
          setValue: () => {},
          reset: () => {},
        },
      ],
    };

    const result = validateFeatures([...defaultFeatures, featureWithDupSetting]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_DUPLICATE_SETTING_ID")).toBe(true);
  });

  it("detects unknown required operations in metadata", () => {
    const featureWithUnknownOp: FeatureDefinition = {
      id: "unknown-op-feature",
      name: "Unknown Op Feature",
      routes: [],
      requiredOperations: ["unauthorized.arbitrary.op", "doc.analyze"],
    };

    const result = validateFeatures([featureWithUnknownOp]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "ERR_UNKNOWN_REQUIRED_OPERATION")).toBe(true);
  });

  it("ensures validation is deterministic and independent of feature array order", () => {
    const clashing1: FeatureDefinition = {
      id: "feat-a",
      name: "Feature A",
      routes: [
        {
          id: "route-shared",
          path: "/shared",
          title: "Shared A",
          element: React.createElement("div"),
        },
      ],
    };

    const clashing2: FeatureDefinition = {
      id: "feat-b",
      name: "Feature B",
      routes: [
        {
          id: "route-shared",
          path: "/shared",
          title: "Shared B",
          element: React.createElement("div"),
        },
      ],
    };

    const result1 = validateFeatures([clashing1, clashing2]);
    const result2 = validateFeatures([clashing2, clashing1]);

    expect(result1.valid).toBe(false);
    expect(result2.valid).toBe(false);
    expect(result1.errors).toEqual(result2.errors);
  });

  it("throws FeatureRegistryError when instantiating registry with invalid features", () => {
    const invalidFeature: FeatureDefinition = {
      id: "invalid-feat",
      name: "Invalid Feature",
      routes: [
        {
          id: "r1",
          path: "/settings",
          title: "Clash",
          element: React.createElement("div"),
        },
      ],
    };

    expect(() => createFeatureRegistry([invalidFeature])).toThrowError(FeatureRegistryError);
  });
});
