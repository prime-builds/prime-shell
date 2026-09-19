use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::fs::{self, File, OpenOptions};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::models::{
    DiagnosticComponent, DiagnosticEventCode, DiagnosticLevel, DiagnosticRecord,
    DiagnosticsSummary, ExportManifest, ExportManifestEntry, ExportPreview, ExportPreviewEntry,
    SafeErrorRecord,
};
use super::redaction::{
    redact_text, truncate_string, verify_no_leaks, MAX_DETAIL_STR_LEN, MAX_HINT_LEN,
};
use super::zip_writer::ZipWriter;
use crate::backend::protocol::BackendStatus;
use crate::settings::models::SettingsStatus;

pub const MAX_MEMORY_RECORDS: usize = 1000;
pub const MAX_MEMORY_ERRORS: usize = 50;
pub const MAX_LOG_FILE_BYTES: u64 = 1_048_576; // 1 MB
pub const MAX_ROTATED_FILES: usize = 5; // 5 files = max 5 MB total

pub fn iso_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    // Deterministic ISO-8601 UTC timestamp
    // Format: YYYY-MM-DDTHH:MM:SS.mmmZ
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let s = rem_secs % 60;

    // Convert days since epoch (1970-01-01) to Year, Month, Day
    let mut y = 1970i64;
    let mut d = days as i64;
    loop {
        let leap = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) {
            1
        } else {
            0
        };
        let days_in_year = 365 + leap;
        if d < days_in_year {
            break;
        }
        d -= days_in_year;
        y += 1;
    }
    let leap = if (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0) {
        1
    } else {
        0
    };
    let month_days = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 1;
    for &md in &month_days {
        if d < md {
            break;
        }
        d -= md;
        m += 1;
    }
    let day = d + 1;

    format!("{y:04}-{m:02}-{day:02}T{hours:02}:{mins:02}:{s:02}.{millis:03}Z")
}

pub struct DiagnosticsManager {
    log_dir: Option<PathBuf>,
    records: Mutex<VecDeque<DiagnosticRecord>>,
    safe_errors: Mutex<VecDeque<SafeErrorRecord>>,
    file_mutex: Mutex<()>,
}

impl DiagnosticsManager {
    pub fn new(app_data_dir: Option<PathBuf>) -> Self {
        let log_dir = app_data_dir.map(|dir| dir.join("logs"));
        if let Some(ref dir) = log_dir {
            let _ = fs::create_dir_all(dir);
        }

        Self {
            log_dir,
            records: Mutex::new(VecDeque::with_capacity(MAX_MEMORY_RECORDS)),
            safe_errors: Mutex::new(VecDeque::with_capacity(MAX_MEMORY_ERRORS)),
            file_mutex: Mutex::new(()),
        }
    }

    pub fn record(&self, mut record: DiagnosticRecord) {
        // 1. Redact message
        record.message = redact_text(&record.message);

        // 2. Redact details if present
        if let Some(details) = record.details.as_mut() {
            let mut sanitized = HashMap::new();
            for (k, v) in details.drain() {
                let clean_k = truncate_string(&k, 32);
                let clean_v = match v {
                    serde_json::Value::String(s) => {
                        let redacted = redact_text(&s);
                        serde_json::Value::String(truncate_string(&redacted, MAX_DETAIL_STR_LEN))
                    }
                    serde_json::Value::Number(n) => serde_json::Value::Number(n),
                    serde_json::Value::Bool(b) => serde_json::Value::Bool(b),
                    _ => serde_json::Value::String("[REDACTED_OBJECT]".to_string()),
                };
                sanitized.insert(clean_k, clean_v);
                if sanitized.len() >= 8 {
                    break;
                }
            }
            record.details = Some(sanitized);
        }

        // 3. Append to memory ring buffer
        {
            let mut guard = self.records.lock().unwrap();
            if guard.len() >= MAX_MEMORY_RECORDS {
                guard.pop_front();
            }
            guard.push_back(record.clone());
        }

        // 4. Append to file if log_dir is configured
        if let Some(ref dir) = self.log_dir {
            let _file_guard = self.file_mutex.lock().unwrap();
            let current_log = dir.join("current.log");

            // Check if rotation needed
            if let Ok(metadata) = fs::metadata(&current_log) {
                if metadata.len() >= MAX_LOG_FILE_BYTES {
                    self.rotate_logs(dir);
                }
            }

            if let Ok(file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&current_log)
            {
                let mut writer = BufWriter::new(file);
                if let Ok(json_line) = serde_json::to_string(&record) {
                    let _ = writeln!(writer, "{json_line}");
                }
            }
        }
    }

