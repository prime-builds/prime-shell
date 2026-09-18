import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const binaryExt = isWindows ? ".exe" : "";
const binaryPath = path.resolve(
  __dirname,
  `apps/desktop/src-tauri/target/release/prime-shell-desktop${binaryExt}`
);

const targetIdentity = isWindows ? "windows-x86_64" : "linux-x86_64";
const sidecarBinary = isWindows
  ? "prime-shell-python-backend.exe"
  : "prime-shell-python-backend";
const sidecarPath = path.resolve(
  __dirname,
  `services/python-backend/dist/sidecar/${targetIdentity}/prime-shell-python-backend/${sidecarBinary}`
);
process.env.PRIME_SHELL_PACKAGED_SIDECAR = sidecarPath;

export const config = {
  runner: "local",
  specs: ["./tests/e2e/**/*.spec.ts"],
  maxInstances: 1,
  logLevel: "info",
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 60000,
  connectionRetryCount: 3,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: binaryPath,
        driverProvider: "embedded",
        env: {
          PRIME_SHELL_PACKAGED_SIDECAR: sidecarPath,
        },
      },
    ],
  ],
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: binaryPath,
      },
    },
  ],
};
