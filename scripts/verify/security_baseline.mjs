import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tauriConfPath = path.join(root, "apps/desktop/src-tauri/tauri.conf.json");
const capabilityPath = path.join(root, "apps/desktop/src-tauri/capabilities/main.json");
const permissionsPath = path.join(root, "apps/desktop/src-tauri/permissions/app.toml");
const cargoTomlPath = path.join(root, "apps/desktop/src-tauri/Cargo.toml");

console.log("[security-baseline] Starting security and capability verification...");

// 1. Validate Production CSP
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
const csp = tauriConf.app?.security?.csp;
if (!csp || typeof csp !== "string") {
  throw new Error("tauri.conf.json missing app.security.csp configuration");
}

console.log(`[security-baseline] Validating CSP: "${csp}"`);

if (csp.includes("'unsafe-inline'")) {
  throw new Error("CSP violation: 'unsafe-inline' is prohibited in production configuration");
}
if (!csp.includes("default-src 'self'")) {
  throw new Error("CSP violation: default-src must be restricted to 'self'");
}
if (!csp.includes("object-src 'none'")) {
  throw new Error("CSP violation: object-src must be 'none'");
}
if (!csp.includes("frame-ancestors 'none'")) {
  throw new Error("CSP violation: frame-ancestors must be 'none'");
}
if (!csp.includes("form-action 'none'")) {
  throw new Error("CSP violation: form-action must be 'none'");
}
if (csp.includes("http://*") || csp.includes("https://*") || csp.includes("ws://*") || csp.includes("wss://*")) {
  throw new Error("CSP violation: Wildcard remote domains are prohibited");
}

// 2. Validate Capabilities
const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
const allowedPermissions = new Set([
  "core:default",
  "allow-backend-status",
  "allow-echo-text",
  "allow-task-lifecycle",
  "allow-runtime-probe",
  "allow-theme-state",
]);

for (const perm of capability.permissions || []) {
  if (!allowedPermissions.has(perm)) {
    throw new Error(`Capability violation: Unauthorized permission in main capability: ${perm}`);
  }
}

// 3. Validate Permissions in app.toml
const permissionsContent = fs.readFileSync(permissionsPath, "utf8");
const prohibitedPatterns = [
  "shell:execute",
  "fs:read",
  "fs:write",
  "process:exit",
  "http:request",
];
for (const pattern of prohibitedPatterns) {
  if (permissionsContent.includes(pattern)) {
    throw new Error(`Permission violation: Prohibited native permission found: ${pattern}`);
  }
}

// 4. Validate WebDriver Feature Gating in Cargo.toml
const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
if (!cargoToml.includes('tauri-plugin-wdio-webdriver = { version = "1.4.0", optional = true }')) {
  throw new Error("Cargo.toml violation: tauri-plugin-wdio-webdriver must be marked optional = true");
}
const defaultFeatureMatch = cargoToml.match(/\[features\][\s\S]*?default\s*=\s*\[(.*?)\]/);
if (defaultFeatureMatch && defaultFeatureMatch[1].includes("webdriver")) {
  throw new Error("Cargo.toml violation: default features must not include 'webdriver'");
}

console.log("[security-baseline] Verification PASSED:", {
  cspStrict: true,
  unsafeInlineAbsent: true,
  leastPrivilegeCapabilities: capability.permissions.length,
  webDriverOptional: true,
  webDriverExcludedFromDefault: true,
});