    fn rotate_logs(&self, dir: &Path) {
        let max_idx = MAX_ROTATED_FILES.saturating_sub(1);
        let oldest = dir.join(format!("current.{max_idx}.log"));
        if oldest.exists() {
            let _ = fs::remove_file(oldest);
        }

        for i in (1..max_idx).rev() {
            let src = dir.join(format!("current.{i}.log"));
            let dst = dir.join(format!("current.{}.log", i + 1));
            if src.exists() {
                let _ = fs::rename(src, dst);
            }
        }

        let current = dir.join("current.log");
        let first_rotated = dir.join("current.1.log");
        if current.exists() {
            let _ = fs::rename(current, first_rotated);
        }
    }

    pub fn record_safe_error(&self, mut error: SafeErrorRecord) {
        error.message = redact_text(&error.message);
        if let Some(hint) = error.user_recovery_hint.as_mut() {
            *hint = truncate_string(&redact_text(hint), MAX_HINT_LEN);
        }

        // Record into safe_errors ring buffer
        {
            let mut guard = self.safe_errors.lock().unwrap();
            if guard.len() >= MAX_MEMORY_ERRORS {
                guard.pop_front();
            }
            guard.push_back(error.clone());
        }

        // Also record as diagnostic record
        self.record(DiagnosticRecord {
            timestamp: error.timestamp.clone(),
            level: DiagnosticLevel::Error,
            component: error.component.unwrap_or(DiagnosticComponent::Shell),
            event_code: DiagnosticEventCode::SAFE_ERROR_RECORDED,
            trace_id: error.trace_id.clone(),
            message: error.message.clone(),
            details: None,
        });
    }

    pub fn get_recent_safe_errors(&self) -> Vec<SafeErrorRecord> {
        let guard = self.safe_errors.lock().unwrap();
        guard.iter().cloned().collect()
    }

    pub fn get_summary(
        &self,
        backend_status: BackendStatus,
        settings_status: Option<SettingsStatus>,
    ) -> DiagnosticsSummary {
        let total_records = self.records.lock().unwrap().len();
        let recent_errors_count = self.safe_errors.lock().unwrap().len();

        let log_file_bytes = self
            .log_dir
            .as_ref()
            .and_then(|d| fs::metadata(d.join("current.log")).ok())
            .map(|m| m.len())
            .unwrap_or(0);

        DiagnosticsSummary {
            total_records,
            ring_buffer_capacity: MAX_MEMORY_RECORDS,
            recent_errors_count,
            log_file_bytes,
            max_log_bytes: MAX_LOG_FILE_BYTES * MAX_ROTATED_FILES as u64,
            backend_status,
            settings_status,
            retention_policy: format!(
                "{MAX_MEMORY_RECORDS} records in memory, {} MB bounded rotated disk log",
                (MAX_LOG_FILE_BYTES * MAX_ROTATED_FILES as u64) / (1024 * 1024)
            ),
        }
    }

    pub fn get_export_preview(
        &self,
        backend_status: &BackendStatus,
        settings_status: Option<&SettingsStatus>,
    ) -> ExportPreview {
        let records = self.records.lock().unwrap();
        let errors = self.safe_errors.lock().unwrap();

        let diag_bytes = records.iter().fold(0u64, |acc, r| {
            acc + serde_json::to_string(r)
                .map(|s| s.len() as u64 + 1)
                .unwrap_or(100)
        });
        let errors_bytes = serde_json::to_string(&*errors)
            .map(|s| s.len() as u64)
            .unwrap_or(100);

        let system_summary_est = 350u64;
        let settings_summary_est = 250u64;
        let manifest_est = 800u64;

        let entries = vec![
            ExportPreviewEntry {
                name: "manifest.json".to_string(),
                role: "export_manifest".to_string(),
                estimated_bytes: manifest_est,
                record_count: 1,
            },
            ExportPreviewEntry {
                name: "diagnostics.ndjson".to_string(),
                role: "diagnostic_records".to_string(),
                estimated_bytes: diag_bytes,
                record_count: records.len() as u64,
            },
            ExportPreviewEntry {
                name: "safe_errors.json".to_string(),
                role: "safe_error_records".to_string(),
                estimated_bytes: errors_bytes,
                record_count: errors.len() as u64,
            },
            ExportPreviewEntry {
                name: "system_summary.json".to_string(),
                role: "system_summary".to_string(),
                estimated_bytes: system_summary_est,
                record_count: 1,
            },
            ExportPreviewEntry {
                name: "settings_summary.json".to_string(),
                role: "settings_summary".to_string(),
                estimated_bytes: settings_summary_est,
                record_count: 1,
            },
        ];

        let total_estimated_bytes = entries.iter().map(|e| e.estimated_bytes).sum();
        let entry_count = entries.len() as u64;

        // Verify redaction on in-memory records
        let mut redaction_verified = true;
        for r in records.iter() {
            if !verify_no_leaks(&r.message) {
                redaction_verified = false;
                break;
            }
        }
        for e in errors.iter() {
            if !verify_no_leaks(&e.message) {
                redaction_verified = false;
                break;
            }
        }

        let _ = (backend_status, settings_status);

        ExportPreview {
            total_estimated_bytes,
            entry_count,
            entries,
            redaction_verified,
            generated_at: iso_now(),
        }
    }

