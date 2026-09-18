# Contributing to Prime Shell

Welcome to the `prime-shell` project. This document outlines development setup, coding standards, branch policies, and verification gates for contributors and automated agents.

---

## 1. Project Authority and Scope Discipline

All work in this repository is governed by the project authority files in `docs/authority/`:
1. `generic-fluent-desktop-project-handoff.md`
2. `generic-fluent-desktop-app-architecture-v0.2.md`
3. `architecture-review-consolidation-decision-log.md`
4. `Core-Functionality-DeliveryRules.md`
5. `AGENTS.md`

### Core Rules
- **Phase Alignment**: Implement only the scope authorized by the current active work package. Do not begin unauthorized future phases (such as Phase 2 theming or Phase 7 release automation) without explicit package authorization.
- **No Speculative Abstractions**: Every component, abstraction, and type must serve a concrete, present need.
- **Truthful Status**: Report work using only approved status classifications (`Implemented`, `Partially implemented`, `Stub`, `Mock-only`, `Not started`, `Blocked`). Scaffolding or documentation must never be described as completed functionality.

---

## 2. Toolchain Requirements

Contributors must use the pinned toolchain versions:
- **Node.js**: `24.16.0` (managed via `.node-version`)
- **pnpm**: `11.7.0` (configured in `package.json` engines)
- **Rust**: `1.88.0` (configured in `rust-toolchain.toml`, `rust-version = "1.88"`)
- **Python**: `>=3.12` (runtime target 3.12.x; PyInstaller build dependencies locked in `services/python-backend/requirements-build.lock`)

---

## 3. Local Development Setup

### Fresh Checkout Initialization
```bash
# 1. Install frontend dependencies with frozen lockfile
pnpm install --frozen-lockfile

# 2. Run deterministic baseline quality checks
pnpm verify:baseline

# 3. Run Rust unit tests and clippy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings

# 4. Run Python backend unit tests
python3 -m unittest discover -s services/python-backend/tests -v
```

---

## 4. Contract Schema and Drift Discipline

JSON Schema Draft 2020-12 in `packages/app-contracts/schemas/` is the single source of truth for cross-language IPC contracts between the React webview, Tauri/Rust host, and Python sidecar.

- **Schema Modification**: Any change to schemas must be accompanied by updated valid/invalid test fixtures in `packages/app-contracts/fixtures/`.
- **Drift Verification**: Run `pnpm contract:drift` before committing. The verifier checks:
  1. Draft 2020-12 schema compilation.
  2. SHA-256 schema bundle hash consistency across Rust, Python, and JavaScript scripts.
  3. Strict alignment of supported operations across schemas, `BackendOperation` in Rust (`apps/desktop/src-tauri/src/backend/registry.rs`), `SUPPORTED_OPERATIONS` in Python (`services/python-backend/src/prime_shell_backend/protocol.py`), and frontend contracts.
- Stale or mismatched schemas will fail CI deterministically.

---

## 5. Security and Capability Constraints

- **Least Privilege**: The React webview is the least-trusted layer. Never expose generic filesystem, shell, process spawning, or raw system access to the webview.
- **Release CSP**: Strict Content Security Policy (`default-src 'self'`) is enforced in production. `unsafe-inline` is prohibited. Verify via `pnpm verify:security`.
- **Test-Only Capability Separation**: Integration plugins (such as `tauri-plugin-wdio-webdriver`) must remain strictly gated behind optional Cargo features (e.g. `--features webdriver`) and never included in default release binaries.
- **Zero Credentials**: Never commit secrets, certificates, API tokens, signing credentials, or environment dumps to source control or logs.

---

## 6. Supported Platform Matrix

| Platform | Target Architecture | Display / Engine | Packaging Target | Status |
|---|---|---|---|---|
| **Windows** | Windows 11 / 2022 (x64) | WebView2 | NSIS Installer (`.exe`) | Fully supported |
| **Ubuntu Linux** | Ubuntu 24.04 LTS (x64) | WebKitGTK (X11 / Wayland) | Debian Package (`.deb`) | Fully supported |
| **macOS** | macOS 14+ (arm64) | WKWebView | App Bundle / DMG | Build evaluated in CI (hardware unverified locally) |

---

## 7. Branching and Pull Request Workflow

1. Branch naming: `feat/<work-package-id>-<description>` or `fix/<defect-id>-<description>`.
2. Ensure working tree is clean and `pnpm verify:baseline` passes before opening a PR.
3. Keep PRs strictly scoped to one authorized work package.
4. Auto-merge is prohibited. Merging requires explicit review and acceptance.
