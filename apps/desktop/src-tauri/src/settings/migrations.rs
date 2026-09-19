use crate::settings::models::{
    AppearanceSettings, DocumentAnalysisSettings, SettingsDocument, SettingsStatus,
    ShellLayoutPreferencesV1, TextUtilitySettings, CURRENT_SCHEMA_VERSION,
};
use serde_json::Value;

pub enum MigrationOutcome {
    Current(SettingsDocument),
    Migrated(SettingsDocument),
    SectionRecovered {
        document: SettingsDocument,
        section: String,
    },
    UnsupportedFutureVersion {
        version: u32,
    },
}

pub fn migrate_or_recover(value: Value) -> Result<MigrationOutcome, String> {
    // 1. Check schema version
    let schema_version = value
        .get("schemaVersion")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    if schema_version > CURRENT_SCHEMA_VERSION {
        return Ok(MigrationOutcome::UnsupportedFutureVersion {
            version: schema_version,
        });
    }

    // 2. Check if this is legacy P2 shell_layout_v1.json (has sidebarWidth at top level, no appearance)
    if value.get("appearance").is_none() && value.get("sidebarWidth").is_some() {
        let mut doc = SettingsDocument::default();
        if let Ok(mut layout) = serde_json::from_value::<ShellLayoutPreferencesV1>(value) {
            layout.clamp_and_sanitize();
            doc.layout = layout;
        }
        doc.clamp_and_sanitize();
        return Ok(MigrationOutcome::Migrated(doc));
    }

    // 3. Current version migration/parse with section-scoped isolation
    let mut doc = SettingsDocument::default();
    let mut recovered_section: Option<String> = None;

    if let Some(rev) = value.get("revision").and_then(|v| v.as_u64()) {
        doc.revision = rev;
    }

    // Section 1: Appearance
    if let Some(app_val) = value.get("appearance") {
        match serde_json::from_value::<AppearanceSettings>(app_val.clone()) {
            Ok(mut app) => {
                app.clamp_and_sanitize();
                doc.appearance = app;
            }
            Err(_) => {
                recovered_section = Some("appearance".to_string());
                doc.appearance = AppearanceSettings::default();
            }
        }
    } else {
        doc.appearance = AppearanceSettings::default();
    }

    // Section 2: Layout
    if let Some(layout_val) = value.get("layout") {
        match serde_json::from_value::<ShellLayoutPreferencesV1>(layout_val.clone()) {
            Ok(mut layout) => {
                layout.clamp_and_sanitize();
                doc.layout = layout;
            }
            Err(_) => {
                recovered_section = Some("layout".to_string());
                doc.layout = ShellLayoutPreferencesV1::default();
            }
        }
    } else {
        doc.layout = ShellLayoutPreferencesV1::default();
    }

    // Section 3: Document Analysis
    if let Some(doc_val) = value.get("documentAnalysis") {
        match serde_json::from_value::<DocumentAnalysisSettings>(doc_val.clone()) {
            Ok(mut da) => {
                da.clamp_and_sanitize();
                doc.document_analysis = da;
            }
            Err(_) => {
                recovered_section = Some("documentAnalysis".to_string());
                doc.document_analysis = DocumentAnalysisSettings::default();
            }
        }
    } else {
        doc.document_analysis = DocumentAnalysisSettings::default();
    }

    // Section 4: Text Utility
    if let Some(tu_val) = value.get("textUtility") {
        match serde_json::from_value::<TextUtilitySettings>(tu_val.clone()) {
            Ok(mut tu) => {
                tu.clamp_and_sanitize();
                doc.text_utility = tu;
            }
            Err(_) => {
                recovered_section = Some("textUtility".to_string());
                doc.text_utility = TextUtilitySettings::default();
            }
        }
    } else {
        doc.text_utility = TextUtilitySettings::default();
    }

    doc.clamp_and_sanitize();

    if let Some(section) = recovered_section {
        doc.status = Some(SettingsStatus {
            state: "section_recovered".to_string(),
            recovered_section: Some(section.clone()),
            message: Some(format!("Recovered invalid section '{section}' to defaults.")),
        });
        Ok(MigrationOutcome::SectionRecovered {
            document: doc,
            section,
        })
    } else {
        doc.status = Some(SettingsStatus {
            state: "healthy".to_string(),
            recovered_section: None,
            message: None,
        });
        Ok(MigrationOutcome::Current(doc))
    }
}
