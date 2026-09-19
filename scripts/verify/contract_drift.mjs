import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemasDir = path.join(root, "packages/app-contracts/schemas");
const fixturesDir = path.join(root, "packages/app-contracts/fixtures");
const rustRegistryPath = path.join(root, "apps/desktop/src-tauri/src/backend/registry.rs");
const pythonProtocolPath = path.join(root, "services/python-backend/src/prime_shell_backend/protocol.py");
const frontendContractsPath = path.join(root, "apps/desktop/src/contracts.ts");

function collectJsonFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results.sort();
}

console.log("[contract-drift] Starting deterministic contract and drift verification...");

// 1. Calculate deterministic schema bundle hash
const schemaFiles = collectJsonFiles(schemasDir);
const hash = crypto.createHash("sha256");
for (const file of schemaFiles) {
  const rel = path.relative(schemasDir, file).split(path.sep).join("/");
  hash.update(rel, "utf8");
  hash.update(Buffer.from([0]));
  hash.update(fs.readFileSync(file));
}
const calculatedSchemaHash = `sha256:${hash.digest("hex")}`;
console.log(`[contract-drift] Computed schema bundle hash: ${calculatedSchemaHash}`);

// 2. Validate all schemas against Draft 2020-12
const ajv = new Ajv2020({ allErrors: true, strict: true });
for (const file of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  ajv.addSchema(schema);
}

const validateHandshake = ajv.getSchema("https://prime-shell.local/schemas/handshake.schema.json");
const validateEnvelope = ajv.getSchema("https://prime-shell.local/schemas/envelope.schema.json");
if (!validateHandshake || !validateEnvelope) {
  throw new Error("Core contract schemas failed to compile");
}

// 3. Extract operations from handshake.schema.json
const handshakeSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, "handshake.schema.json"), "utf8"));
const schemaOperations = handshakeSchema.properties?.supportedOperations?.prefixItems?.map((item) => item.const) || [];
if (schemaOperations.length === 0) {
  throw new Error("handshake.schema.json has no supported operations defined in prefixItems");
}

// Check operation schema files exist for every schema operation
const operationsDir = path.join(schemasDir, "operations");
for (const op of schemaOperations) {
  const opFile = path.join(operationsDir, `${op}.schema.json`);
  if (!fs.existsSync(opFile)) {
    throw new Error(`Missing operation schema file: ${opFile}`);
  }
}

// 4. Extract operations from Rust backend registry
const rustRegistryContent = fs.readFileSync(rustRegistryPath, "utf8");
const rustOperations = [];
const rustMatchRegex = /"([^"]+)"\s*=>\s*Ok\(Self::/g;
let match;
while ((match = rustMatchRegex.exec(rustRegistryContent)) !== null) {
  rustOperations.push(match[1]);
}

// 5. Extract operations from Python backend protocol
const pythonProtocolContent = fs.readFileSync(pythonProtocolPath, "utf8");
const pyOpRegex = /SUPPORTED_OPERATIONS\s*=\s*\(([\s\S]*?)\)/;
const pyMatch = pyOpRegex.exec(pythonProtocolContent);
if (!pyMatch) {
  throw new Error("Could not find SUPPORTED_OPERATIONS in services/python-backend/src/prime_shell_backend/protocol.py");
}
const pythonOperations = pyMatch[1]
  .split("\n")
  .map((line) => line.trim().replace(/['",]/g, ""))
  .filter(Boolean);

// 6. Cross-compare operations
const sortedSchemaOps = [...schemaOperations].sort();
const sortedRustOps = [...rustOperations].sort();
const sortedPythonOps = [...pythonOperations].sort();

if (JSON.stringify(sortedSchemaOps) !== JSON.stringify(sortedRustOps)) {
  throw new Error(
    `Schema operations (${JSON.stringify(sortedSchemaOps)}) do not match Rust registry operations (${JSON.stringify(sortedRustOps)})`
  );
}

if (JSON.stringify(sortedSchemaOps) !== JSON.stringify(sortedPythonOps)) {
  throw new Error(
    `Schema operations (${JSON.stringify(sortedSchemaOps)}) do not match Python backend operations (${JSON.stringify(sortedPythonOps)})`
  );
}

// 7. Verify frontend contract synchronization
const frontendContent = fs.readFileSync(frontendContractsPath, "utf8");
const errorsSchema = JSON.parse(fs.readFileSync(path.join(schemasDir, "errors.schema.json"), "utf8"));
const schemaErrorCodes =
  errorsSchema.properties?.error?.properties?.code?.enum ||
  errorsSchema.properties?.code?.enum ||
  [];
if (schemaErrorCodes.length === 0) {
  throw new Error("No error codes found in errors.schema.json");
}
for (const code of schemaErrorCodes) {
  if (!frontendContent.includes(`"${code}"`)) {
    throw new Error(`Frontend contracts.ts is missing error code defined in errors.schema.json: ${code}`);
  }
}

console.log("[contract-drift] Verification PASSED:", {
  schemasCount: schemaFiles.length,
  schemaHash: calculatedSchemaHash,
  operations: schemaOperations,
  driftDetected: false,
});
