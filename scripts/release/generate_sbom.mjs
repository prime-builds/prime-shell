import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cargoLockPath = path.join(root, "apps/desktop/src-tauri/Cargo.lock");
const pnpmLockPath = path.join(root, "pnpm-lock.yaml");
const pythonLockPath = path.join(root, "services/python-backend/requirements-build.lock");
const outDir = path.join(root, "artifacts/sbom");

fs.mkdirSync(outDir, { recursive: true });

console.log("[sbom] Generating machine-readable SBOMs (CycloneDX & SPDX)...");

// 1. Parse Rust Crates from Cargo.lock
const cargoLockContent = fs.readFileSync(cargoLockPath, "utf8");
const rustComponents = [];
const packageBlocks = cargoLockContent.split("[[package]]").slice(1);

for (const block of packageBlocks) {
  const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
  const versionMatch = block.match(/version\s*=\s*"([^"]+)"/);
  if (nameMatch && versionMatch) {
    rustComponents.push({
      name: nameMatch[1],
      version: versionMatch[1],
      ecosystem: "cargo",
      purl: `pkg:cargo/${nameMatch[1]}@${versionMatch[1]}`,
    });
  }
}

// 2. Parse Node packages from pnpm-lock.yaml
const pnpmLockContent = fs.readFileSync(pnpmLockPath, "utf8");
const nodeComponents = new Map();

// In pnpm-lock.yaml, look for package specifiers in the packages section
const packagesSectionMatch = pnpmLockContent.match(/packages:\s*([\s\S]*?)(?:\n\w|$)/);
if (packagesSectionMatch) {
  const pkgLines = packagesSectionMatch[1].split("\n");
  for (const line of pkgLines) {
    const m = line.match(/^  ['"]?(@?[^@\s:]+)@([^\s'":()]+)/);
    if (m) {
      const name = m[1];
      const version = m[2];
      if (!name.startsWith("@prime-shell/") && name !== "prime-shell") {
        const key = `${name}@${version}`;
        if (!nodeComponents.has(key)) {
          nodeComponents.set(key, {
            name,
            version,
            ecosystem: "npm",
            purl: `pkg:npm/${name.replace("@", "%40")}@${version}`,
          });
        }
      }
    }
  }
}

// 3. Parse Python packages from requirements-build.lock
const pythonLockContent = fs.readFileSync(pythonLockPath, "utf8");
const pythonComponents = [];
const pyLines = pythonLockContent.split("\n");
for (const line of pyLines) {
  const m = line.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.-]+)/);
  if (m) {
    pythonComponents.push({
      name: m[1],
      version: m[2],
      ecosystem: "pypi",
      purl: `pkg:pypi/${m[1]}@${m[2]}`,
    });
  }
}

const allComponents = [
  ...rustComponents,
  ...Array.from(nodeComponents.values()),
  ...pythonComponents,
].sort((a, b) => a.purl.localeCompare(b.purl));

console.log(`[sbom] Collected components: ${rustComponents.length} Rust, ${nodeComponents.size} Node, ${pythonComponents.length} Python (Total: ${allComponents.length})`);

// 4. Generate CycloneDX 1.5 JSON
const cyclonedx = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: "urn:uuid:prime-shell-release-sbom-gfd-p7-wp01",
  version: 1,
  metadata: {
    timestamp: "2026-09-19T21:45:00Z",
    tools: [
      {
        vendor: "Prime Shell",
        name: "prime-shell-sbom-generator",
        version: "1.0.0",
      },
    ],
    component: {
      type: "application",
      name: "prime-shell",
      version: "0.1.0",
      description: "Prime Shell Desktop Application",
    },
  },
  components: allComponents.map((c) => ({
    type: "library",
    name: c.name,
    version: c.version,
    purl: c.purl,
    properties: [
      {
        name: "ecosystem",
        value: c.ecosystem,
      },
    ],
  })),
};

const cyclonedxPath = path.join(outDir, "sbom-cyclonedx.json");
fs.writeFileSync(cyclonedxPath, JSON.stringify(cyclonedx, null, 2), "utf8");
console.log(`[sbom] CycloneDX SBOM written to ${cyclonedxPath}`);

// 5. Generate SPDX 2.3 JSON
const spdx = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: "prime-shell-sbom",
  documentNamespace: "https://primeshell.app/spdx/prime-shell-0.1.0",
  creationInfo: {
    created: "2026-09-19T21:45:00Z",
    creators: ["Tool: prime-shell-sbom-generator-1.0.0", "Organization: Prime Shell"],
  },
  packages: [
    {
      SPDXID: "SPDXRef-Package-prime-shell",
      name: "prime-shell",
      versionInfo: "0.1.0",
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
    },
    ...allComponents.map((c, i) => ({
      SPDXID: `SPDXRef-Package-${c.ecosystem}-${c.name.replace(/[^a-zA-Z0-9.-]/g, "-")}-${i}`,
      name: c.name,
      versionInfo: c.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: c.purl,
        },
      ],
    })),
  ],
  relationships: allComponents.map((c, i) => ({
    spdxElementId: "SPDXRef-Package-prime-shell",
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: `SPDXRef-Package-${c.ecosystem}-${c.name.replace(/[^a-zA-Z0-9.-]/g, "-")}-${i}`,
  })),
};

const spdxPath = path.join(outDir, "sbom-spdx.json");
fs.writeFileSync(spdxPath, JSON.stringify(spdx, null, 2), "utf8");
console.log(`[sbom] SPDX SBOM written to ${spdxPath}`);

console.log("[sbom] Generation complete.");
