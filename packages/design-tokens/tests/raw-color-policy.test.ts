import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Raw Color Policy Tests", () => {
  it("enforces raw hex colors are restricted to authoritative definition files", () => {
    const srcDir = path.resolve(__dirname, "../src");
    const allowedFiles = new Set(["semantic-light.ts", "semantic-dark.ts", "accent.ts"]);
    const hexColorRegex = /#[0-9a-fA-F]{3,8}\b/g;

    const files = fs.readdirSync(srcDir);
    const violations: { file: string; match: string }[] = [];

    for (const file of files) {
      if (allowedFiles.has(file) || file.endsWith(".css")) {
        continue;
      }
      const fullPath = path.join(srcDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const content = fs.readFileSync(fullPath, "utf8");
        const matches = content.match(hexColorRegex);
        if (matches) {
          for (const m of matches) {
            violations.push({ file, match: m });
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
