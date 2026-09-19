export * from "./contracts";
export * from "./validation";
export * from "./registry";

import { createFeatureRegistry } from "./registry";
import { documentAnalysisFeature } from "./document-analysis/definition";
import { textUtilityFeature } from "./text-utility/definition";

export const defaultFeatures = [
  documentAnalysisFeature,
  textUtilityFeature,
] as const;

export const featureRegistry = createFeatureRegistry(defaultFeatures);
