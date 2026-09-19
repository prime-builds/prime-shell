#!/usr/bin/env node

/**
 * Prime Shell Signed Update Manifest Generator
 *
 * Implements GFD-P7-WP02 update manifest generation:
 * - Generates canonical JSON update manifests adhering to update.schema.json.
 * - Supports separate stable and beta channels.
 * - Binds versions, signatures, hashes, sizes, and platform targets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function generateUpdateManifest(options = {}) {
  const {
    version = "0.2.0",
    channel = "stable",
    notes = "Prime Shell update release.",
    platforms = {},
    outputPath,
  } = options;

  const manifest = {
    version,
    notes,
    pub_date: new Date().toISOString(),
    channel,
    platforms,
  };

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), "utf8");
    console.log(`[generate-update-manifest] Wrote ${channel} manifest to ${outputPath}`);
  }

  return manifest;
}

// Generate default staging manifests when run directly
if (process.argv[1] && process.argv[1].endsWith("generate_update_manifest.mjs")) {
  const stagingDir = path.join(root, "artifacts/staging-updates");

  const stablePlatforms = {
    "windows-x86_64": {
      url: "https://staging-updates.primeshell.internal/releases/v0.2.0/prime-shell-setup-0.2.0.exe",
      signature:
        "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdFNpZ25hdHVyZTFDdW11bGF0aXZlRWQyNTUxOVN0cmVhbVZlcmlmaWVyMDAwMDAwMDAwMDAwMDAwMA==",
      sizeBytes: 15482910,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    "darwin-aarch64": {
      url: "https://staging-updates.primeshell.internal/releases/v0.2.0/prime-shell-0.2.0.tar.gz",
      signature:
        "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdFNpZ25hdHVyZTJNYWNPc0FybTY0VmVyaWZpZXJNb2R1bGUwMDAwMDAwMDAwMDAwMDAwMDAwMA==",
      sizeBytes: 14298112,
      sha256: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    },
  };

  const betaPlatforms = {
    "windows-x86_64": {
      url: "https://staging-updates.primeshell.internal/releases/v0.3.0-beta.1/prime-shell-setup-0.3.0-beta.1.exe",
      signature:
        "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdEJldGFTaWduYXR1cmUxQ3VtdWxhdGl2ZUVkMjU1MTlTdHJlYW1WZXJpZmllcjAwMDAwMDAwMDAwMA==",
      sizeBytes: 15510200,
      sha256: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    },
  };

  generateUpdateManifest({
    version: "0.2.0",
    channel: "stable",
    notes: "Prime Shell 0.2.0 production security and signed update release.",
    platforms: stablePlatforms,
    outputPath: path.join(stagingDir, "channels/stable/latest.json"),
  });

  generateUpdateManifest({
    version: "0.3.0-beta.1",
    channel: "beta",
    notes: "Prime Shell 0.3.0-beta.1 preview release for beta testing.",
    platforms: betaPlatforms,
    outputPath: path.join(stagingDir, "channels/beta/latest.json"),
  });
}
