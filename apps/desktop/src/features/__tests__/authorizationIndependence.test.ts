import { describe, expect, it } from "vitest";
import { BACKEND_OPERATION_NAMES, type FeatureDefinition } from "../contracts";
import { textUtilityFeature } from "../text-utility/definition";
import { documentAnalysisFeature } from "../document-analysis/definition";
import { validateFeatures } from "../validation";

describe("Rust Authorization Independence & Metadata Boundary", () => {
  it("proves text-utility declares 0 required backend operations", () => {
    expect(textUtilityFeature.requiredOperations).toBeDefined();
    expect(textUtilityFeature.requiredOperations).toHaveLength(0);
  });

  it("proves document-analysis declares exactly its proven backend operation", () => {
    expect(documentAnalysisFeature.requiredOperations).toBeDefined();
    expect(documentAnalysisFeature.requiredOperations).toEqual(["doc.analyze"]);
  });

  it("rejects forged frontend feature definitions with unapproved operations", () => {
    const forgedFeature: FeatureDefinition = {
      id: "forged-feature",
      name: "Forged Security Bypass",
      routes: [],
      // Forging unauthorized shell/native operations
      requiredOperations: [
        "sys.shell_exec",
        "fs.arbitrary_write",
        "process.elevate",
      ],
    };

    const validation = validateFeatures([forgedFeature]);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toHaveLength(3);
    for (const err of validation.errors) {
      expect(err.code).toBe("ERR_UNKNOWN_REQUIRED_OPERATION");
    }
  });

  it("ensures BACKEND_OPERATION_NAMES matches the exact finite list of approved Rust operations", () => {
    expect(BACKEND_OPERATION_NAMES).toEqual([
      "spike.echo",
      "spike.count",
      "spike.crash",
      "spike.hang",
      "spike.largeRejected",
      "doc.analyze",
    ]);
  });
});
