import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(
  root,
  "packages/app-contracts/schemas/app-manifest.schema.json",
);
const appsDir = path.join(root, "apps");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateManifest = ajv.compile(schema);

export function loadAndValidateManifest(appDir) {
  const manifestPath = path.join(appDir, "app.manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }

  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  const valid = validateManifest(manifest);
  if (!valid) {
    throw new Error(
      `Manifest validation failed for ${path.basename(appDir)}: ${ajv.errorsText(
        validateManifest.errors,
      )}`,
    );
  }

  return manifest;
}

export function checkAppCollisions(manifests) {
  const seenAppIds = new Map();
  const seenBundleIds = new Map();
  const seenExecutables = new Map();
  const seenNamespaces = new Map();

  for (const [appName, manifest] of Object.entries(manifests)) {
    // 1. App ID
    if (seenAppIds.has(manifest.appId)) {
      throw new Error(
        `Collision detected: appId '${manifest.appId}' used by both '${seenAppIds.get(
          manifest.appId,
        )}' and '${appName}'`,
      );
    }
    seenAppIds.set(manifest.appId, appName);

    // 2. Bundle ID
    if (seenBundleIds.has(manifest.bundleId)) {
      throw new Error(
        `Collision detected: bundleId '${manifest.bundleId}' used by both '${seenBundleIds.get(
          manifest.bundleId,
        )}' and '${appName}'`,
      );
    }
    seenBundleIds.set(manifest.bundleId, appName);

    // 3. Executable
    if (seenExecutables.has(manifest.executable)) {
      throw new Error(
        `Collision detected: executable '${manifest.executable}' used by both '${seenExecutables.get(
          manifest.executable,
        )}' and '${appName}'`,
      );
    }
    seenExecutables.set(manifest.executable, appName);

    // 4. State Namespace
    if (seenNamespaces.has(manifest.stateNamespace)) {
      throw new Error(
        `Collision detected: stateNamespace '${manifest.stateNamespace}' used by both '${seenNamespaces.get(
          manifest.stateNamespace,
        )}' and '${appName}'`,
      );
    }
    seenNamespaces.set(manifest.stateNamespace, appName);
  }

  return true;
}

export function composeAllApps() {
  console.log("[compose-app] Discovering applications in", appsDir);
  const appEntries = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  const manifests = {};

  for (const entry of appEntries) {
    const appDir = path.join(appsDir, entry.name);
    const manifestPath = path.join(appDir, "app.manifest.json");
    if (fs.existsSync(manifestPath)) {
      console.log(`[compose-app] Validating manifest for app: ${entry.name}`);
      const manifest = loadAndValidateManifest(appDir);
      manifests[entry.name] = manifest;
    }
  }

  console.log(`[compose-app] Found ${Object.keys(manifests).length} application(s). Checking collisions...`);
  checkAppCollisions(manifests);

  console.log("[compose-app] All manifests valid and collision-free.");
  return manifests;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const manifests = composeAllApps();
    console.log(
      JSON.stringify(
        {
          status: "passed",
          apps: Object.keys(manifests),
          count: Object.keys(manifests).length,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(`[compose-app] ERROR: ${err.message}`);
    process.exit(1);
  }
}
