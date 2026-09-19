use crate::settings::{models::ShellLayoutPreferencesV1, SettingsManager};
use tauri::State;

pub use crate::settings::models::{
    CURRENT_SCHEMA_VERSION as SCHEMA_VERSION, DEFAULT_BOTTOM_PANEL_RATIO, DEFAULT_INSPECTOR_WIDTH,
    DEFAULT_SIDEBAR_WIDTH, MAX_BOTTOM_PANEL_RATIO, MAX_INSPECTOR_WIDTH, MAX_SIDEBAR_WIDTH,
    MIN_BOTTOM_PANEL_RATIO, MIN_INSPECTOR_WIDTH, MIN_SIDEBAR_WIDTH,
};

pub use crate::settings::models::ShellLayoutPreferencesV1 as LayoutPreferences;

#[tauri::command]
pub fn get_shell_layout_preferences(
    settings: State<'_, SettingsManager>,
) -> Result<ShellLayoutPreferencesV1, String> {
    Ok(settings.get_document().layout)
}

#[tauri::command]
pub fn save_shell_layout_preferences(
    settings: State<'_, SettingsManager>,
    mut preferences: ShellLayoutPreferencesV1,
) -> Result<(), String> {
    preferences.clamp_and_sanitize();
    let current_doc = settings.get_document();
    let mut new_doc = current_doc.clone();
    new_doc.layout = preferences;
    settings.save_document(current_doc.revision, new_doc)?;
    Ok(())
}

#[tauri::command]
pub fn reset_shell_layout_preferences(
    settings: State<'_, SettingsManager>,
) -> Result<ShellLayoutPreferencesV1, String> {
    let doc = settings.reset_section("layout")?;
    Ok(doc.layout)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_preferences_match_specification() {
        let prefs = ShellLayoutPreferencesV1::default();
        assert_eq!(prefs.schema_version, 1);
        assert_eq!(prefs.sidebar_width, 280.0);
        assert!(!prefs.sidebar_collapsed);
        assert_eq!(prefs.inspector_width, 340.0);
        assert!(prefs.inspector_open);
        assert_eq!(prefs.bottom_panel_height_ratio, 0.30);
        assert!(!prefs.bottom_panel_open);
        assert_eq!(prefs.active_navigation_id.as_deref(), Some("workspace"));
    }

    #[test]
    fn clamp_and_sanitize_enforces_boundaries() {
        let mut prefs = ShellLayoutPreferencesV1 {
            schema_version: 99,
            sidebar_width: 100.0, // below 220
            sidebar_collapsed: true,
            inspector_width: 900.0, // above 480
            inspector_open: false,
            bottom_panel_height_ratio: 0.90, // above 0.50
            bottom_panel_open: true,
            active_navigation_id: Some("invalid!@#$%^".to_string()),
        };

        prefs.clamp_and_sanitize();

        assert_eq!(prefs.schema_version, 1);
        assert_eq!(prefs.sidebar_width, 220.0);
        assert_eq!(prefs.inspector_width, 480.0);
        assert_eq!(prefs.bottom_panel_height_ratio, 0.50);
        assert_eq!(prefs.active_navigation_id.as_deref(), Some("workspace"));
    }

    #[test]
    fn partial_json_recovery_restores_valid_fields() {
        let json = r#"{
            "schemaVersion": 1,
            "sidebarWidth": 310.0,
            "inspectorWidth": 390.0,
            "unexpectedExtraField": "ignored"
        }"#;

        let val: serde_json::Value = serde_json::from_str(json).unwrap();
        let mut recovered = ShellLayoutPreferencesV1::default();

        if let Some(w) = val.get("sidebarWidth").and_then(|v| v.as_f64()) {
            recovered.sidebar_width = w;
        }
        if let Some(w) = val.get("inspectorWidth").and_then(|v| v.as_f64()) {
            recovered.inspector_width = w;
        }
        recovered.clamp_and_sanitize();

        assert_eq!(recovered.sidebar_width, 310.0);
        assert_eq!(recovered.inspector_width, 390.0);
        assert_eq!(recovered.bottom_panel_height_ratio, 0.30); // preserved default
    }
}
