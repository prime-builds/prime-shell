import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

console.log("[secret-scan] Scanning workspace for credentials, private keys, and native paths...");

const ignoredDirs = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  ".venv-build",
  "artifacts",
]);

const secretPatterns = [
  { name: "Private Key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub Personal Access Token", regex: /ghp_[0-9a-zA-Z]{36}/ },
  { name: "Generic API Token", regex: /(?:api_key|apikey|secret_key|private_key)\s*[:=]\s*['"][0-9a-zA-Z]{20,}['"]/i },
];

const nativePathPatterns = [
  { name: "Windows User Path", regex: /[C-Z]:\\Users\\[a-zA-Z0-9_-]+/i },
  { name: "macOS User Path", regex: /\/Users\/[a-zA-Z0-9_-]+/ },
  { name: "Linux Home Path", regex: /\/home\/[a-zA-Z0-9_-]+/ },
];

const findings = [];

function scanFile(filePath) {
  // Skip binary or large files
  const ext = path.extname(filePath).toLowerCase();
  const textExtensions = [
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".rs", ".toml", ".json", ".yaml", ".yml",
    ".py", ".sh", ".md"
  ];
  if (!textExtensions.includes(ext)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(root, filePath);

  for (const { name, regex } of secretPatterns) {
    if (regex.test(content)) {
      findings.push({ type: "Secret", name, file: relPath });
    }
  }

  // Only check source files for native paths (skip scripts, docs, and test fixtures if expected)
  if (
    relPath.startsWith("apps/") ||
    relPath.startsWith("packages/") ||
    relPath.startsWith("services/")
  ) {
    // Exclude mock tests or comments mentioning path schemas
    for (const { name, regex } of nativePathPatterns) {
      const match = content.match(regex);
      if (match) {
        // Exclude test assertions that verify redaction
        if (
          !relPath.includes("test") &&
          !relPath.includes("redaction")
        ) {
          findings.push({ type: "NativePath", name, file: relPath, match: match[0] });
        }
      }
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dir, entry.name));
      }
    } else if (entry.isFile()) {
      scanFile(path.join(dir, entry.name));
    }
  }
}

walk(root);

if (findings.length > 0) {
  console.error("[secret-scan] FAILED: Potential secrets or private native paths detected:");
  for (const f of findings) {
    console.error(`  - [${f.type}] ${f.name} in ${f.file} ${f.match ? `("${f.match}")` : ""}`);
  }
  process.exit(1);
}

console.log("[secret-scan] Verification PASSED: Zero embedded credentials, keys, or private native paths detected.");
