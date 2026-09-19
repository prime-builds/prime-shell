pub mod backend;
pub mod layout;
pub mod theme;

use std::{
    env, fs,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};

use backend::{
    pick_document_dialog, save_document_dialog,
    protocol::{AckEnvelope, BackendLifecycleState},
    AppError, AppResult, BackendClient, BackendStatus, DocumentRef, EchoResponse, LaunchSpec,
    ReferenceRegistry, TaskSnapshot,
};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

struct BackendState {
    client: Mutex<Option<BackendClient>>,
}

static REQUEST_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProbeConfig {
    enabled: bool,
    evidence_path: Option<String>,
}

#[tauri::command]
fn backend_status(state: State<'_, BackendState>) -> AppResult<BackendStatus> {
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal("backend-status"))?;
        guard.as_ref().cloned()
    };
    Ok(match client {
        Some(client) => client.status(),
        None => BackendStatus {
            state: BackendLifecycleState::Stopped,
            ready: false,
            backend_version: None,
            circuit_open: false,
        },
    })
}

#[tauri::command]
fn echo_text(text: String, state: State<'_, BackendState>) -> AppResult<EchoResponse> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("request-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };
    client.echo(&text, &request_id, &trace_id)
}

#[tauri::command]
fn start_count_task(
    target: u64,
    delay_ms: u64,
    app: AppHandle,
    state: State<'_, BackendState>,
) -> AppResult<String> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let task_id = format!("task-{sequence}");
    let request_id = format!("request-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());

    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };

    let thread_app = app.clone();
    let thread_task_id = task_id.clone();
    let thread_req_id = request_id.clone();
    let thread_trace_id = trace_id.clone();

    std::thread::spawn(move || {
        let _ = client.count(
            target,
            delay_ms,
            &thread_req_id,
            &thread_trace_id,
            &thread_task_id,
            move |event| {
                let _ = thread_app.emit("task-event", &event);
            },
        );
    });

    Ok(task_id)
}

#[tauri::command]
fn cancel_task(task_id: String, state: State<'_, BackendState>) -> AppResult<AckEnvelope> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("cancel-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };
    client.cancel_task(&task_id, &request_id, &trace_id)
}

#[tauri::command]
fn get_task_snapshot(
    task_id: Option<String>,
    state: State<'_, BackendState>,
) -> AppResult<Option<TaskSnapshot>> {
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal("task-snapshot"))?;
        guard.as_ref().cloned()
    };
    if let Some(client) = client {
        if let Some(id) = task_id {
            Ok(client.get_task_snapshot(&id))
        } else {
            Ok(client.get_latest_task_snapshot())
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn trigger_crash(state: State<'_, BackendState>) -> AppResult<()> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("crash-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };
    client.crash(&request_id, &trace_id)
}

#[tauri::command]
fn trigger_hang(state: State<'_, BackendState>) -> AppResult<()> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("hang-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };
    client.hang(&request_id, &trace_id)
}

#[tauri::command]
fn trigger_large_rejected(state: State<'_, BackendState>) -> AppResult<()> {
    let sequence = REQUEST_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let request_id = format!("large-rejected-{sequence}");
    let trace_id = format!("trace-{}-{sequence}", std::process::id());
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal(&trace_id))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable(&trace_id))?
    };
    client.large_rejected(&request_id, &trace_id)
}

#[tauri::command]
fn reset_backend(state: State<'_, BackendState>) -> AppResult<BackendStatus> {
    let client = {
        let guard = state
            .client
            .lock()
            .map_err(|_| AppError::internal("reset-backend"))?;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| AppError::unavailable("reset-backend"))?
    };
    client.reset()
}

#[tauri::command]
fn runtime_probe_config() -> RuntimeProbeConfig {
    let enabled = env::var_os("PRIME_SHELL_NATIVE_RUNTIME_VERIFY").is_some();
    RuntimeProbeConfig {
        enabled,
        evidence_path: env::var("PRIME_SHELL_RUNTIME_EVIDENCE").ok(),
    }
}

