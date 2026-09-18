# Prime Shell

[![CI Baseline](https://github.com/prime-builds/prime-shell/actions/workflows/ci.yml/badge.svg)](https://github.com/prime-builds/prime-shell/actions/workflows/ci.yml)

**Prime Shell** is a reusable cross-platform desktop application foundation inspired by Microsoft Fluent 2 and the Windows 11 design language.

It provides a production-hardened desktop host combining a modern React webview, a memory-safe Rust native policy authority, and an isolated, packaged Python sidecar for native domain computation.

---

## Architecture Overview

```text
┌──────────────────────── React / TypeScript Frontend ────────────────────────┐
│ - Fluent UI React v9 components, design tokens, and Griffel styling         │
│ - Zustand for UI state; TanStack Query for fetchable state                  │
│ - Strict CSP: zero unsafe-inline, zero arbitrary remote content              │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Typed Tauri 2 IPC
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ Tauri 2 / Rust Native Policy Host                                           │
│ - Native window authority, system menus, file dialogs, and durable settings  │
│ - Sidecar process ownership, process-tree containment (zero zombie processes)│
│ - Compile-time operation registry and least-privilege capability enforcement │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Bounded JSON Lines over stdio (UTF-8)
┌──────────────────────────────────────▼───────────────────────────────────────┐
│ Packaged Python Sidecar                                                     │
│ - PyInstaller onedir standalone bundle; zero ambient Python required on host │
│ - Schema bundle hash validated during startup handshake                      │
│ - Cooperative cancellation, coalesced progress, bounded task execution       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Status

- **Phase 0A (Constraints & Risk Definition)**: Accepted and frozen.
- **Phase 0B (Lean Cross-Platform Spike)**: Completed, verified, and closed (`v0.2.0-phase0b-closure`).
- **Phase 1 (Hardening Baseline)**: Work package `GFD-P1-WP01` active. Toolchains pinned, drift protection and security baseline enforced.
- **Phase 2 (Design System & Shell)**: `Not started` (unauthorized until Phase 1 closure).

---

## Pinned Toolchain

To ensure deterministic, reproducible builds across development and CI, versions are strictly pinned:
- **Node.js**: `24.16.0` (`.node-version`)
- **pnpm**: `11.7.0` (`package.json`)
- **Rust**: `1.88.0` (`rust-toolchain.toml`)
- **Python**: `>=3.12` (`services/python-backend/pyproject.toml`; build locked in `requirements-build.lock`)

---

## Quickstart & Verification

```bash
# 1. Install dependencies with frozen lockfile
pnpm install --frozen-lockfile

# 2. Run full repository verification baseline (contracts, drift, security, lint, test, build)
pnpm verify:baseline

# 3. Run Rust unit tests and clippy
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --locked
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --locked --all-targets --all-features -- -D warnings

# 4. Run Python backend tests
python3 -m unittest discover -s services/python-backend/tests -v
```

---

## Supported Platform Matrix

| Platform | Target Architecture | Display Engine | Package Format | Baseline Window Chrome |
|---|---|---|---|---|
| **Windows** | Windows 11 / 2022 (x64) | WebView2 | NSIS Installer (`.exe`) | Native fallback (`decorations: true`) |
| **Ubuntu Linux** | Ubuntu 24.04 LTS (x64) | WebKitGTK | Debian Package (`.deb`) | Native window decorations |
| **macOS** | macOS 14+ (arm64) | WKWebView | App Bundle / DMG | Native traffic lights (CI evaluated) |

---

## Documentation Links

- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Release Baseline Guidance](docs/release/release-baseline.md)
- [Project Authority Documents](docs/authority/)
