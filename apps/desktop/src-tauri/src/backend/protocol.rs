use serde::{Deserialize, Serialize};

use super::error::{AppError, AppResult};

pub const HANDSHAKE_MAX_BYTES: usize = 64 * 1024;
pub const FRAME_MAX_BYTES: usize = 1024 * 1024;
pub const LOG_MAX_BYTES: usize = 64 * 1024;
pub const TEXT_MAX_CHARACTERS: usize = 262_144;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum BackendLifecycleState {
    Stopped,
    Starting,
    Ready,
    Busy,
    Restarting,
    Stopping,
    Faulted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TaskState {
    Queued,
    Running,
    Cancelling,
    Succeeded,
    Failed,
    Cancelled,
    TimedOut,
    Interrupted,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Hello {
    pub protocol: String,
    pub kind: String,
    pub protocol_min: u32,
    pub protocol_max: u32,
    pub backend_version: String,
    pub build_id: String,
    pub target_triple: String,
    pub python_version: String,
    pub schema_hash: String,
    pub supported_operations: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BundleManifest {
    pub backend_version: String,
    pub build_id: String,
    pub schema_hash: String,
    pub target_triple: String,
    pub bundle_bytes: u64,
    pub files: Vec<BundleFile>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BundleFile {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestEnvelope<'a, T: Serialize> {
    pub protocol: &'static str,
    pub kind: &'static str,
    pub request_id: &'a str,
    pub trace_id: &'a str,
    pub operation: &'static str,
    pub payload: T,
}

#[derive(Debug, Serialize)]
pub struct EchoPayload<'a> {
    pub text: &'a str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CountPayload<'a> {
    pub target: u64,
    pub delay_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<&'a str>,
}

#[derive(Debug, Serialize)]
pub struct EmptyPayload {}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelEnvelope<'a> {
    pub protocol: &'static str,
    pub kind: &'static str,
    pub request_id: &'a str,
    pub trace_id: &'a str,
    pub task_id: &'a str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AckEnvelope {
    pub protocol: String,
    pub kind: String,
    pub request_id: String,
    pub trace_id: String,
    pub task_id: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEventPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<TaskState>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskEvent {
    pub protocol: String,
    pub kind: String,
    pub request_id: String,
    pub trace_id: String,
    pub task_id: String,
    pub sequence: u64,
    pub event: String,
    pub payload: TaskEventPayload,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenericIncomingFrame {
    pub protocol: String,
    pub kind: String,
    pub request_id: Option<String>,
    pub trace_id: Option<String>,
    pub task_id: Option<String>,
    pub operation: Option<String>,
    pub sequence: Option<u64>,
    pub event: Option<String>,
    pub status: Option<String>,
    pub payload: Option<serde_json::Value>,
    pub error: Option<BackendErrorPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BackendErrorPayload {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendStatus {
    pub state: BackendLifecycleState,
    pub ready: bool,
    pub backend_version: Option<String>,
    pub circuit_open: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EchoResponse {
    pub text: String,
    pub trace_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskStartResponse {
    pub task_id: String,
    pub trace_id: String,
}

pub fn validate_hello(
    hello: &Hello,
    manifest: &BundleManifest,
    expected_schema_hash: &str,
) -> AppResult<()> {
    let trace = "backend-handshake";
    if hello.protocol != "generic-app" || hello.kind != "hello" {
        return Err(AppError::mismatch(
            "Backend protocol identity mismatch.",
            trace,
        ));
    }
    if hello.protocol_min > 1 || hello.protocol_max < 1 {
        return Err(AppError::mismatch(
            "Backend protocol range mismatch.",
            trace,
        ));
    }
    if hello.backend_version != manifest.backend_version
        || hello.build_id != manifest.build_id
        || hello.schema_hash != manifest.schema_hash
        || hello.target_triple != manifest.target_triple
        || hello.schema_hash != expected_schema_hash
    {
        return Err(AppError::mismatch(
            "Packaged backend identity mismatch.",
            trace,
        ));
    }
    let expected_ops = [
        "spike.echo",
        "spike.count",
        "spike.crash",
        "spike.hang",
        "spike.largeRejected",
    ];
    if hello.python_version.is_empty() || hello.supported_operations != expected_ops {
        return Err(AppError::mismatch(
            "Packaged backend capabilities mismatch.",
            trace,
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{validate_hello, BundleManifest, Hello};

    fn manifest() -> BundleManifest {
        BundleManifest {
            backend_version: "0.1.0".to_owned(),
            build_id: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                .to_owned(),
            schema_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
                .to_owned(),
            target_triple: "linux-x86_64".to_owned(),
            bundle_bytes: 1,
            files: vec![],
        }
    }

    fn hello() -> Hello {
        Hello {
            protocol: "generic-app".to_owned(),
            kind: "hello".to_owned(),
            protocol_min: 1,
            protocol_max: 1,
            backend_version: "0.1.0".to_owned(),
            build_id: manifest().build_id,
            target_triple: "linux-x86_64".to_owned(),
            python_version: "3.12.13".to_owned(),
            schema_hash: manifest().schema_hash,
            supported_operations: vec![
                "spike.echo".to_owned(),
                "spike.count".to_owned(),
                "spike.crash".to_owned(),
                "spike.hang".to_owned(),
                "spike.largeRejected".to_owned(),
            ],
        }
    }

    #[test]
    fn valid_handshake_passes() {
        assert!(validate_hello(&hello(), &manifest(), &manifest().schema_hash).is_ok());
    }

    #[test]
    fn stale_schema_is_rejected() {
        let err = validate_hello(&hello(), &manifest(), "sha256:mismatch")
            .expect_err("mismatched schema must fail");
        assert_eq!(err.code, "BACKEND_PROTOCOL_MISMATCH");
    }
}
