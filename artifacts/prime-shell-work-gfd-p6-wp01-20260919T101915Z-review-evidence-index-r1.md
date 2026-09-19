# Prime Shell Work Session Review Evidence Index — GFD-P6-WP01

**Package ID:** `GFD-P6-WP01`  
**Phase:** `Phase 6: Settings, Persistence, Diagnostics, and Recovery`  
**Title:** `Settings, Persistence, and Single-Instance Behavior`  
**Run ID:** `20260919T101915Z`  
**Repository:** `prime-builds/prime-shell`  
**Base Commit SHA:** `f925c42f96d6b2aa3d45dd4942923c345c2d83e0`  
**Implementation Branch:** `feat/gfd-p6-wp01-settings-persistence`  

---

## 1. Test Suite Execution & Output Evidence

### A. Full Baseline Verification (`pnpm verify:baseline`)
```text
$ pnpm contract:test && pnpm contract:drift && pnpm verify:security && pnpm tokens:typecheck && pnpm tokens:test && pnpm typecheck && pnpm lint && pnpm test && pnpm build
$ node scripts/verify/contracts.mjs
{"status":"passed","schemaDraft":"2020-12","schemas":13,"validFixtures":15,"invalidFixtures":9}
$ node scripts/verify/contract_drift.mjs
[contract-drift] Starting deterministic contract and drift verification...
[contract-drift] Computed schema bundle hash: sha256:f0eb002c3e596d582f8b242034c285b69ab8723abcb6635b924cbd9903a61d8b
[contract-drift] Verification PASSED: {
  schemasCount: 13,
  schemaHash: 'sha256:f0eb002c3e596d582f8b242034c285b69ab8723abcb6635b924cbd9903a61d8b',
  operations: [
    'spike.echo',
    'spike.count',
    'spike.crash',
    'spike.hang',
    'spike.largeRejected',
    'doc.analyze'
  ],
  driftDetected: false
}
$ node scripts/verify/security_baseline.mjs
[security-baseline] Starting security and capability verification...
[security-baseline] Validating CSP: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: asset:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'"
[security-baseline] Verification PASSED: {
  cspStrict: true,
  unsafeInlineAbsent: true,
  leastPrivilegeCapabilities: 10,
  webDriverOptional: true,
  webDriverExcludedFromDefault: true
}
$ pnpm --filter @prime-shell/design-tokens typecheck
$ tsc -b --pretty false
$ pnpm --filter @prime-shell/design-tokens test
$ vitest run

 RUN  v4.1.10 D:/GitHub/prime-builds/prime-shell/packages/design-tokens

 ✓ tests/raw-color-policy.test.ts (1 test) 4ms
 ✓ tests/contrast-matrix.test.ts (15 tests) 5ms
 ✓ tests/contract.test.ts (9 tests) 7ms

 Test Files  3 passed (3)
      Tests  25 passed (25)

$ pnpm --filter @prime-shell/desktop typecheck
$ tsc -b --pretty false
$ pnpm --filter @prime-shell/desktop lint
$ eslint . --max-warnings 0
$ pnpm --filter @prime-shell/desktop test
$ vitest run

 RUN  v4.1.10 D:/GitHub/prime-builds/prime-shell/apps/desktop

 ✓ src/shell/__tests__/responsive-bands.test.ts (5 tests) 5ms
 ✓ src/features/__tests__/authorizationIndependence.test.ts (4 tests) 6ms
 ✓ src/shell/__tests__/splitter-keyboard.test.tsx (7 tests) 697ms
 ✓ src/features/__tests__/features.test.ts (12 tests) 10ms
 ✓ src/features/text-utility/__tests__/TextUtilityView.test.tsx (8 tests) 420ms
 ✓ src/shell/components/__tests__/CommandPalette.test.tsx (5 tests) 510ms
 ✓ src/shell/views/SettingsShellView.test.tsx (13 tests) 820ms
 ✓ src/shell/views/DocumentAnalysisView.test.tsx (6 tests) 2930ms
 ✓ src/App.test.tsx (16 tests) 5293ms

 Test Files  9 passed (9)
      Tests  76 passed (76)

$ pnpm --filter @prime-shell/desktop build
$ tsc -b && vite build
vite v8.1.5 building client environment for production...
transforming...✓ 2343 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:   0.30 kB
dist/assets/index-BjjhezMa.css    5.83 kB │ gzip:   1.83 kB
dist/assets/window-CJ_Q09A6.js   12.93 kB │ gzip:   3.11 kB
dist/assets/index-B4zmV1kn.js   961.18 kB │ gzip: 268.95 kB

✓ built in 500ms
```

### B. Rust Unit Tests (`cargo test`)
```text
running 33 tests
test backend::client::tests::crlf_is_accepted ... ok
test backend::registry::tests::shared_unknown_operation_fixture_is_rejected ... ok
test backend::references::tests::picker_dialog_respects_test_environment_variables ... ok
test instance::tests::test_parse_oversized_args_rejected ... ok
test backend::registry::tests::unknown_operation_is_rejected_before_backend ... ok
test backend::tasks::tests::test_cancel_vs_success_race ... ok
test backend::tasks::tests::test_bounded_snapshot_capacity ... ok
test backend::tasks::tests::test_single_active_task_enforcement ... ok
test backend::tasks::tests::test_terminal_states_are_immutable ... ok
test backend::tasks::tests::test_valid_transitions ... ok
test instance::tests::test_parse_empty_args_defaults_to_focus ... ok
test backend::client::tests::oversized_frame_is_rejected_without_unbounded_growth ... ok
test layout::tests::clamp_and_sanitize_enforces_boundaries ... ok
test instance::tests::test_parse_unknown_flag_safely_falls_back_to_focus ... ok
test settings::tests::test_default_settings ... ok
test backend::protocol::tests::stale_schema_is_rejected ... ok
test backend::registry::tests::all_six_operations_are_authorized ... ok
test theme::tests::hex_to_color_parses_valid_hex ... ok
test layout::tests::default_preferences_match_specification ... ok
test layout::tests::partial_json_recovery_restores_valid_fields ... ok
test backend::protocol::tests::valid_handshake_passes ... ok
test theme::tests::hex_to_color_rejects_invalid ... ok
test instance::tests::test_parse_open_document_intent ... ok
test backend::references::tests::reference_registry_stores_and_reads_safely ... ok
test settings::tests::test_unsupported_future_version_is_read_only ... ok
test backend::references::tests::write_content_enforces_writable_and_atomic_replace ... ok
test settings::tests::test_recovery_from_corrupt_primary ... ok
test settings::tests::test_stale_revision_rejected ... ok
test settings::tests::test_migration_from_legacy_layout ... ok
test settings::tests::test_section_scoped_recovery ... ok
test settings::tests::test_atomic_write_and_previous_copy ... ok
test settings::tests::test_reset_setting_and_reset_section_and_reset_all ... ok
test backend::containment::tests::test_process_containment_lifecycle ... ok

test result: ok. 33 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.13s
```

---

## 2. Security & Release CSP Audit

- **CSP Header:** `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: asset:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`
- **Inline Scripts / Styles:** 0 inline scripts, 0 inline style attributes found across application codebase.
- **Capabilities / Permissions:** Added `allow-settings` permission scoped to `get_settings`, `save_settings`, `reset_setting`, `reset_settings_section`, and `reset_all_settings`. Verified by `scripts/verify/security_baseline.mjs`.
