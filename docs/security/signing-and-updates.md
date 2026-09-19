# Prime Shell: Release Signing, Notarization, and Signed Update Channels

**Document Status:** Authoritative Security & Operations Architecture  
**Package:** `GFD-P7-WP02`  
**Target:** Windows 11 x64, macOS arm64, Ubuntu 24.04 x64  

---

## 1. Trust Architecture & Key Separation

Prime Shell enforces strict separation between application code-signing trust roots and application updater trust roots:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Trust Roots & Separation                           │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Application Code Signing             │ Updater & Channel Signing            │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ - Windows Authenticode (EV/OV)       │ - Ed25519 / Minisign Keypair         │
│ - Apple Developer ID Application     │ - Public key embedded in client      │
│ - Governs OS-level execution trust   │ - Private key in protected CI/HSM    │
│ - Hardware-bound/KMS protected       │ - Signs update manifest & artifacts  │
│ - RFC 3161 / Apple notary timestamp  │ - Enforces anti-downgrade & channel  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### A. Independent Trust Roles
1. **Windows Authenticode:**
   - Digest algorithm: SHA-256 with RFC 3161 compliant timestamping (`http://timestamp.digicert.com`).
   - Signs binary (`prime-shell-desktop.exe`) and NSIS installer (`prime-shell-setup.exe`).
   - Independent verification via `Get-AuthenticodeSignature`.
   - Cryptographic validity is maintained independently of SmartScreen reputation.
2. **Apple Developer ID & Hardened Runtime:**
   - Developer ID Application identity used for inside-out nested signing: sidecar binaries, dylibs, frameworks, helpers, and the main `.app` bundle.
   - Enforces Hardened Runtime (`--options runtime`) and minimal entitlements (`entitlements.plist`).
   - Notarization submission via `xcrun notarytool` with ticket stapling via `xcrun stapler staple`.
   - Gatekeeper verification via `spctl --assess --type exec -v`.
3. **Updater Signing & Public Verifier:**
   - Algorithm: Ed25519 / Minisign format.
   - Public verifier embedded in `UpdateManager` (`PUBLIC_VERIFIER_KEY`).
   - Signs canonical JSON manifests (`updateManifest`) and platform download artifacts.
4. **Linux Packaging & Integrity:**
   - Ubuntu 24.04 x64 `.deb` package integrity verified via SHA-256 digests.
   - Explicitly isolated from unsupported background updater or repository signing claims.

---

## 2. Channel Isolation: Stable vs. Beta

Prime Shell provides two strictly isolated release channels:

| Channel | Purpose | Metadata Namespace | Promotion Policy |
|---|---|---|---|
| **Stable** | Production-ready, fully verified releases | `/channels/stable/latest.json` | Requires explicit approval and full test pass |
| **Beta** | Pre-release preview builds for early testing | `/channels/beta/latest.json` | Automated staging; isolated from stable clients |

### Channel Security Invariants
- **No Silent Crossing:** A stable client only discovers and applies updates from the stable channel; beta manifests are rejected with `Channel mismatch`.
- **No Auto-Promotion:** Beta builds never automatically become stable; stable releases require explicit manifest publication.
- **Client Selection:** Users select their channel in `Settings > Updates & Release Channels`. Changing channels immediately resets the update state machine to `idle`.

---

## 3. Versioning, Anti-Downgrade & Anti-Replay

1. **Semantic Versioning:**
   - Versions adhere to `MAJOR.MINOR.PATCH[-PRERELEASE]`.
   - Parsed and compared via Rust `Semver` struct.
2. **Anti-Downgrade Enforcement:**
   - An update is valid only if `target_version > current_version`.
   - Equal versions return `UpToDate`.
   - Lower versions are rejected as invalid downgrade attempts.
3. **Anti-Replay & Stale Detection:**
   - Manifests include ISO-8601 UTC `pub_date`.
   - Stale manifests or timestamps older than the installed release threshold are rejected.
4. **Atomic Installation & Recovery:**
   - Downloads are staged to temporary files and verified against SHA-256 digests and cryptographic signatures before execution.
   - Incomplete downloads or interrupted installations leave no partial state or corrupted settings.

---

## 4. Key Management, Custody, Rotation & Compromise

### A. Key Custody
- Private signing keys are stored exclusively in hardware security modules (HSM) or cloud KMS (e.g. Azure Key Vault, AWS KMS, Apple Developer Portal).
- Keys are never placed in source code, build caches, git repositories, or environment variable dumps.

### B. Planned Rotation Procedure
- Updater verifier rotation uses dual-signed transition manifests where artifacts are signed with both old and new keys during a defined overlap window.
- Client applications update their embedded public key during regular stable updates.

### C. Compromise & Emergency Freeze
- In the event of a suspected key compromise:
  1. Immediately trigger an **Emergency Channel Freeze**: revoke and withdraw manifests from the staging origin.
  2. Issue a certificate revocation request to the issuing CA (DigiCert / Apple).
  3. Deploy a patched release with an updated public verifier key.
  4. Perform post-incident audit and log analysis.

---

## 5. Publication Boundary & Controls

- **Staging Origin:** Non-public, controlled storage origin used strictly for testing signed metadata and artifacts before distribution.
- **Publication Gate:** Public releases, GitHub Releases publication, store distribution, customer rollouts, and enterprise deployments remain strictly unauthorized under Phase 7 and require explicit separate user authorization.
- **Privacy & Telemetry:** Prime Shell includes zero remote telemetry, tracking, or automated crash reporting.
