# Prime Shell Work Session Handoff Manifest — GFD-P6-WP01

**Task Name:** `GFD-P6-WP01: Settings, Persistence, and Single-Instance Behavior`  
**Phase:** `Phase 6`  
**Run ID:** `20260919T101915Z`  
**Repository:** `prime-builds/prime-shell`  
**Dedicated Branch:** `feat/gfd-p6-wp01-settings-persistence`  
**Base Commit SHA:** `f925c42f96d6b2aa3d45dd4942923c345c2d83e0` (`feat(p5-wp01): second consumer and proven feature contracts (#10)`)  

---

## 1. Deliverables Produced

| File | Purpose | Size (Bytes) | SHA-256 Digest |
|---|---|---|---|
| `packages/app-contracts/schemas/settings.schema.json` | Canonical settings document JSON Schema (Draft 2020-12) | 3,923 | `3a18aefeebebc09f19ad18b95871f37df26e849909dd676a0fbaf4ba7bfd2d88` |
| `packages/app-contracts/fixtures/settings/valid-v1.json` | Valid v1 settings document fixture | 450 | `bbf5ca0ec70c2f2d2bb78a1bc1b691060934e62a14e1a0b333cf483cfd1dbb8e` |
| `packages/app-contracts/fixtures/settings/legacy-layout-v1.json` | Legacy layout preferences fixture for migration testing | 215 | `5b78ca9de5f9ff709fa2bc85d2fb39a9cbb3b37803d58ef8fa5f91eb751cf835` |
| `packages/app-contracts/fixtures/settings/invalid-section.json` | Settings with corrupt appearance section fixture | 450 | `872e61df3e8bbda6bda6bcbc192931dc1ef6b2fbb1b9338fdbfc0f074d2cb378` |
| `packages/app-contracts/fixtures/settings/future-version-v99.json` | Forward-version settings document fixture | 380 | `4fa84094a9d70eb0092c733ea7071ef286395b0fe1a011ea354cfa2281a8b3be` |
| `packages/app-contracts/fixtures/settings/unknown-fields.json` | Rejected unknown fields fixture | 460 | `28e469534958619bc181b53e82b7ca579ae7a52e90e797829707e78072e9d242` |
| `packages/app-contracts/fixtures/settings/corrupt.json.txt` | Malformed JSON fixture for parser error handling | 28 | `fc5db8890cf5a73e6593a201c10705a109ecf385c2c4d9a4df54b281f6d3ce1c` |
| `apps/desktop/src-tauri/src/settings/models.rs` | Rust settings models, bounds, and serde serialization | 6,375 | `49633e7208d169dfa6fb694a558b9d628eb4bc6eb7719ce391104eec24f5aee3` |
| `apps/desktop/src-tauri/src/settings/migrations.rs` | Migration chain, section isolation, and recovery | 5,888 | `66870aeef971e4eb411fef80f55ce624f2b153ff297745778ea2ec72bafe29a6` |
| `apps/desktop/src-tauri/src/settings/storage.rs` | Atomic persistence, previous copy, and typed resets | 11,765 | `6027a4d33dd51bead13e614bc75ae1fb3dbf46990425c2765874aa2d5926ec39` |
| `apps/desktop/src-tauri/src/settings/mod.rs` | Rust settings unit and integration tests | 12,019 | `41f4fc14227f71fecfef0fe80766ff3d283626210f925cfa95a7f2ec2b535d8e` |
| `apps/desktop/src-tauri/src/instance/mod.rs` | Single-instance plugin init, focus, and intent forwarding | 6,654 | `aa831b142646d6eb13257dff69b2d869273c880193188c00aaeeaa8bfa79f67b` |
| `apps/desktop/src-tauri/src/layout.rs` | Bridged legacy shell layout commands to SettingsManager | 3,186 | `b0dfc6e7f827d0959f636253c395a1a1ae17eecbcbbbe92f25b331000fe99951` |
| `apps/desktop/src-tauri/src/lib.rs` | Tauri commands and single-instance registration | 6,644 | `8984920fcff311394c50269389a622c9ca9a33465b058a91275bb2ce739775f5` |
| `apps/desktop/src-tauri/permissions/app.toml` | Least-privilege `allow-settings` permission definition | 1,446 | `9feecba6c0ce8f310f8541a7c5c8397a66f2aeeeb09e02c658f8b6ce87ba9aa6` |
| `apps/desktop/src-tauri/capabilities/main.json` | Capability configuration with `allow-settings` | 647 | `f5ae330ffcfcf759ea7dd7c9360580dae48ff2f7f9aa56a84d47ea955f053229` |
| `apps/desktop/src/shell/state/useSettingsStore.ts` | Zustand store for settings with debounced save & resets | 6,150 | `4e55e8869bbd513824ee79fba50d5e1dccebe0f5a7daee361dcbfd873d93bfbe` |
| `apps/desktop/src/theme/ThemeContext.tsx` | Theme context backed by useSettingsStore (no localStorage) | 8,989 | `84fba15858cf0696eb1e67cf756461a293bf69986b24d9c4aaeb0b0c44bc7a61` |
| `apps/desktop/src/shell/views/SettingsShellView.tsx` | Accessible, searchable settings view with recovery notices | 42,185 | `bb4e92a2a0ff52fef972a9e34e565ca77a33b0e3ec8baadfa6da1ec92361661d` |
| `apps/desktop/src/shell/views/SettingsShellView.test.tsx` | Comprehensive unit tests for Settings view & search | 5,420 | `e5a6a695cba8933b93f18e9063bc97a9f77e68cfc6bc143c3f91572c67b2d287` |
| `docs/work-packages/prompts/GFD-P6-WP01.md` | Synchronized prompt status to Completed and Implemented | 72,578 | `c97cf7cf44e451b6ce6f8e77a285d3ba928a38c23f2f8aaee28646b9fe503c27` |
| `docs/work-packages/roadmap-index.md` | Synchronized roadmap status to Implemented | 25,248 | `429dbbf9c4a86f1e298516ee89ba9622d645e85c2c7b508f7aa903a985f403be` |
| `artifacts/prime-shell-work-gfd-p6-wp01-20260919T101915Z-settings-persistence-report-r1.md` | Work session implementation report | 9,754 | `53B8D1DFF62E95324758CFC9D4E64364232EC761CBC30BB74F4780FCBB324350` |
| `artifacts/prime-shell-work-gfd-p6-wp01-20260919T101915Z-review-evidence-index-r1.md` | Verification evidence index | 6,869 | `19488BA06D37AC5808ADC99307C07B513A7C4267DEE90D7D5C6583FF5FE480DA` |
| `artifacts/prime-shell-work-gfd-p6-wp01-20260919T101915Z-source-snapshot-r1.zip` | Complete authoritative source snapshot archive | 997,931 | `CBD9D835B94AE7D39CA47DE6D440A8ADE545FB9AB49BE2D90E1B5049D1AA8692` |

