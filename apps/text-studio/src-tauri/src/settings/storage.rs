use crate::settings::migrations::{migrate_or_recover, MigrationOutcome};
use crate::settings::models::{
    AppearanceSettings, DocumentAnalysisSettings, SettingsDocument, SettingsStatus,
    ShellLayoutPreferencesV1, TextUtilitySettings, MAX_SETTINGS_DOCUMENT_BYTES,
};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct SettingsState {
    pub document: SettingsDocument,
    pub is_read_only: bool,
}

pub struct SettingsManager {
    primary_path: PathBuf,
    previous_path: PathBuf,
    temp_path: PathBuf,
    _legacy_layout_path: PathBuf,
    state: Mutex<SettingsState>,
}

impl SettingsManager {
    pub fn new_from_paths(
        primary_path: PathBuf,
        previous_path: PathBuf,
        temp_path: PathBuf,
        legacy_layout_path: PathBuf,
    ) -> Self {
        let (initial_doc, is_read_only) = Self::load_initial(
            &primary_path,
            &previous_path,
            &temp_path,
            &legacy_layout_path,
        );

        Self {
            primary_path,
            previous_path,
            temp_path,
            _legacy_layout_path: legacy_layout_path,
            state: Mutex::new(SettingsState {
                document: initial_doc,
                is_read_only,
            }),
        }
    }

    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
        }

        let primary_path = dir.join("settings.json");
        let previous_path = dir.join("settings.previous.json");
        let temp_path = dir.join("settings.tmp");
        let legacy_layout_path = dir.join("shell_layout_v1.json");

        Ok(Self::new_from_paths(
            primary_path,
            previous_path,
            temp_path,
            legacy_layout_path,
        ))
    }

    fn clean_stale_temp(temp_path: &Path) {
        if temp_path.exists() {
            let _ = fs::remove_file(temp_path);
        }
    }

    #[allow(clippy::single_match)]
    fn load_initial(
        primary_path: &Path,
        previous_path: &Path,
        temp_path: &Path,
        legacy_layout_path: &Path,
    ) -> (SettingsDocument, bool) {
        Self::clean_stale_temp(temp_path);

        // 1. Try loading primary settings
        if primary_path.exists() {
            match fs::read_to_string(primary_path) {
                Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(val) => match migrate_or_recover(val) {
                        Ok(MigrationOutcome::Current(doc)) => return (doc, false),
                        Ok(MigrationOutcome::Migrated(mut doc)) => {
                            let _ = Self::write_atomic(
                                primary_path,
                                previous_path,
                                temp_path,
                                &mut doc,
                            );
                            return (doc, false);
                        }
                        Ok(MigrationOutcome::SectionRecovered {
                            document: mut doc, ..
                        }) => {
                            let _ = Self::write_atomic(
                                primary_path,
                                previous_path,
                                temp_path,
                                &mut doc,
                            );
                            return (doc, false);
                        }
                        Ok(MigrationOutcome::UnsupportedFutureVersion { version }) => {
                            let doc = SettingsDocument {
                                status: Some(SettingsStatus {
                                    state: "unsupported_future_version".to_string(),
                                    recovered_section: None,
                                    message: Some(format!(
                                        "Settings file is from future schema version {version} and is read-only."
                                    )),
                                }),
                                ..Default::default()
                            };
                            return (doc, true);
                        }
                        Err(_) => {}
                    },
                    Err(_) => {
                        // Corrupt primary file - do not overwrite it immediately!
                    }
                },
                Err(_) => {}
            }

            // Primary failed or was corrupt: fall back to previous known-good copy
            if previous_path.exists() {
                if let Ok(prev_content) = fs::read_to_string(previous_path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&prev_content) {
                        if let Ok(MigrationOutcome::Current(mut doc)) = migrate_or_recover(val) {
                            doc.status = Some(SettingsStatus {
                                state: "recovered_from_previous_copy".to_string(),
                                recovered_section: None,
                                message: Some(
                                    "Recovered settings from previous known-good copy.".to_string(),
                                ),
                            });
                            return (doc, false);
                        }
                    }
                }
            }

            // Both primary and previous copy failed: reset to defaults
            let default_doc = SettingsDocument {
                status: Some(SettingsStatus {
                    state: "reset_to_defaults".to_string(),
                    recovered_section: None,
                    message: Some("Corrupt settings reset to defaults.".to_string()),
                }),
                ..Default::default()
            };
            return (default_doc, false);
        }

        // 2. If primary does not exist, check legacy P2 layout
        if legacy_layout_path.exists() {
            if let Ok(legacy_content) = fs::read_to_string(legacy_layout_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&legacy_content) {
                    if let Ok(MigrationOutcome::Migrated(mut doc)) = migrate_or_recover(val) {
                        let _ =
                            Self::write_atomic(primary_path, previous_path, temp_path, &mut doc);
                        return (doc, false);
                    }
                }
            }
        }

        // 3. Brand new installation: initialize defaults
        let mut default_doc = SettingsDocument::default();
        let _ = Self::write_atomic(primary_path, previous_path, temp_path, &mut default_doc);
        (default_doc, false)
    }

    fn write_atomic(
        primary_path: &Path,
        previous_path: &Path,
        temp_path: &Path,
        document: &mut SettingsDocument,
    ) -> Result<(), String> {
        document.clamp_and_sanitize();

        let json_bytes = serde_json::to_vec_pretty(document)
            .map_err(|e| format!("Failed to serialize settings document: {e}"))?;

        if json_bytes.len() > MAX_SETTINGS_DOCUMENT_BYTES {
            return Err("Settings document exceeds maximum allowed size (64 KB)".to_string());
        }

        // 1. Write to temporary file in the same directory
        {
            let mut file = fs::File::create(temp_path)
                .map_err(|e| format!("Failed to create temporary settings file: {e}"))?;
            file.write_all(&json_bytes)
                .map_err(|e| format!("Failed to write temporary settings file: {e}"))?;
            file.sync_all()
                .map_err(|e| format!("Failed to sync temporary settings file: {e}"))?;
        }

        // 2. If primary exists and is valid, backup to previous_path before replacing
        if primary_path.exists() {
            let _ = fs::copy(primary_path, previous_path);
        }

        // 3. Atomically replace primary
        #[cfg(windows)]
        {
            // On Windows, rename fails if destination exists unless using replace
            if primary_path.exists() {
                let _ = fs::remove_file(primary_path);
            }
            fs::rename(temp_path, primary_path)
                .map_err(|e| format!("Failed to atomically replace settings file: {e}"))?;
        }
        #[cfg(not(windows))]
        {
            fs::rename(temp_path, primary_path)
                .map_err(|e| format!("Failed to atomically replace settings file: {e}"))?;
        }

        // 4. Update previous_path with known-good bytes
        let _ = fs::write(previous_path, &json_bytes);

        Ok(())
    }

    pub fn get_document(&self) -> SettingsDocument {
        let guard = self.state.lock().unwrap();
        guard.document.clone()
    }

    pub fn save_document(
        &self,
        expected_revision: u64,
        mut new_doc: SettingsDocument,
    ) -> Result<SettingsDocument, String> {
        let mut guard = self.state.lock().unwrap();

        if guard.is_read_only {
            return Err(
                "Settings are in read-only mode due to unsupported future version.".to_string(),
            );
        }

        if expected_revision != guard.document.revision {
            return Err(format!(
                "Stale revision: expected {}, current is {}.",
                expected_revision, guard.document.revision
            ));
        }

        new_doc.revision = guard.document.revision + 1;
        new_doc.status = Some(SettingsStatus {
            state: "healthy".to_string(),
            recovered_section: None,
            message: None,
        });

        Self::write_atomic(
            &self.primary_path,
            &self.previous_path,
            &self.temp_path,
            &mut new_doc,
        )?;

        guard.document = new_doc.clone();
        Ok(new_doc)
    }

    pub fn reset_setting(&self, section: &str, key: &str) -> Result<SettingsDocument, String> {
        let mut guard = self.state.lock().unwrap();

        if guard.is_read_only {
            return Err("Settings are in read-only mode.".to_string());
        }

        let mut doc = guard.document.clone();
        match section {
            "appearance" => match key {
                "themeMode" => doc.appearance.theme_mode = AppearanceSettings::default().theme_mode,
                "accentMode" => {
                    doc.appearance.accent_mode = AppearanceSettings::default().accent_mode
                }
                "density" => doc.appearance.density = AppearanceSettings::default().density,
                "materialPreference" => {
                    doc.appearance.material_preference =
                        AppearanceSettings::default().material_preference
                }
                _ => return Err(format!("Unknown appearance setting key '{key}'")),
            },
            "layout" => match key {
                "sidebarWidth" => {
                    doc.layout.sidebar_width = ShellLayoutPreferencesV1::default().sidebar_width
                }
                "sidebarCollapsed" => {
                    doc.layout.sidebar_collapsed =
                        ShellLayoutPreferencesV1::default().sidebar_collapsed
                }
                "inspectorWidth" => {
                    doc.layout.inspector_width = ShellLayoutPreferencesV1::default().inspector_width
                }
                "inspectorOpen" => {
                    doc.layout.inspector_open = ShellLayoutPreferencesV1::default().inspector_open
                }
                "bottomPanelHeightRatio" => {
                    doc.layout.bottom_panel_height_ratio =
                        ShellLayoutPreferencesV1::default().bottom_panel_height_ratio
                }
                "bottomPanelOpen" => {
                    doc.layout.bottom_panel_open =
                        ShellLayoutPreferencesV1::default().bottom_panel_open
                }
                _ => return Err(format!("Unknown layout setting key '{key}'")),
            },
            "documentAnalysis" => match key {
                "maxTopTerms" => {
                    doc.document_analysis.max_top_terms =
                        DocumentAnalysisSettings::default().max_top_terms
                }
                _ => return Err(format!("Unknown documentAnalysis setting key '{key}'")),
            },
            "textUtility" => match key {
                "defaultMode" => {
                    doc.text_utility.default_mode = TextUtilitySettings::default().default_mode
                }
                _ => return Err(format!("Unknown textUtility setting key '{key}'")),
            },
            _ => return Err(format!("Unknown section '{section}'")),
        }

        doc.revision = guard.document.revision + 1;
        doc.status = Some(SettingsStatus {
            state: "healthy".to_string(),
            recovered_section: None,
            message: Some(format!("Reset setting '{section}.{key}' to default.")),
        });

        Self::write_atomic(
            &self.primary_path,
            &self.previous_path,
            &self.temp_path,
            &mut doc,
        )?;

        guard.document = doc.clone();
        Ok(doc)
    }

    pub fn reset_section(&self, section: &str) -> Result<SettingsDocument, String> {
        let mut guard = self.state.lock().unwrap();

        if guard.is_read_only {
            return Err("Settings are in read-only mode.".to_string());
        }

        let mut doc = guard.document.clone();
        match section {
            "appearance" => doc.appearance = AppearanceSettings::default(),
            "layout" => doc.layout = ShellLayoutPreferencesV1::default(),
            "documentAnalysis" => doc.document_analysis = DocumentAnalysisSettings::default(),
            "textUtility" => doc.text_utility = TextUtilitySettings::default(),
            _ => return Err(format!("Unknown section '{section}'")),
        }

        doc.revision = guard.document.revision + 1;
        doc.status = Some(SettingsStatus {
            state: "healthy".to_string(),
            recovered_section: None,
            message: Some(format!("Reset section '{section}' to defaults.")),
        });

        Self::write_atomic(
            &self.primary_path,
            &self.previous_path,
            &self.temp_path,
            &mut doc,
        )?;

        guard.document = doc.clone();
        Ok(doc)
    }

    pub fn reset_all(&self) -> Result<SettingsDocument, String> {
        let mut guard = self.state.lock().unwrap();

        if guard.is_read_only {
            return Err("Settings are in read-only mode.".to_string());
        }

        let mut doc = SettingsDocument {
            revision: guard.document.revision + 1,
            status: Some(SettingsStatus {
                state: "healthy".to_string(),
                recovered_section: None,
                message: Some("Reset all settings to defaults.".to_string()),
            }),
            ..Default::default()
        };

        Self::write_atomic(
            &self.primary_path,
            &self.previous_path,
            &self.temp_path,
            &mut doc,
        )?;

        guard.document = doc.clone();
        Ok(doc)
    }
}
