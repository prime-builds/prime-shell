pub mod manager;
pub mod models;
pub mod redaction;
pub mod zip_writer;

pub use manager::DiagnosticsManager;
pub use models::*;

use crate::backend::{AppError, AppResult, BackendClient, BackendStatus, protocol::BackendLifecycleState};
use crate::settings::{models::SettingsDocument, SettingsManager};
use std::sync::Mutex;
use tauri::State;

pub struct BackendStateRef<'a> {
    pub client: &'a Mutex<Option<BackendClient>>,
}

#[tauri::command]
pub fn get_diagnostics_summary(
    diagnostics: State<'_, DiagnosticsManager>,
    backend_state: State<'_, crate::BackendState>,
    settings: State<'_, SettingsManager>,
) -> AppResult<DiagnosticsSummary> {
    let backend_status = {
        let guard = backend_state
            .client
            .lock()
            .map_err(|_| AppError::internal("diagnostics-summary"))?;
        match guard.as_ref() {
            Some(client) => client.status(),
            None => BackendStatus {
                state: BackendLifecycleState::Stopped,
                ready: false,
                backend_version: None,
                circuit_open: false,
            },
        }
    };
    let settings_doc = settings.get_document();
    Ok(diagnostics.get_summary(backend_status, settings_doc.status))
}

#[tauri::command]
pub fn get_recent_safe_errors(
    diagnostics: State<'_, DiagnosticsManager>,
) -> AppResult<Vec<SafeErrorRecord>> {
    Ok(diagnostics.get_recent_safe_errors())
}

#[tauri::command]
pub fn get_export_preview(
    diagnostics: State<'_, DiagnosticsManager>,
    backend_state: State<'_, crate::BackendState>,
    settings: State<'_, SettingsManager>,
) -> AppResult<ExportPreview> {
    let backend_status = {
        let guard = backend_state
            .client
            .lock()
            .map_err(|_| AppError::internal("export-preview"))?;
        match guard.as_ref() {
            Some(client) => client.status(),
            None => BackendStatus {
                state: BackendLifecycleState::Stopped,
                ready: false,
                backend_version: None,
                circuit_open: false,
            },
        }
    };
    let settings_doc = settings.get_document();
    Ok(diagnostics.get_export_preview(&backend_status, settings_doc.status.as_ref()))
}

#[tauri::command]
pub fn export_diagnostics(
    diagnostics: State<'_, DiagnosticsManager>,
    backend_state: State<'_, crate::BackendState>,
    settings: State<'_, SettingsManager>,
) -> AppResult<Option<ExportManifest>> {
    let trace_id = format!("export-diag-{}", std::process::id());
    let backend_status = {
        let guard = backend_state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        match guard.as_ref() {
            Some(client) => client.status(),
            None => BackendStatus {
                state: BackendLifecycleState::Stopped,
                ready: false,
                backend_version: None,
                circuit_open: false,
            },
        }
    };
    let settings_doc = settings.get_document();

    // Use rfd native save dialog
    let file_path = rfd::FileDialog::new()
        .set_title("Export Diagnostics Bundle")
        .set_file_name("prime-shell-diagnostics.zip")
        .add_filter("Zip Archive (*.zip)", &["zip"])
        .save_file();

    match file_path {
        Some(path) => {
            let manifest = diagnostics
                .export_bundle(&path, &backend_status, settings_doc.status.as_ref())
                .map_err(|e| AppError::internal(&format!("{trace_id}: {e}")))?;
            Ok(Some(manifest))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn recover_backend(
    diagnostics: State<'_, DiagnosticsManager>,
    backend_state: State<'_, crate::BackendState>,
) -> AppResult<BackendStatus> {
    let client = {
        let guard = backend_state
            .client
            .lock()
            .map_err(|_| AppError::internal("recover-backend"))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable("recover-backend"))?
    };

    let new_status = client.reset()?;
    diagnostics.record(DiagnosticRecord {
        timestamp: manager::iso_now(),
        level: DiagnosticLevel::Info,
        component: DiagnosticComponent::Backend,
        event_code: DiagnosticEventCode::BACKEND_RESTART,
        trace_id: Some(format!("recovery-{}", std::process::id())),
        message: "Backend recovery executed successfully.".to_string(),
        details: None,
    });

    Ok(new_status)
}

#[tauri::command]
pub fn repair_settings_section(
    section: String,
    diagnostics: State<'_, DiagnosticsManager>,
    settings: State<'_, SettingsManager>,
) -> AppResult<SettingsDocument> {
    let trace_id = format!("repair-section-{}", std::process::id());
    let doc = settings
        .reset_section(&section)
        .map_err(|e| AppError::validation(&e, &trace_id))?;

    diagnostics.record(DiagnosticRecord {
        timestamp: manager::iso_now(),
        level: DiagnosticLevel::Info,
        component: DiagnosticComponent::Settings,
        event_code: DiagnosticEventCode::SETTINGS_RESET,
        trace_id: Some(trace_id),
        message: format!("Settings section '{section}' was repaired to default values."),
        details: None,
    });

    Ok(doc)
}
