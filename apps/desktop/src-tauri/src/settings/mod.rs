pub mod migrations;
pub mod models;
pub mod storage;

pub use models::*;
pub use storage::SettingsManager;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    struct TestDir {
        path: std::path::PathBuf,
    }

    impl TestDir {
        fn new(prefix: &str) -> Self {
            let count = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "prime-shell-test-{prefix}-{count}-{}",
                std::process::id()
            ));
            let _ = fs::create_dir_all(&path);
            Self { path }
        }

        fn path(&self) -> &std::path::Path {
            &self.path
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn tempdir(prefix: &str) -> TestDir {
        TestDir::new(prefix)
    }

    #[test]
    fn test_default_settings() {
        let doc = SettingsDocument::default();
        assert_eq!(doc.schema_version, 1);
        assert_eq!(doc.revision, 0);
        assert_eq!(doc.appearance.theme_mode, "system");
        assert_eq!(doc.layout.sidebar_width, 280.0);
        assert_eq!(doc.document_analysis.max_top_terms, 20);
        assert_eq!(doc.text_utility.default_mode, "uppercase");
    }

    #[test]
    fn test_atomic_write_and_previous_copy() {
        let dir = tempdir("test");
        let primary = dir.path().join("settings.json");
        let previous = dir.path().join("settings.previous.json");
        let temp = dir.path().join("settings.tmp");
        let legacy = dir.path().join("shell_layout_v1.json");

        let manager = SettingsManager::new_from_paths(
            primary.clone(),
            previous.clone(),
            temp.clone(),
            legacy.clone(),
        );

        assert!(primary.exists());
        assert_eq!(manager.get_document().revision, 0);

        // Update settings
        let mut update = manager.get_document();
        update.appearance.theme_mode = "dark".to_string();
        update.layout.sidebar_width = 320.0;

        let res = manager.save_document(0, update);
        assert!(res.is_ok());
        let updated_doc = res.unwrap();
        assert_eq!(updated_doc.revision, 1);
        assert_eq!(updated_doc.appearance.theme_mode, "dark");
        assert_eq!(updated_doc.layout.sidebar_width, 320.0);

        // Verify previous copy exists
        assert!(previous.exists());

        // Update again
        let mut update2 = manager.get_document();
        update2.layout.sidebar_width = 350.0;
        let res2 = manager.save_document(1, update2);
        assert!(res2.is_ok());
        assert_eq!(res2.unwrap().revision, 2);
    }

    #[test]
    fn test_stale_revision_rejected() {
        let dir = tempdir("test");
        let manager = SettingsManager::new_from_paths(
            dir.path().join("settings.json"),
            dir.path().join("settings.previous.json"),
            dir.path().join("settings.tmp"),
            dir.path().join("shell_layout_v1.json"),
        );

        let mut update = manager.get_document();
        update.appearance.theme_mode = "light".to_string();

        // Pass wrong expected revision 99 instead of 0
        let res = manager.save_document(99, update);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Stale revision"));
    }

    #[test]
    fn test_migration_from_legacy_layout() {
        let dir = tempdir("test");
        let primary = dir.path().join("settings.json");
        let previous = dir.path().join("settings.previous.json");
        let temp = dir.path().join("settings.tmp");
        let legacy = dir.path().join("shell_layout_v1.json");

        // Write legacy layout file
        let legacy_json = r#"{
            "schemaVersion": 1,
            "sidebarWidth": 315.0,
            "sidebarCollapsed": false,
            "inspectorWidth": 380.0,
            "inspectorOpen": true,
            "bottomPanelHeightRatio": 0.40,
            "bottomPanelOpen": true,
            "activeNavigationId": "analysis"
        }"#;
        fs::write(&legacy, legacy_json).unwrap();

        let manager = SettingsManager::new_from_paths(primary.clone(), previous, temp, legacy);
        let doc = manager.get_document();

        assert_eq!(doc.layout.sidebar_width, 315.0);
        assert_eq!(doc.layout.inspector_width, 380.0);
        assert_eq!(doc.layout.bottom_panel_height_ratio, 0.40);
        assert!(doc.layout.bottom_panel_open);
        assert_eq!(doc.layout.active_navigation_id.as_deref(), Some("analysis"));
        assert_eq!(doc.appearance.theme_mode, "system"); // default
        assert!(primary.exists()); // Migrated file written to primary
    }

    #[test]
    fn test_recovery_from_corrupt_primary() {
        let dir = tempdir("test");
        let primary = dir.path().join("settings.json");
        let previous = dir.path().join("settings.previous.json");
        let temp = dir.path().join("settings.tmp");
        let legacy = dir.path().join("shell_layout_v1.json");

        // Write valid previous copy
        let valid_doc = SettingsDocument {
            schema_version: 1,
            revision: 5,
            appearance: AppearanceSettings {
                theme_mode: "dark".to_string(),
                ..Default::default()
            },
            ..Default::default()
        };
        fs::write(&previous, serde_json::to_string(&valid_doc).unwrap()).unwrap();

        // Write corrupted primary file
        fs::write(&primary, "{ this is not valid json!").unwrap();

        let manager = SettingsManager::new_from_paths(primary.clone(), previous, temp, legacy);
        let doc = manager.get_document();

        assert_eq!(doc.appearance.theme_mode, "dark");
        assert_eq!(
            doc.status.as_ref().map(|s| s.state.as_str()),
            Some("recovered_from_previous_copy")
        );
        // Corruption evidence is preserved!
        assert_eq!(
            fs::read_to_string(&primary).unwrap(),
            "{ this is not valid json!"
        );
    }

    #[test]
    fn test_section_scoped_recovery() {
        let dir = tempdir("test");
        let primary = dir.path().join("settings.json");
        let previous = dir.path().join("settings.previous.json");
        let temp = dir.path().join("settings.tmp");
        let legacy = dir.path().join("shell_layout_v1.json");

        // Primary has invalid documentAnalysis section but valid layout & appearance
        let json_with_invalid_section = r#"{
            "schemaVersion": 1,
            "revision": 2,
            "appearance": {
                "themeMode": "dark",
                "accentMode": { "mode": "default" },
                "density": "compact",
                "materialPreference": "system"
            },
            "layout": {
                "schemaVersion": 1,
                "sidebarWidth": 330.0,
                "sidebarCollapsed": false,
                "inspectorWidth": 360.0,
                "inspectorOpen": true,
                "bottomPanelHeightRatio": 0.30,
                "bottomPanelOpen": false,
                "activeNavigationId": "workspace"
            },
            "documentAnalysis": "invalid-not-an-object",
            "textUtility": {
                "defaultMode": "lowercase"
            }
        }"#;
        fs::write(&primary, json_with_invalid_section).unwrap();

        let manager = SettingsManager::new_from_paths(primary, previous, temp, legacy);
        let doc = manager.get_document();

        // Preserved valid sections
        assert_eq!(doc.appearance.theme_mode, "dark");
        assert_eq!(doc.appearance.density, "compact");
        assert_eq!(doc.layout.sidebar_width, 330.0);
        assert_eq!(doc.text_utility.default_mode, "lowercase");

        // Recovered document analysis section
        assert_eq!(doc.document_analysis.max_top_terms, 20); // default
        assert_eq!(
            doc.status.as_ref().map(|s| s.state.as_str()),
            Some("section_recovered")
        );
        assert_eq!(
            doc.status
                .as_ref()
                .and_then(|s| s.recovered_section.as_deref()),
            Some("documentAnalysis")
        );
    }

    #[test]
    fn test_unsupported_future_version_is_read_only() {
        let dir = tempdir("test");
        let primary = dir.path().join("settings.json");
        let previous = dir.path().join("settings.previous.json");
        let temp = dir.path().join("settings.tmp");
        let legacy = dir.path().join("shell_layout_v1.json");

        let future_json = r#"{
            "schemaVersion": 99,
            "revision": 100,
            "appearance": {}
        }"#;
        fs::write(&primary, future_json).unwrap();

        let manager = SettingsManager::new_from_paths(primary.clone(), previous, temp, legacy);
        let doc = manager.get_document();

        assert_eq!(
            doc.status.as_ref().map(|s| s.state.as_str()),
            Some("unsupported_future_version")
        );

        // Attempting to save fails because it is read-only
        let mut update = doc.clone();
        update.appearance.theme_mode = "dark".to_string();
        let res = manager.save_document(doc.revision, update);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("read-only"));

        // File is NOT overwritten
        assert!(fs::read_to_string(&primary)
            .unwrap()
            .contains("\"schemaVersion\": 99"));
    }

    #[test]
    fn test_reset_setting_and_reset_section_and_reset_all() {
        let dir = tempdir("test");
        let manager = SettingsManager::new_from_paths(
            dir.path().join("settings.json"),
            dir.path().join("settings.previous.json"),
            dir.path().join("settings.tmp"),
            dir.path().join("shell_layout_v1.json"),
        );

        // Modify multiple settings
        let mut update = manager.get_document();
        update.appearance.theme_mode = "dark".to_string();
        update.layout.sidebar_width = 380.0;
        update.document_analysis.max_top_terms = 50;
        update.text_utility.default_mode = "titlecase".to_string();
        let _ = manager.save_document(0, update).unwrap();

        // 1. Reset one setting: documentAnalysis.maxTopTerms
        let after_single_reset = manager
            .reset_setting("documentAnalysis", "maxTopTerms")
            .unwrap();
        assert_eq!(after_single_reset.document_analysis.max_top_terms, 20); // reset
        assert_eq!(after_single_reset.layout.sidebar_width, 380.0); // preserved

        // 2. Reset one section: layout
        let after_section_reset = manager.reset_section("layout").unwrap();
        assert_eq!(after_section_reset.layout.sidebar_width, 280.0); // reset to default
        assert_eq!(after_section_reset.appearance.theme_mode, "dark"); // preserved

        // 3. Reset all
        let after_reset_all = manager.reset_all().unwrap();
        assert_eq!(after_reset_all.appearance.theme_mode, "system"); // reset
        assert_eq!(after_reset_all.text_utility.default_mode, "uppercase"); // reset
    }
}