    pub fn export_bundle(
        &self,
        save_path: &Path,
        backend_status: &BackendStatus,
        settings_status: Option<&SettingsStatus>,
    ) -> Result<ExportManifest, String> {
        let created_at = iso_now();

        // 1. Freeze snapshot
        let records: Vec<DiagnosticRecord> = self.records.lock().unwrap().iter().cloned().collect();
        let errors: Vec<SafeErrorRecord> =
            self.safe_errors.lock().unwrap().iter().cloned().collect();

        // 2. Prepare diagnostics.ndjson
        let mut diag_bytes = Vec::new();
        for r in &records {
            let line = serde_json::to_string(r).map_err(|e| e.to_string())?;
            if !verify_no_leaks(&line) {
                return Err("Redaction verification failed on diagnostic record".to_string());
            }
            diag_bytes.extend_from_slice(line.as_bytes());
            diag_bytes.push(b'\n');
        }

        // 3. Prepare safe_errors.json
        let errors_json = serde_json::to_string_pretty(&errors).map_err(|e| e.to_string())?;
        if !verify_no_leaks(&errors_json) {
            return Err("Redaction verification failed on safe errors".to_string());
        }
        let errors_bytes = errors_json.into_bytes();

        // 4. Prepare system_summary.json
        let system_summary = serde_json::json!({
            "appVersion": "0.1.0",
            "targetOs": std::env::consts::OS,
            "targetArch": std::env::consts::ARCH,
            "backendState": backend_status.state,
            "backendReady": backend_status.ready,
            "backendVersion": backend_status.backend_version,
            "circuitOpen": backend_status.circuit_open
        });
        let system_bytes = serde_json::to_string_pretty(&system_summary)
            .map_err(|e| e.to_string())?
            .into_bytes();

        // 5. Prepare settings_summary.json
        let settings_summary = serde_json::json!({
            "status": settings_status,
            "availableSections": ["appearance", "layout", "documentAnalysis", "textUtility"],
            "redactionNote": "Raw settings values are strictly excluded from diagnostics export."
        });
        let settings_bytes = serde_json::to_string_pretty(&settings_summary)
            .map_err(|e| e.to_string())?
            .into_bytes();

        // Helper to compute sha256
        let sha256_hex = |data: &[u8]| -> String {
            let mut hasher = Sha256::new();
            hasher.update(data);
            format!("{:x}", hasher.finalize())
        };

        // 6. Build Manifest Entries
        let entries_meta = vec![
            (
                "diagnostics.ndjson",
                "diagnostic_records",
                diag_bytes.len(),
                sha256_hex(&diag_bytes),
                records.len() as u64,
            ),
            (
                "safe_errors.json",
                "safe_error_records",
                errors_bytes.len(),
                sha256_hex(&errors_bytes),
                errors.len() as u64,
            ),
            (
                "system_summary.json",
                "system_summary",
                system_bytes.len(),
                sha256_hex(&system_bytes),
                1,
            ),
            (
                "settings_summary.json",
                "settings_summary",
                settings_bytes.len(),
                sha256_hex(&settings_bytes),
                1,
            ),
        ];

        let mut manifest_entries: Vec<ExportManifestEntry> = entries_meta
            .into_iter()
            .map(|(name, role, size, sha, count)| ExportManifestEntry {
                name: name.to_string(),
                role: role.to_string(),
                size_bytes: size as u64,
                sha256: sha,
                record_count: count,
            })
            .collect();

        // Compute manifest without self first, then add manifest.json
        let mut manifest = ExportManifest {
            manifest_version: 1,
            app_version: "0.1.0".to_string(),
            backend_version: backend_status.backend_version.clone(),
            target_os: std::env::consts::OS.to_string(),
            target_arch: std::env::consts::ARCH.to_string(),
            created_at: created_at.clone(),
            entries: Vec::new(),
            excluded_categories: vec![
                "userDocumentContent".to_string(),
                "rawSettingsValues".to_string(),
                "nativeFilePaths".to_string(),
                "credentialsAndTokens".to_string(),
                "unboundedTracebacks".to_string(),
            ],
            redaction_verified: true,
        };

        // Manifest JSON bytes
        manifest.entries = manifest_entries.clone();
        let manifest_json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
        let manifest_bytes = manifest_json.into_bytes();

        manifest_entries.insert(
            0,
            ExportManifestEntry {
                name: "manifest.json".to_string(),
                role: "export_manifest".to_string(),
                size_bytes: manifest_bytes.len() as u64,
                sha256: sha256_hex(&manifest_bytes),
                record_count: 1,
            },
        );
        manifest.entries = manifest_entries;

        // Re-serialize final manifest
        let final_manifest_bytes = serde_json::to_string_pretty(&manifest)
            .map_err(|e| e.to_string())?
            .into_bytes();

        // 7. Write ZIP bundle to temp path then rename/replace
        let temp_path = save_path.with_extension("tmp");
        {
            let file = File::create(&temp_path).map_err(|e| e.to_string())?;
            let mut zip = ZipWriter::new(BufWriter::new(file));

            zip.add_file("manifest.json", &final_manifest_bytes)
                .map_err(|e| e.to_string())?;
            zip.add_file("diagnostics.ndjson", &diag_bytes)
                .map_err(|e| e.to_string())?;
            zip.add_file("safe_errors.json", &errors_bytes)
                .map_err(|e| e.to_string())?;
            zip.add_file("system_summary.json", &system_bytes)
                .map_err(|e| e.to_string())?;
            zip.add_file("settings_summary.json", &settings_bytes)
                .map_err(|e| e.to_string())?;

            zip.finish().map_err(|e| e.to_string())?;
        }

        // Replace destination atomically
        #[cfg(windows)]
        {
            if save_path.exists() {
                let _ = fs::remove_file(save_path);
            }
            fs::rename(&temp_path, save_path).map_err(|e| e.to_string())?;
        }
        #[cfg(not(windows))]
        {
            fs::rename(&temp_path, save_path).map_err(|e| e.to_string())?;
        }

        // Record export event
        self.record(DiagnosticRecord {
            timestamp: created_at,
            level: DiagnosticLevel::Info,
            component: DiagnosticComponent::Diagnostics,
            event_code: DiagnosticEventCode::DIAGNOSTICS_EXPORT,
            trace_id: None,
            message: "User diagnostics bundle exported successfully.".to_string(),
            details: None,
        });

        Ok(manifest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diagnostics_manager_retention_and_export() {
        let test_dir = std::env::temp_dir().join(format!("prime-test-diag-{}", std::process::id()));
        let _ = fs::create_dir_all(&test_dir);
        let mgr = DiagnosticsManager::new(Some(test_dir.clone()));

        // Add records
        for i in 0..10 {
            mgr.record(DiagnosticRecord {
                timestamp: iso_now(),
                level: DiagnosticLevel::Info,
                component: DiagnosticComponent::Shell,
                event_code: DiagnosticEventCode::APP_START,
                trace_id: Some(format!("trace-{i}")),
                message: format!("Test message {i} with C:\\secret\\path.txt"),
                details: None,
            });
        }

        mgr.record_safe_error(SafeErrorRecord {
            code: "ERR_TEST".to_string(),
            message: "Test error with /home/user/data".to_string(),
            timestamp: iso_now(),
            trace_id: Some("trace-err".to_string()),
            component: Some(DiagnosticComponent::Backend),
            user_recovery_hint: Some("Restart application".to_string()),
        });

        let backend_status = BackendStatus {
            state: crate::backend::protocol::BackendLifecycleState::Ready,
            ready: true,
            backend_version: Some("1.0.0".to_string()),
            circuit_open: false,
        };

        let summary = mgr.get_summary(backend_status.clone(), None);
        assert_eq!(summary.total_records, 11);
        assert_eq!(summary.recent_errors_count, 1);

        let preview = mgr.get_export_preview(&backend_status, None);
        assert_eq!(preview.entry_count, 5);
        assert!(preview.redaction_verified);

        let export_path = test_dir.join("bundle.zip");
        let manifest = mgr
            .export_bundle(&export_path, &backend_status, None)
            .unwrap();
        assert_eq!(manifest.entries.len(), 5);
        assert!(manifest.redaction_verified);
        assert!(export_path.exists());

        let _ = fs::remove_dir_all(&test_dir);
    }
}
