use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Instant,
};

use serde::{Deserialize, Serialize};

use super::error::{AppError, AppResult};

pub const MAX_REFERENCES: usize = 100;
pub const MAX_DOCUMENT_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10 MB
pub const MAX_TEXT_CONTENT_BYTES: usize = 1024 * 1024; // 1 MB

static SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentRef {
    pub id: String,
    pub display_name: String,
    pub size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRef {
    pub id: String,
    pub display_name: String,
    pub size: u64,
    pub kind: String,
}

#[derive(Debug, Clone)]
pub struct RegisteredReference {
    pub id: String,
    pub display_name: String,
    pub native_path: PathBuf,
    pub size: u64,
    pub media_type: Option<String>,
    pub writable: bool,
    pub created_at: Instant,
}

pub struct ReferenceRegistry {
    entries: Mutex<HashMap<String, RegisteredReference>>,
}

impl Default for ReferenceRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ReferenceRegistry {
    pub fn new() -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
        }
    }

    fn generate_id() -> String {
        let seq = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        format!("doc-{pid:x}-{seq:08x}")
    }

    pub fn register_document(&self, path: &Path, trace_id: &str) -> AppResult<DocumentRef> {
        let canonical_path = fs::canonicalize(path).map_err(|_| {
            AppError::validation("The selected file does not exist or is inaccessible.", trace_id)
        })?;

        let metadata = fs::metadata(&canonical_path).map_err(|_| {
            AppError::validation("Could not read metadata of selected file.", trace_id)
        })?;

        if !metadata.is_file() {
            return Err(AppError::validation(
                "Selected path is not a regular file.",
                trace_id,
            ));
        }

        let size = metadata.len();
        if size > MAX_DOCUMENT_SIZE_BYTES {
            return Err(AppError::exhausted(trace_id));
        }

        let display_name = canonical_path
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "document".to_owned());

        let media_type = match canonical_path.extension().and_then(|ext| ext.to_str()) {
            Some("txt") => Some("text/plain".to_owned()),
            Some("md") => Some("text/markdown".to_owned()),
            Some("json") => Some("application/json".to_owned()),
            _ => None,
        };

        let id = Self::generate_id();

        let mut guard = self
            .entries
            .lock()
            .map_err(|_| AppError::internal(trace_id))?;

        if guard.len() >= MAX_REFERENCES {
            return Err(AppError::exhausted(trace_id));
        }

        let registered = RegisteredReference {
            id: id.clone(),
            display_name: display_name.clone(),
            native_path: canonical_path,
            size,
            media_type: media_type.clone(),
            writable: false,
            created_at: Instant::now(),
        };

        guard.insert(id.clone(), registered);

        Ok(DocumentRef {
            id,
            display_name,
            size,
            media_type,
        })
    }

    pub fn register_save_target(
        &self,
        path: &Path,
        media_type: Option<String>,
        trace_id: &str,
    ) -> AppResult<DocumentRef> {
        let parent = path.parent().ok_or_else(|| {
            AppError::validation("Target path must have a parent directory.", trace_id)
        })?;

        let canonical_parent = fs::canonicalize(parent).map_err(|_| {
            AppError::validation("Parent directory does not exist or is inaccessible.", trace_id)
        })?;

        let file_name = path
            .file_name()
            .ok_or_else(|| AppError::validation("Target path has invalid filename.", trace_id))?;

        let canonical_target = canonical_parent.join(file_name);
        let display_name = file_name.to_string_lossy().to_string();
        let id = Self::generate_id();

        let mut guard = self
            .entries
            .lock()
            .map_err(|_| AppError::internal(trace_id))?;

        if guard.len() >= MAX_REFERENCES {
            return Err(AppError::exhausted(trace_id));
        }

        let size = if canonical_target.exists() {
            fs::metadata(&canonical_target).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };

        let registered = RegisteredReference {
            id: id.clone(),
            display_name: display_name.clone(),
            native_path: canonical_target,
            size,
            media_type: media_type.clone(),
            writable: true,
            created_at: Instant::now(),
        };

        guard.insert(id.clone(), registered);

        Ok(DocumentRef {
            id,
            display_name,
            size,
            media_type,
        })
    }

    pub fn read_content(&self, id: &str, trace_id: &str) -> AppResult<String> {
        let entry = {
            let guard = self
                .entries
                .lock()
                .map_err(|_| AppError::internal(trace_id))?;
            guard
                .get(id)
                .cloned()
                .ok_or_else(|| AppError::reference_not_found("Reference not found or expired.", trace_id))?
        };

        let metadata = fs::metadata(&entry.native_path).map_err(|_| AppError::io(trace_id))?;
        if metadata.len() > MAX_TEXT_CONTENT_BYTES as u64 {
            return Err(AppError::exhausted(trace_id));
        }

        let bytes = fs::read(&entry.native_path).map_err(|_| AppError::io(trace_id))?;
        String::from_utf8(bytes).map_err(|_| {
            AppError::validation("File content is not valid UTF-8 text.", trace_id)
        })
    }

    pub fn write_content(&self, id: &str, content: &str, trace_id: &str) -> AppResult<()> {
        if content.len() > MAX_TEXT_CONTENT_BYTES {
            return Err(AppError::exhausted(trace_id));
        }

        let entry = {
            let guard = self
                .entries
                .lock()
                .map_err(|_| AppError::internal(trace_id))?;
            guard
                .get(id)
                .cloned()
                .ok_or_else(|| AppError::reference_not_found("Reference not found or expired.", trace_id))?
        };

        if !entry.writable {
            return Err(AppError::authorization(
                "Reference is opened for read-only intent.",
                trace_id,
            ));
        }

        let parent = entry.native_path.parent().ok_or_else(|| {
            AppError::internal(trace_id)
        })?;

        let tmp_file_name = format!(
            ".tmp.{}.{}",
            std::process::id(),
            SEQUENCE.fetch_add(1, Ordering::Relaxed)
        );
        let tmp_path = parent.join(tmp_file_name);

        fs::write(&tmp_path, content.as_bytes()).map_err(|_| AppError::io(trace_id))?;

        if let Err(_err) = fs::rename(&tmp_path, &entry.native_path) {
            let _ = fs::remove_file(&tmp_path);
            return Err(AppError::io(trace_id));
        }

        // Update size in registry
        let mut guard = self
            .entries
            .lock()
            .map_err(|_| AppError::internal(trace_id))?;
        if let Some(existing) = guard.get_mut(id) {
            existing.size = content.len() as u64;
        }

        Ok(())
    }

    pub fn revoke(&self, id: &str) -> bool {
        if let Ok(mut guard) = self.entries.lock() {
            guard.remove(id).is_some()
        } else {
            false
        }
    }
}

