export interface AppBrand {
  readonly accentColor: string;
  readonly publisher: string;
  readonly description?: string;
}

export interface AppWindowConfig {
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly minWidth: number;
  readonly minHeight: number;
}

export interface AppManifest {
  readonly appId: string;
  readonly productName: string;
  readonly bundleId: string;
  readonly executable: string;
  readonly version: string;
  readonly brand: AppBrand;
  readonly features: readonly string[];
  readonly operations: readonly string[];
  readonly window: AppWindowConfig;
  readonly stateNamespace: string;
}

export interface ManifestValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateAppManifestData(data: unknown): ManifestValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Manifest must be an object"] };
  }

  const manifest = data as Record<string, unknown>;

  // appId
  if (typeof manifest.appId !== "string" || !/^[a-z0-9-]+$/.test(manifest.appId)) {
    errors.push("appId must be a lowercase alphanumeric hyphenated string");
  }

  // productName
  if (typeof manifest.productName !== "string" || manifest.productName.length < 2) {
    errors.push("productName must be a string of at least 2 characters");
  }

  // bundleId
  if (
    typeof manifest.bundleId !== "string" ||
    !/^[a-z0-9]+(?:\.[a-z0-9-]+)+$/.test(manifest.bundleId)
  ) {
    errors.push("bundleId must follow reverse-DNS notation (e.g. com.example.app)");
  }

  // executable
  if (
    typeof manifest.executable !== "string" ||
    !/^[a-z0-9-]+$/.test(manifest.executable)
  ) {
    errors.push("executable must be a lowercase alphanumeric hyphenated string");
  }

  // version
  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)
  ) {
    errors.push("version must be a valid semver string (e.g. 0.1.0)");
  }

  // brand
  if (!manifest.brand || typeof manifest.brand !== "object") {
    errors.push("brand must be an object containing accentColor and publisher");
  } else {
    const brand = manifest.brand as Record<string, unknown>;
    if (
      typeof brand.accentColor !== "string" ||
      !/^#[0-9A-Fa-f]{6}$/.test(brand.accentColor)
    ) {
      errors.push("brand.accentColor must be a 6-digit hex color (e.g. #0078D4)");
    }
    if (typeof brand.publisher !== "string" || brand.publisher.length < 2) {
      errors.push("brand.publisher must be a string of at least 2 characters");
    }
  }

  // features
  if (!Array.isArray(manifest.features) || manifest.features.length === 0) {
    errors.push("features must be a non-empty array of strings");
  }

  // operations
  if (!Array.isArray(manifest.operations)) {
    errors.push("operations must be an array of strings");
  }

  // window
  if (!manifest.window || typeof manifest.window !== "object") {
    errors.push("window must be an object");
  } else {
    const win = manifest.window as Record<string, unknown>;
    if (typeof win.title !== "string" || win.title.length < 1) {
      errors.push("window.title must be a non-empty string");
    }
    if (typeof win.width !== "number" || win.width < 400) {
      errors.push("window.width must be a number >= 400");
    }
    if (typeof win.height !== "number" || win.height < 300) {
      errors.push("window.height must be a number >= 300");
    }
  }

  // stateNamespace
  if (
    typeof manifest.stateNamespace !== "string" ||
    !/^[a-z0-9.-]+$/.test(manifest.stateNamespace)
  ) {
    errors.push("stateNamespace must be a valid namespace string");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
