# Release Baseline and Candidate Guidance — Prime Shell

This document defines the baseline requirements, packaging targets, validation gates, and deferred release activities for `prime-shell`.

---

## 1. Supported Release Packaging Candidates

Based on accepted Phase 0B cross-platform evidence, the initial packaging candidates are:

| Operating System | Target Architecture | Packaging Format | Packaging Tool | Bundled Python Sidecar |
|---|---|---|---|---|
| **Windows** | x86_64 | NSIS Installer (`.exe`) | Tauri CLI + Makensis | PyInstaller `onedir` |
| **Ubuntu Linux** | x86_64 | Debian Package (`.deb`) | Tauri CLI + Dpkg-deb | PyInstaller `onedir` |
| **macOS** | arm64 (Apple Silicon) | Application Bundle (`.app` / DMG) | Tauri CLI | PyInstaller `onedir` |

Every release bundle must include the self-contained `onedir` Python sidecar. No host-installed Python runtime is required or permitted for end users.

---

## 2. Release Candidate Verification Gates

Before any build is designated as a release candidate, it must pass all of the following deterministic gates:

1. **Dependency & Toolchain Audit**:
   - `pnpm install --frozen-lockfile` produces zero changes.
   - Pinned versions in `.node-version`, `rust-toolchain.toml`, and `package.json` match CI runner configurations.
2. **Contract & Schema Drift Audit**:
   - `pnpm contract:drift` passes with zero schema errors.
   - Schema bundle hash matches across Rust, Python, and TypeScript.
3. **Security & CSP Audit**:
   - `pnpm verify:security` passes.
   - Production CSP contains no `unsafe-inline` and restricts connections to `self` and `ipc:`.
4. **Test-Only Capability Exclusion**:
   - The embedded test driver (`tauri-plugin-wdio-webdriver`) must be compiled out.
   - Production binaries and installers must be inspected to ensure zero test plugin symbols.
5. **Zero Ambient Process Survivors**:
   - Application shutdown must leave zero surviving Python sidecar child or worker processes.

---

## 3. Explicitly Deferred Capabilities (Phase 7+)

The following capabilities are out of scope for Phase 1 and the current repository baseline:
- **Production Code Signing & Notarization**: Real Microsoft Authenticode EV certificates, Apple Developer ID signing/notarization, and Linux GPG package signing are deferred until Phase 7 release preparation.
- **Auto-Updater Infrastructure**: In-app automated updater plugins, signature validation, and update manifest servers are deferred to Phase 7.
- **Telemetry & Crash Reporting**: No remote crash upload, analytics, or background telemetry services are authorized.
- **Store Distribution**: Microsoft Store (MSIX) and Mac App Store packaging are out of scope for the reusable foundation baseline.
