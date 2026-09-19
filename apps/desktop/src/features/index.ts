export * from "./contracts";
export * from "./validation";
export * from "./registry";

import { createFeatureRegistry } from "./registry";
import { documentAnalysisFeature } from "./document-analysis/definition";
import { textUtilityFeature } from "./text-utility/definition";
import { diagnosticsFeature } from "./diagnostics/definition";

export const defaultFeatures = [
  documentAnalysisFeature,
  textUtilityFeature,
  diagnosticsFeature,
] as const;

export const featureRegistry = createFeatureRegistry(defaultFeatures);