pub fn pick_document_dialog() -> Option<PathBuf> {
    if env::var_os("PRIME_SHELL_TEST_PICKER_CANCEL").is_some() {
        return None;
    }
    if let Some(path) = env::var_os("PRIME_SHELL_TEST_PICKER_PATH") {
        return Some(PathBuf::from(path));
    }

    rfd::FileDialog::new()
        .add_filter("Documents", &["txt", "md", "json"])
        .pick_file()
}

pub fn save_document_dialog(default_name: &str) -> Option<PathBuf> {
    if env::var_os("PRIME_SHELL_TEST_PICKER_CANCEL").is_some() {
        return None;
    }
    if let Some(path) = env::var_os("PRIME_SHELL_TEST_PICKER_PATH") {
        return Some(PathBuf::from(path));
    }

    rfd::FileDialog::new()
        .set_file_name(default_name)
        .add_filter("Documents", &["txt", "md", "json"])
        .save_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reference_registry_stores_and_reads_safely() {
        let registry = ReferenceRegistry::new();
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test-doc-registry.txt");
        fs::write(&test_file, b"Hello Fluent World").expect("write test file");

        let doc_ref = registry
            .register_document(&test_file, "trace-test")
            .expect("must register document");

        assert!(doc_ref.id.starts_with("doc-"));
        assert_eq!(doc_ref.display_name, "test-doc-registry.txt");
        assert_eq!(doc_ref.size, 18);
        assert_eq!(doc_ref.media_type, Some("text/plain".to_owned()));

        // Verify native path is NOT in serialized representation
        let json = serde_json::to_string(&doc_ref).expect("serialize");
        assert!(!json.contains("temp"));
        assert!(!json.contains(&test_file.to_string_lossy().to_string()));

        // Read content
        let content = registry
            .read_content(&doc_ref.id, "trace-test")
            .expect("read content");
        assert_eq!(content, "Hello Fluent World");

        // Revoke
        assert!(registry.revoke(&doc_ref.id));
        assert!(registry.read_content(&doc_ref.id, "trace-test").is_err());

        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn write_content_enforces_writable_and_atomic_replace() {
        let registry = ReferenceRegistry::new();
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test-save-atomic.txt");

        let doc_ref = registry
            .register_save_target(&test_file, Some("text/plain".to_owned()), "trace-save")
            .expect("must register save target");

        registry
            .write_content(&doc_ref.id, "Updated content", "trace-save")
            .expect("must write");

        let content = fs::read_to_string(&test_file).expect("read from disk");
        assert_eq!(content, "Updated content");

        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn picker_dialog_respects_test_environment_variables() {
        env::set_var("PRIME_SHELL_TEST_PICKER_CANCEL", "1");
        assert!(pick_document_dialog().is_none());
        assert!(save_document_dialog("sample.txt").is_none());
        env::remove_var("PRIME_SHELL_TEST_PICKER_CANCEL");

        env::set_var("PRIME_SHELL_TEST_PICKER_PATH", "fake/path/doc.txt");
        assert_eq!(
            pick_document_dialog(),
            Some(PathBuf::from("fake/path/doc.txt"))
        );
        env::remove_var("PRIME_SHELL_TEST_PICKER_PATH");
    }
}
