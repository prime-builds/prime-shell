use crate::backend::protocol::BackendStatus;
use crate::settings::models::SettingsStatus;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DiagnosticComponent {
    Shell,
    Backend,
    Sidecar,
    Settings,
    Diagnostics,
    Task,
}

#[allow(non_camel_case_types)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DiagnosticEventCode {
    APP_START,
    APP_EXIT,
    BACKEND_SPAWN,
    BACKEND_READY,
    BACKEND_FAULT,
    BACKEND_RESTART,
    TASK_START,
    TASK_PROGRESS,
    TASK_COMPLETE,
    TASK_CANCEL,
    TASK_INTERRUPT,
    SETTINGS_LOAD,
    SETTINGS_SAVE,
    SETTINGS_RECOVER,
    SETTINGS_RESET,
    DIAGNOSTICS_EXPORT,
    DIAGNOSTICS_PRUNE,
    SAFE_ERROR_RECORDED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRecord {
    pub timestamp: String,
    pub level: DiagnosticLevel,
    pub component: DiagnosticComponent,
    pub event_code: DiagnosticEventCode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeErrorRecord {
    pub code: String,
    pub message: String,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component: Option<DiagnosticComponent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_recovery_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreviewEntry {
    pub name: String,
    pub role: String,
    pub estimated_bytes: u64,
    pub record_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreview {
    pub total_estimated_bytes: u64,
    pub entry_count: u64,
    pub entries: Vec<ExportPreviewEntry>,
    pub redaction_verified: bool,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifestEntry {
    pub name: String,
    pub role: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub record_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManifest {
    pub manifest_version: u64,
    pub app_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backend_version: Option<String>,
    pub target_os: String,
    pub target_arch: String,
    pub created_at: String,
    pub entries: Vec<ExportManifestEntry>,
    pub excluded_categories: Vec<String>,
    pub redaction_verified: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSummary {
    pub total_records: usize,
    pub ring_buffer_capacity: usize,
    pub recent_errors_count: usize,
    pub log_file_bytes: u64,
    pub max_log_bytes: u64,
    pub backend_status: BackendStatus,
    pub settings_status: Option<SettingsStatus>,
    pub retention_policy: String,
}
