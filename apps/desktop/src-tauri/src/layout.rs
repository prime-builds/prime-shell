use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub const SCHEMA_VERSION: u32 = 1;
pub const DEFAULT_SIDEBAR_WIDTH: f64 = 280.0;
pub const MIN_SIDEBAR_WIDTH: f64 = 220.0;
pub const MAX_SIDEBAR_WIDTH: f64 = 400.0;

pub const DEFAULT_INSPECTOR_WIDTH: f64 = 340.0;
pub const MIN_INSPECTOR_WIDTH: f64 = 280.0;
pub const MAX_INSPECTOR_WIDTH: f64 = 480.0;

pub const DEFAULT_BOTTOM_PANEL_RATIO: f64 = 0.30;
pub const MIN_BOTTOM_PANEL_RATIO: f64 = 0.20;
pub const MAX_BOTTOM_PANEL_RATIO: f64 = 0.50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShellLayoutPreferencesV1 {
    pub schema_version: u32,
    pub sidebar_width: f64,
    pub sidebar_collapsed: bool,
    pub inspector_width: f64,
    pub inspector_open: bool,
    pub bottom_panel_height_ratio: f64,
    pub bottom_panel_open: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_navigation_id: Option<String>,
}

impl Default for ShellLayoutPreferencesV1 {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            sidebar_width: DEFAULT_SIDEBAR_WIDTH,
            sidebar_collapsed: false,
            inspector_width: DEFAULT_INSPECTOR_WIDTH,
            inspector_open: true,
            bottom_panel_height_ratio: DEFAULT_BOTTOM_PANEL_RATIO,
            bottom_panel_open: false,
            active_navigation_id: Some("workspace".to_string()),
        }
    }
}

impl ShellLayoutPreferencesV1 {
    pub fn clamp_and_sanitize(&mut self) {
        self.schema_version = SCHEMA_VERSION;

        if !self.sidebar_width.is_finite() {
            self.sidebar_width = DEFAULT_SIDEBAR_WIDTH;
        } else {
            self.sidebar_width = self.sidebar_width.clamp(MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
        }

        if !self.inspector_width.is_finite() {
            self.inspector_width = DEFAULT_INSPECTOR_WIDTH;
        } else {
            self.inspector_width = self.inspector_width.clamp(MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH);
        }

        if !self.bottom_panel_height_ratio.is_finite() {
            self.bottom_panel_height_ratio = DEFAULT_BOTTOM_PANEL_RATIO;
        } else {
            self.bottom_panel_height_ratio = self
                .bottom_panel_height_ratio
                .clamp(MIN_BOTTOM_PANEL_RATIO, MAX_BOTTOM_PANEL_RATIO);
        }

        if let Some(ref id) = self.active_navigation_id {
            if id.is_empty()
                || id.len() > 64
                || !id
                    .chars()
                    .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
            {
                self.active_navigation_id = Some("workspace".to_string());
            }
        }
    }
}

fn get_preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }
    Ok(dir.join("shell_layout_v1.json"))
}

#[tauri::command]
pub fn get_shell_layout_preferences(app: AppHandle) -> Result<ShellLayoutPreferencesV1, String> {
    let path = get_preferences_path(&app)?;
    if !path.exists() {
        return Ok(ShellLayoutPreferencesV1::default());
    }

    let content = match fs::read_to_string(&path) {
        Ok(c) => c,
        Err(_) => return Ok(ShellLayoutPreferencesV1::default()),
    };

    match serde_json::from_str::<ShellLayoutPreferencesV1>(&content) {
        Ok(mut prefs) => {
            prefs.clamp_and_sanitize();
            Ok(prefs)
        }
        Err(_) => {
            let mut recovered = ShellLayoutPreferencesV1::default();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(w) = val.get("sidebarWidth").and_then(|v| v.as_f64()) {
                    recovered.sidebar_width = w;
                }
                if let Some(c) = val.get("sidebarCollapsed").and_then(|v| v.as_bool()) {
                    recovered.sidebar_collapsed = c;
                }
                if let Some(w) = val.get("inspectorWidth").and_then(|v| v.as_f64()) {
                    recovered.inspector_width = w;
                }
                if let Some(o) = val.get("inspectorOpen").and_then(|v| v.as_bool()) {
                    recovered.inspector_open = o;
                }
                if let Some(r) = val.get("bottomPanelHeightRatio").and_then(|v| v.as_f64()) {
                    recovered.bottom_panel_height_ratio = r;
                }
                if let Some(o) = val.get("bottomPanelOpen").and_then(|v| v.as_bool()) {
                    recovered.bottom_panel_open = o;
                }
                if let Some(id) = val.get("activeNavigationId").and_then(|v| v.as_str()) {
                    recovered.active_navigation_id = Some(id.to_string());
                }
            }
            recovered.clamp_and_sanitize();
            Ok(recovered)
        }
    }
}

#[tauri::command]
pub fn save_shell_layout_preferences(
    app: AppHandle,
    mut preferences: ShellLayoutPreferencesV1,
) -> Result<(), String> {
    preferences.clamp_and_sanitize();
    let path = get_preferences_path(&app)?;

    let json_bytes = serde_json::to_vec_pretty(&preferences)
        .map_err(|e| format!("Failed to serialize layout preferences: {e}"))?;

    let temp_path = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&temp_path)
            .map_err(|e| format!("Failed to create temporary preferences file: {e}"))?;
        file.write_all(&json_bytes)
            .map_err(|e| format!("Failed to write temporary preferences file: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("Failed to sync temporary preferences file: {e}"))?;
    }

    fs::rename(&temp_path, &path)
        .map_err(|e| format!("Failed to atomically replace preferences file: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn reset_shell_layout_preferences(app: AppHandle) -> Result<ShellLayoutPreferencesV1, String> {
    let default_prefs = ShellLayoutPreferencesV1::default();
    save_shell_layout_preferences(app, default_prefs.clone())?;
    Ok(default_prefs)
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