#[tauri::command]
fn write_runtime_evidence(evidence: serde_json::Value, app: AppHandle) -> AppResult<()> {
    let trace = "runtime-evidence";
    if env::var_os("PRIME_SHELL_NATIVE_RUNTIME_VERIFY").is_none() {
        return Err(AppError::validation(
            "Native runtime verification is disabled.",
            trace,
        ));
    }
    let path = env::var("PRIME_SHELL_RUNTIME_EVIDENCE")
        .map_err(|_| AppError::validation("Runtime evidence path is not configured.", trace))?;
    let bytes = serde_json::to_vec_pretty(&evidence).map_err(|_| AppError::internal(trace))?;
    fs::write(path, bytes).map_err(|_| AppError::io(trace))?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn open_document_intent(
    references: State<'_, ReferenceRegistry>,
) -> AppResult<Option<DocumentRef>> {
    let trace_id = format!("open-intent-{}", std::process::id());
    let path = pick_document_dialog();
    match path {
        Some(path) => {
            let doc_ref = references.register_document(&path, &trace_id)?;
            Ok(Some(doc_ref))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn save_document_intent(
    default_name: Option<String>,
    references: State<'_, ReferenceRegistry>,
) -> AppResult<Option<DocumentRef>> {
    let trace_id = format!("save-intent-{}", std::process::id());
    let name = default_name.unwrap_or_else(|| "untitled.txt".to_owned());
    let path = save_document_dialog(&name);
    match path {
        Some(path) => {
            let doc_ref = references.register_save_target(&path, Some("text/plain".to_owned()), &trace_id)?;
            Ok(Some(doc_ref))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn read_document_content(
    id: String,
    references: State<'_, ReferenceRegistry>,
) -> AppResult<String> {
    let trace_id = format!("read-doc-{}", std::process::id());
    references.read_content(&id, &trace_id)
}

#[tauri::command]
fn write_document_content(
    id: String,
    content: String,
    references: State<'_, ReferenceRegistry>,
) -> AppResult<()> {
    let trace_id = format!("write-doc-{}", std::process::id());
    references.write_content(&id, &content, &trace_id)
}

#[tauri::command]
fn revoke_document_ref(
    id: String,
    references: State<'_, ReferenceRegistry>,
) -> bool {
    references.revoke(&id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(feature = "webdriver")]
    {
        builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    }

    builder
        .setup(|app| {
            let client = app.path().resource_dir().ok().and_then(|resource_dir| {
                if let Some(sidecar_path) = env::var_os("PRIME_SHELL_PACKAGED_SIDECAR") {
                    let exec = std::path::PathBuf::from(sidecar_path);
                    if let Some(target_root) = exec
                        .parent()
                        .and_then(|p| p.parent())
                        .map(std::path::Path::to_path_buf)
                    {
                        return BackendClient::launch(LaunchSpec::from_paths(exec, target_root))
                            .ok();
                    }
                }
                BackendClient::launch(LaunchSpec::from_resource_dir(&resource_dir)).ok()
            });
            app.manage(BackendState {
                client: Mutex::new(client),
            });
            app.manage(ReferenceRegistry::new());
            theme::apply_initial_window_theme(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backend_status,
            echo_text,
            start_count_task,
            cancel_task,
            get_task_snapshot,
            trigger_crash,
            trigger_hang,
            trigger_large_rejected,
            reset_backend,
            runtime_probe_config,
            write_runtime_evidence,
            open_document_intent,
            save_document_intent,
            read_document_content,
            write_document_content,
            revoke_document_ref,
            theme::get_theme_state,
            theme::sync_native_window_theme,
            layout::get_shell_layout_preferences,
            layout::save_shell_layout_preferences,
            layout::reset_shell_layout_preferences
        ])
        .run(tauri::generate_context!())
        .expect("error while running Prime Shell Lifecycle Spike");
}
