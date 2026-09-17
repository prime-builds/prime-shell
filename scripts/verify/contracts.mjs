import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemasDir = path.join(root, "packages/app-contracts/schemas");
const fixturesDir = path.join(root, "packages/app-contracts/fixtures");

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
  return results;
}

const schemaFiles = collectJsonFiles(schemasDir);
const ajv = new Ajv2020({ allErrors: true, strict: true });

for (const file of schemaFiles) {
  const schema = JSON.parse(fs.readFileSync(file, "utf8"));
  ajv.addSchema(schema);
}

const validateHandshake = ajv.getSchema(
  "https://prime-shell.local/schemas/handshake.schema.json",
);
const validateEnvelope = ajv.getSchema(
  "https://prime-shell.local/schemas/envelope.schema.json",
);
if (!validateHandshake || !validateEnvelope) {
  throw new Error("contract validators were not compiled");
}

const validCases = [
  [validateHandshake, "valid/hello.json"],
  [validateEnvelope, "valid/echo-request.json"],
  [validateEnvelope, "valid/echo-result.json"],
  [validateEnvelope, "valid/count-request.json"],
  [validateEnvelope, "valid/count-event.json"],
  [validateEnvelope, "valid/count-result.json"],
  [validateEnvelope, "valid/cancel-request.json"],
];

for (const [validate, name] of validCases) {
  const value = JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
  if (!validate(value)) {
    throw new Error(`${name} should be valid: ${ajv.errorsText(validate.errors)}`);
  }
}

for (const name of [
  "invalid/unknown-operation.json",
  "invalid/echo-extra-property.json",
]) {
  const value = JSON.parse(fs.readFileSync(path.join(fixturesDir, name), "utf8"));
  if (validateEnvelope(value)) {
    throw new Error(`${name} should be invalid`);
  }
}

try {
  JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "invalid/malformed.jsonl"), "utf8"),
  );
  throw new Error("malformed.jsonl should not parse");
} catch (error) {
  if (!(error instanceof SyntaxError)) {
    throw error;
  }
}

console.log(
  JSON.stringify({
    status: "passed",
    schemaDraft: "2020-12",
    schemas: schemaFiles.length,
    validFixtures: validCases.length,
    invalidFixtures: 3,
  }),
);