---

## 2. Verification Summary

- **Contract Schema Validation:** 13 schemas, 15 valid fixtures, 9 invalid fixtures passed (`pnpm contract:test`).
- **Contract Drift Guard:** 0 drift detected across JSON Schema, TypeScript, Rust, and Python (`pnpm contract:drift`).
- **Security Baseline:** Strict release CSP verified (0 inline scripts/styles), 10 authorized least-privilege capabilities including `allow-settings` (`pnpm verify:security`).
- **Design Tokens Suite:** 25 passed, 0 failed (`pnpm tokens:test`).
- **TypeScript Typecheck:** 0 errors across workspace (`pnpm typecheck`).
- **ESLint:** 0 warnings, 0 errors (`pnpm lint`).
- **Desktop Vitest Suite:** 76 passed across 9 test files (`pnpm test`).
- **Desktop Production Build:** Vite production bundle generated cleanly in 500ms (`pnpm build`).
- **Full Baseline Suite:** Complete `verify:baseline` suite passed (`pnpm verify:baseline`).
- **Rust Backend Tests:** 33 passed, 0 failed, 7 ignored (`cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`).

---

## 3. Scope Exclusions Respected

- No product database, SQLite, or cross-device sync.
- No multiple workspaces without concrete requirements.
- No separate native settings window; in-window settings shell view preserved.
- No secrets in settings; settings file contains only safe application preferences.
- No diagnostics export, remote telemetry, or release updater logic.
- Strict release CSP preserved (0 inline scripts/styles).

---

## 4. Recommended Next Controlled Action

Per Section 11 of `AGENTS.md`:
1. Stage all deliverables, source code, and synchronized documents.
2. Commit on dedicated branch `feat/gfd-p6-wp01-settings-persistence`.
3. Push branch to remote and create Pull Request against `main`.
4. **STOP and wait for explicit user approval before merging.**
