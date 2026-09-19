use serde::{Deserialize, Serialize};

pub const CURRENT_SCHEMA_VERSION: u32 = 1;
pub const MAX_SETTINGS_DOCUMENT_BYTES: usize = 65536;

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
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum AccentModeSettings {
    Default,
    System,
    Custom {
        #[serde(rename = "seedColor")]
        seed_color: String,
    },
}

impl Default for AccentModeSettings {
    fn default() -> Self {
        Self::Default
    }
}

impl AccentModeSettings {
    pub fn sanitize(&mut self) {
        if let Self::Custom { seed_color } = self {
            let is_valid_hex = seed_color.len() == 7
                && seed_color.starts_with('#')
                && seed_color[1..].chars().all(|c| c.is_ascii_hexdigit());
            if !is_valid_hex {
                *self = Self::Default;
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppearanceSettings {
    pub theme_mode: String,
    pub accent_mode: AccentModeSettings,
    pub density: String,
    pub material_preference: String,
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme_mode: "system".to_string(),
            accent_mode: AccentModeSettings::default(),
            density: "comfortable".to_string(),
            material_preference: "system".to_string(),
        }
    }
}

impl AppearanceSettings {
    pub fn clamp_and_sanitize(&mut self) {
        if self.theme_mode != "system" && self.theme_mode != "light" && self.theme_mode != "dark" {
            self.theme_mode = "system".to_string();
        }
        self.accent_mode.sanitize();
        if self.density != "comfortable" && self.density != "compact" {
            self.density = "comfortable".to_string();
        }
        if self.material_preference != "system"
            && self.material_preference != "mica"
            && self.material_preference != "acrylic"
            && self.material_preference != "none"
        {
            self.material_preference = "system".to_string();
        }
    }
}

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
            schema_version: CURRENT_SCHEMA_VERSION,
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
        self.schema_version = CURRENT_SCHEMA_VERSION;

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentAnalysisSettings {
    pub max_top_terms: u32,
}

impl Default for DocumentAnalysisSettings {
    fn default() -> Self {
        Self { max_top_terms: 20 }
    }
}

impl DocumentAnalysisSettings {
    pub fn clamp_and_sanitize(&mut self) {
        if self.max_top_terms != 10 && self.max_top_terms != 20 && self.max_top_terms != 50 {
            self.max_top_terms = 20;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TextUtilitySettings {
    pub default_mode: String,
}

impl Default for TextUtilitySettings {
    fn default() -> Self {
        Self {
            default_mode: "uppercase".to_string(),
        }
    }
}

impl TextUtilitySettings {
    pub fn clamp_and_sanitize(&mut self) {
        let valid = matches!(
            self.default_mode.as_str(),
            "uppercase" | "lowercase" | "titlecase" | "normalize-whitespace"
        );
        if !valid {
            self.default_mode = "uppercase".to_string();
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsStatus {
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovered_section: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl Default for SettingsStatus {
    fn default() -> Self {
        Self {
            state: "healthy".to_string(),
            recovered_section: None,
            message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SettingsDocument {
    pub schema_version: u32,
    pub revision: u64,
    pub appearance: AppearanceSettings,
    pub layout: ShellLayoutPreferencesV1,
    pub document_analysis: DocumentAnalysisSettings,
    pub text_utility: TextUtilitySettings,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<SettingsStatus>,
}

impl Default for SettingsDocument {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            revision: 0,
            appearance: AppearanceSettings::default(),
            layout: ShellLayoutPreferencesV1::default(),
            document_analysis: DocumentAnalysisSettings::default(),
            text_utility: TextUtilitySettings::default(),
            status: Some(SettingsStatus::default()),
        }
    }
}

impl SettingsDocument {
    pub fn clamp_and_sanitize(&mut self) {
        self.schema_version = CURRENT_SCHEMA_VERSION;
        self.appearance.clamp_and_sanitize();
        self.layout.clamp_and_sanitize();
        self.document_analysis.clamp_and_sanitize();
        self.text_utility.clamp_and_sanitize();
    }
}
