import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cargoTomlPath = path.join(root, "apps/desktop/src-tauri/Cargo.toml");
const tauriConfPath = path.join(root, "apps/desktop/src-tauri/tauri.conf.json");
const capabilityPath = path.join(root, "apps/desktop/src-tauri/capabilities/main.json");
const distPath = path.join(root, "apps/desktop/dist");

console.log("[release-hardening] Validating release compilation profile and artifact hardening...");

// 1. Validate Cargo.toml release profile
const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");

if (!cargoToml.includes('[profile.release]')) {
  throw new Error("Cargo.toml violation: [profile.release] section missing");
}
if (!cargoToml.includes('opt-level = 3')) {
  throw new Error("Cargo.toml violation: opt-level = 3 required in [profile.release]");
}
if (!cargoToml.includes('lto = true')) {
  throw new Error("Cargo.toml violation: lto = true required in [profile.release]");
}
if (!cargoToml.includes('codegen-units = 1')) {
  throw new Error("Cargo.toml violation: codegen-units = 1 required in [profile.release]");
}
if (!cargoToml.includes('panic = "abort"')) {
  throw new Error('Cargo.toml violation: panic = "abort" required in [profile.release]');
}
if (!cargoToml.includes('strip = true')) {
  throw new Error("Cargo.toml violation: strip = true required in [profile.release]");
}
if (!cargoToml.includes('description = "Prime Shell Desktop Application"')) {
  throw new Error("Cargo.toml violation: Package description must reflect production application identity");
}

// 2. Validate tauri.conf.json metadata
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
if (tauriConf.productName !== "Prime Shell") {
  throw new Error(`tauri.conf.json violation: productName must be 'Prime Shell' (got '${tauriConf.productName}')`);
}
if (tauriConf.identifier !== "com.primeshell.desktop") {
  throw new Error(`tauri.conf.json violation: identifier must be 'com.primeshell.desktop' (got '${tauriConf.identifier}')`);
}
const mainWindow = tauriConf.app?.windows?.find((w) => w.label === "main");
if (!mainWindow || mainWindow.title !== "Prime Shell") {
  throw new Error(`tauri.conf.json violation: main window title must be 'Prime Shell'`);
}

// 3. Validate main capability exclusions
const capability = JSON.parse(fs.readFileSync(capabilityPath, "utf8"));
const forbiddenPermissions = [
  "allow-test-faults",
  "allow-test-evidence-writer",
  "trigger_crash",
  "trigger_hang",
  "trigger_large_rejected",
  "write_runtime_evidence",
];

for (const perm of capability.permissions || []) {
  if (forbiddenPermissions.includes(perm)) {
    throw new Error(`Capability violation: Forbidden test permission in production capability: ${perm}`);
  }
}

// 4. Validate frontend dist assets (if exists)
if (fs.existsSync(distPath)) {
  const files = fs.readdirSync(distPath, { recursive: true });
  for (const f of files) {
    const fStr = String(f);
    if (fStr.endsWith(".map")) {
      throw new Error(`Artifact hardening violation: Source map found in production dist: ${fStr}`);
    }
    if (fStr.includes("test") || fStr.includes("mock") || fStr.includes("fixture")) {
      throw new Error(`Artifact hardening violation: Test artifact found in production dist: ${fStr}`);
    }
  }
}

console.log("[release-hardening] Verification PASSED: Release profile, metadata, and capability boundaries verified.", {
  releaseProfile: {
    optLevel: 3,
    lto: true,
    codegenUnits: 1,
    panicAbort: true,
    strip: true,
  },
  metadata: {
    productName: tauriConf.productName,
    identifier: tauriConf.identifier,
    windowTitle: mainWindow.title,
  },
  productionCapabilitiesClean: true,
});
