import type {
  CommandContribution,
  FeatureDefinition,
  NavigationContribution,
  RouteContribution,
  SettingContribution,
} from "./contracts";
import { validateFeatures, type ValidationResult } from "./validation";

export class FeatureRegistryError extends Error {
  readonly validationResult: ValidationResult;

  constructor(message: string, validationResult: ValidationResult) {
    super(message);
    this.name = "FeatureRegistryError";
    this.validationResult = validationResult;
  }
}

export class FeatureRegistry {
  private readonly features: readonly FeatureDefinition[];
  private readonly routes: readonly RouteContribution[];
  private readonly navigationItems: readonly NavigationContribution[];
  private readonly commands: readonly CommandContribution[];
  private readonly settings: readonly SettingContribution[];

  constructor(features: readonly FeatureDefinition[]) {
    const validation = validateFeatures(features);
    if (!validation.valid) {
      const summary = validation.errors
        .map((e) => `[${e.code}] ${e.message}`)
        .join("; ");
      throw new FeatureRegistryError(
        `FeatureRegistry validation failed with ${validation.errors.length} error(s): ${summary}`,
        validation,
      );
    }

    this.features = Object.freeze([...features]);

    // Flatten contributions deterministically
    const allRoutes: RouteContribution[] = [];
    const allNav: NavigationContribution[] = [];
    const allCommands: CommandContribution[] = [];
    const allSettings: SettingContribution[] = [];

    for (const feat of this.features) {
      if (feat.routes) {
        allRoutes.push(...feat.routes);
      }
      if (feat.navigation) {
        allNav.push(...feat.navigation);
      }
      if (feat.commands) {
        allCommands.push(...feat.commands);
      }
      if (feat.settings) {
        allSettings.push(...feat.settings);
      }
    }

    // Sort navigation items by order if specified, else keep stable order
    allNav.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));

    this.routes = Object.freeze(allRoutes);
    this.navigationItems = Object.freeze(allNav);
    this.commands = Object.freeze(allCommands);
    this.settings = Object.freeze(allSettings);
  }

  getFeatures(): readonly FeatureDefinition[] {
    return this.features;
  }

  getRoutes(): readonly RouteContribution[] {
    return this.routes;
  }

  getNavigationItems(): readonly NavigationContribution[] {
    return this.navigationItems;
  }

  getCommands(): readonly CommandContribution[] {
    return this.commands;
  }

  getSettings(): readonly SettingContribution[] {
    return this.settings;
  }

  /**
   * Resolves active navigation ID based on the current pathname.
   * Falls back to "workspace" or matching feature nav item.
   */
  getActiveNavId(pathname: string): string {
    if (pathname === "/settings") {
      return "settings";
    }
    const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const matchedNav = this.navigationItems.find(
      (nav) => nav.path === cleanPath || cleanPath.startsWith(`${nav.path}/`),
    );
    if (matchedNav) {
      return matchedNav.id;
    }
    if (cleanPath === "/" || cleanPath === "/workspace") {
      return "workspace";
    }
    return "workspace";
  }

  /**
   * Resolves human-readable route title from registered routes.
   */
  getRouteTitle(pathname: string): string | undefined {
    if (pathname === "/settings") {
      return "Settings";
    }
    if (pathname === "/" || pathname === "/workspace") {
      return "Workspace";
    }
    const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const matchedRoute = this.routes.find((r) => r.path === cleanPath);
    if (matchedRoute) {
      return matchedRoute.title;
    }
    return undefined;
  }
}

export function createFeatureRegistry(features: readonly FeatureDefinition[]): FeatureRegistry {
  return new FeatureRegistry(features);
}
