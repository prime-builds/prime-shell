# ADR-0006: Post-Spike Architecture and Repository Baseline Hardening

- **Status:** Accepted
- **Date:** 2026-09-18
- **Authors:** Prime Shell Technical Lead
- **Deciders:** Prime Shell Architecture & Technical Leadership
- **Consulted:** Phase 0B Closure Report (`docs/spike/phase-0b-spike-report.md`), Authority Documents

---

## 1. Context

Phase 0B validated the fundamental cross-platform architecture of `prime-shell` across Windows 11 x64, Ubuntu 24.04 LTS x64, and macOS 14+ arm64 using Tauri v2, React 19 / Fluent UI v9, and a packaged Python 3.12 `onedir` sidecar.

The spike established critical empirical findings:
1. **Window Chrome Behavior**: Windows Snap Layouts, mixed-DPI transitions, and system menu interactions behave most reliably with native window decorations (`decorations: true`), while custom title bars introduce platform-specific edge cases.
2. **Test Capability Isolation**: WebdriverIO native desktop testing requires an in-process WebDriver plugin (`tauri-plugin-wdio-webdriver`) that must never be exposed or compiled into production release packages.
3. **Contract Drift Risk**: Maintaining cross-language contracts across JSON Schema 2020-12, Rust serde types, Python protocol dictionaries, and frontend TypeScript/Zod schemas requires automated, executable drift enforcement rather than manual documentation.
4. **Toolchain Determinism**: Differences between local runtime versions and CI runner environments can cause subtle warnings and non-reproducible builds unless strictly pinned and checked.

---

## 2. Decisions

1. **Native Window Decoration Fallback as Baseline**:
   `decorations: true` in `tauri.conf.json` is retained as the authoritative baseline for all platforms under ADR-0005. Custom title-bar chrome remains an opt-in enhancement subject to rigorous Snap Layout and accessibility promotion gates.

2. **Test Plugin Separation via Cargo Feature Flags**:
   The embedded WebDriver plugin (`tauri-plugin-wdio-webdriver`) is strictly gated behind Cargo feature `[features] webdriver` (`optional = true`) in `apps/desktop/src-tauri/Cargo.toml`. Release builds and default compilation targets exclude this feature, guaranteeing zero test driver symbols in production artifacts.

3. **Executable Contract Drift Enforcement**:
   An executable check (`scripts/verify/contract_drift.mjs`) is added to the baseline verification suite. It validates:
   - All schemas comply with JSON Schema Draft 2020-12.
   - The SHA-256 schema bundle hash is identical across Rust build scripts, Python sidecar metadata, and standalone verifiers.
   - The list of supported operations is 100% synchronized across JSON Schema (`handshake.schema.json`), Rust (`BackendOperation` enum), Python (`SUPPORTED_OPERATIONS`), and frontend contracts.

4. **Repository Toolchain Pinning**:
   - Node.js is pinned to `24.16.0` (`.node-version` and `package.json` engines).
   - Rust is pinned to `1.88.0` (`rust-toolchain.toml`, `rust-version = "1.88"`).
   - Python project metadata is defined in `services/python-backend/pyproject.toml` (target `>=3.12`).
   - All dependency installations must use frozen lockfiles (`pnpm install --frozen-lockfile`, `cargo --locked`).

5. **Strict Scope Discipline**:
   Phase 1 establishes the baseline hardening and governance. Phase 2 (theming, application shell, navigation rail, and layout components) remains strictly unauthorized until Phase 1 is formally reviewed, accepted, and closed.

---

## 3. Consequences

### Positive
- **Deterministic CI & Development**: Zero engine warnings, reproducible test outcomes, and frozen dependency resolutions.
- **Robust Security Posture**: Production release CSP is strictly enforced, least-privilege capability manifests are verified, and test drivers cannot leak into production.
- **Prevented Contract Divergence**: Cross-language protocol changes immediately break verification if not updated in all three language boundaries simultaneously.

### Tradeoffs
- Windows does not use custom title-bar chrome in the initial baseline, prioritizing native OS stability, accessibility, and Snap Layout reliability.
