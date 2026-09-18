# Security Policy — Prime Shell

## 1. Security & Trust Architecture

`prime-shell` enforces a strict 3-tier defense-in-depth architecture across all components:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ React / TypeScript Webview (Least-Trusted Layer)                       │
│ - Strict CSP enforced: default-src 'self'; no 'unsafe-inline'.          │
│ - Zero direct shell, process, raw filesystem, or arbitrary IPC access. │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Typed Tauri Commands & Channels
┌────────────────────────────────────▼────────────────────────────────────┐
│ Tauri 2 / Rust Native Host (Native Policy Authority)                    │
│ - Strict compile-time operation registry and permission validation.     │
│ - Process lifecycle ownership, process-tree containment, zero zombies.  │
│ - Enforces timeouts, message bounds (max 1 MB), and rate limiting.      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Bounded JSON Lines over stdio (UTF-8)
┌────────────────────────────────────▼────────────────────────────────────┐
│ Packaged Python Sidecar (Trusted Native Worker)                         │
│ - Packaged onedir runtime (PyInstaller); zero ambient host requirement. │
│ - Launched with no shell, minimal constructed environment.              │
│ - Deterministic schema bundle hash verification upon handshake.         │
│ - Non-sandboxed user privilege; bounded by explicit contracts only.     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Security Boundaries

1. **Least-Privilege Capabilities**:
   Tauri capability files in `apps/desktop/src-tauri/capabilities/` and `permissions/` expose only explicit, authorized commands (`allow-backend-status`, `allow-echo-text`, `allow-task-lifecycle`, `allow-runtime-probe`). Generic ambient plugins (`shell`, `fs`, `process`) are strictly forbidden.

2. **Strict Release CSP**:
   The Content Security Policy prohibits remote origins, wildcards, and script evaluation:
   ```text
   default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: asset:;
   font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none';
   frame-ancestors 'none'; base-uri 'self'; form-action 'none'
   ```

3. **Test Capability Gating**:
   End-to-end automation drivers (such as `tauri-plugin-wdio-webdriver`) are gated behind Cargo `[features] webdriver` and are stripped from production release binaries. Production binaries are scanned in CI to verify zero WebDriver symbols.

4. **Network Denied by Default**:
   The application is fully offline-capable. No telemetry, automatic update pings, or background cloud connections are established by default.

5. **Secrets & Credential Hygiene**:
   No cryptographic keys, signing certificates, API secrets, or personally identifiable information are allowed in source code, commits, configuration, or test artifacts.

---

## 3. Reporting a Vulnerability

If you discover a security issue or vulnerability in `prime-shell`, please report it responsibly:

- **Do NOT open a public issue** on GitHub.
- Submit reports to the project maintainers via encrypted email or GitHub Private Security Advisory.
- Include a detailed description of the vulnerability, step-by-step reproduction instructions, and an assessment of affected platform targets.
- The project team will acknowledge receipt within 48 hours and provide a remediation timeline.
