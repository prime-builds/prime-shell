use std::{
    env, fs,
    io::{BufRead, BufReader, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        mpsc::{self, Receiver},
        Arc, Mutex, RwLock,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Serialize;
use sha2::{Digest, Sha256};

use super::{
    containment::{shutdown_child_bounded, ProcessContainment},
    error::{AppError, AppResult},
    protocol::{
        validate_hello, AckEnvelope, BackendLifecycleState, BackendStatus, BundleManifest,
        CancelEnvelope, CountPayload, DocAnalyzePayload, DocAnalyzeResultPayload,
        DocumentAnalysisMetrics, EchoPayload, EchoResponse, EmptyPayload, GenericIncomingFrame,
        Hello, RequestEnvelope, TaskEvent, TaskEventPayload, TaskState, FRAME_MAX_BYTES,
        HANDSHAKE_MAX_BYTES, LOG_MAX_BYTES, TEXT_MAX_CHARACTERS,
    },
    registry::BackendOperation,
    tasks::{TaskSnapshot, TaskStore},
};

const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const CANCELLATION_DEADLINE: Duration = Duration::from_secs(2);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(2);
const CIRCUIT_WINDOW: Duration = Duration::from_secs(60);

#[derive(Debug)]
enum FrameReadError {
    Io,
    Eof,
    TooLarge,
}

#[derive(Clone)]
pub struct LaunchSpec {
    pub executable: PathBuf,
    pub target_root: PathBuf,
}

impl LaunchSpec {
    pub fn from_resource_dir(resource_dir: &Path) -> Self {
        let target_root = resource_dir.join("sidecar").join(target_identity());
        let executable_name = if cfg!(windows) {
            "prime-shell-python-backend.exe"
        } else {
            "prime-shell-python-backend"
        };
        let executable = target_root
            .join("prime-shell-python-backend")
            .join(executable_name);
        Self {
            executable,
            target_root,
        }
    }

    pub fn from_paths(executable: PathBuf, target_root: PathBuf) -> Self {
        Self {
            executable,
            target_root,
        }
    }
}

struct BackendProcess {
    child: Mutex<Child>,
    stdin: Mutex<Option<ChildStdin>>,
    frames: Mutex<Receiver<Result<Vec<u8>, FrameReadError>>>,
    containment: ProcessContainment,
}

impl BackendProcess {
    fn spawn(spec: &LaunchSpec, trace: &str) -> AppResult<(Self, String)> {
        let target_root = spec
            .target_root
            .canonicalize()
            .map_err(|_| AppError::unavailable(trace))?;
        let executable = spec
            .executable
            .canonicalize()
            .map_err(|_| AppError::unavailable(trace))?;
        if !executable.starts_with(&target_root) || !executable.is_file() {
            return Err(AppError::unavailable(trace));
        }

        let manifest_bytes = fs::read(target_root.join("sidecar-manifest.json"))
            .map_err(|_| AppError::unavailable(trace))?;
        let manifest: BundleManifest = serde_json::from_slice(&manifest_bytes)
            .map_err(|_| AppError::mismatch("Sidecar manifest is invalid.", trace))?;
        verify_bundle(
            working_directory_from(&executable, trace)?,
            &manifest,
            trace,
        )?;

        let working_directory = working_directory_from(&executable, trace)?;
        let mut command = Command::new(&executable);
        command
            .current_dir(working_directory)
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        apply_minimal_environment(&mut command);

        let mut child = command.spawn().map_err(|_| AppError::unavailable(trace))?;
        let stdin = child.stdin.take().ok_or_else(|| AppError::io(trace))?;
        let stdout = child.stdout.take().ok_or_else(|| AppError::io(trace))?;
        let stderr = child.stderr.take().ok_or_else(|| AppError::io(trace))?;

        let containment = ProcessContainment::new();
        containment.assign(&child);

        let (sender, frames) = mpsc::sync_channel(256);
        thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut first = true;
            loop {
                let maximum = if first {
                    HANDSHAKE_MAX_BYTES
                } else {
                    FRAME_MAX_BYTES
                };
                first = false;
                let frame = read_bounded_line(&mut reader, maximum);
                let terminal = frame.is_err();
                if sender.send(frame).is_err() || terminal {
                    break;
                }
            }
        });

        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buffer = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buffer) {
                if n == 0 {
                    break;
                }
                let mut line = &buffer[..];
                if line.ends_with(b"\n") {
                    line = &line[..line.len() - 1];
                }
                if line.ends_with(b"\r") {
                    line = &line[..line.len() - 1];
                }
                let truncated = if line.len() > LOG_MAX_BYTES {
                    let mut t = line[..LOG_MAX_BYTES].to_vec();
                    t.extend_from_slice(b" [TRUNCATED]");
                    t
                } else {
                    line.to_vec()
                };
                if let Ok(text) = std::str::from_utf8(&truncated) {
                    eprintln!("[sidecar:stderr] {text}");
                }
                buffer.clear();
            }
        });

        let hello_frame = frames
            .recv_timeout(HANDSHAKE_TIMEOUT)
            .map_err(|_| AppError::unavailable(trace))?
            .map_err(|error| map_frame_error(error, trace))?;
        let hello: Hello = serde_json::from_slice(&hello_frame)
            .map_err(|_| AppError::mismatch("Backend hello is malformed.", trace))?;
        validate_hello(&hello, &manifest, env!("PRIME_SHELL_SCHEMA_HASH"))?;

        Ok((
            Self {
                child: Mutex::new(child),
                stdin: Mutex::new(Some(stdin)),
                frames: Mutex::new(frames),
                containment,
            },
            hello.backend_version,
        ))
    }

    fn write_frame<T: Serialize>(&self, value: &T, trace_id: &str) -> AppResult<()> {
        let mut encoded = serde_json::to_vec(value).map_err(|_| AppError::internal(trace_id))?;
        if encoded.len() > FRAME_MAX_BYTES {
            return Err(AppError::exhausted(trace_id));
        }
        encoded.push(b'\n');
        let mut guard = self
            .stdin
            .lock()
            .map_err(|_| AppError::internal(trace_id))?;
        let stdin = guard
            .as_mut()
            .ok_or_else(|| AppError::unavailable(trace_id))?;
        stdin
            .write_all(&encoded)
            .map_err(|_| AppError::io(trace_id))?;
        stdin.flush().map_err(|_| AppError::io(trace_id))
    }

    fn recv_frame(
        &self,
        timeout: Duration,
    ) -> Result<Result<Vec<u8>, FrameReadError>, mpsc::RecvTimeoutError> {
        let guard = self
            .frames
            .lock()
            .map_err(|_| mpsc::RecvTimeoutError::Disconnected)?;
        guard.recv_timeout(timeout)
    }

    fn is_alive(&self) -> bool {
        if let Ok(mut guard) = self.child.lock() {
            matches!(guard.try_wait(), Ok(None))
        } else {
            false
        }
    }

    fn kill(&self) {
        self.containment.terminate();
        if let Ok(mut guard) = self.child.lock() {
            let _ = guard.kill();
            let _ = guard.wait();
        }
    }
}

impl Drop for BackendProcess {
    fn drop(&mut self) {
        if let Ok(mut stdin_guard) = self.stdin.lock() {
            if let Some(stdin) = stdin_guard.as_mut() {
                let _ = stdin.write_all(b"{\"protocol\":\"generic-app\",\"kind\":\"shutdown\"}\n");
                let _ = stdin.flush();
            }
            stdin_guard.take();
        }

        if let Ok(mut child_guard) = self.child.lock() {
            shutdown_child_bounded(&mut child_guard, SHUTDOWN_TIMEOUT, Some(&self.containment));
        }
    }
}

#[derive(Clone)]
pub struct BackendClient {
    spec: LaunchSpec,
    process: Arc<RwLock<BackendProcess>>,
    backend_version: Arc<RwLock<String>>,
    state: Arc<RwLock<BackendLifecycleState>>,
    restart_budget: Arc<Mutex<u32>>,
    failure_history: Arc<Mutex<Vec<Instant>>>,
    circuit_open: Arc<RwLock<bool>>,
    active_task: Arc<RwLock<Option<String>>>,
    cancelling_task: Arc<RwLock<Option<(String, Instant)>>>,
    task_store: Arc<TaskStore>,
}

impl BackendClient {
    pub fn launch(spec: LaunchSpec) -> AppResult<Self> {
        let trace = "backend-launch";
        let (process, backend_version) = BackendProcess::spawn(&spec, trace)?;

        Ok(Self {
            spec,
            process: Arc::new(RwLock::new(process)),
            backend_version: Arc::new(RwLock::new(backend_version)),
            state: Arc::new(RwLock::new(BackendLifecycleState::Ready)),
            restart_budget: Arc::new(Mutex::new(1)),
            failure_history: Arc::new(Mutex::new(Vec::new())),
            circuit_open: Arc::new(RwLock::new(false)),
            active_task: Arc::new(RwLock::new(None)),
            cancelling_task: Arc::new(RwLock::new(None)),
            task_store: Arc::new(TaskStore::new()),
        })
    }

    pub fn task_store(&self) -> Arc<TaskStore> {
        Arc::clone(&self.task_store)
    }

    pub fn get_task_snapshot(&self, task_id: &str) -> Option<TaskSnapshot> {
        self.task_store.get_snapshot(task_id)
    }

    pub fn get_latest_task_snapshot(&self) -> Option<TaskSnapshot> {
        self.task_store.get_latest_snapshot()
    }

    pub fn status(&self) -> BackendStatus {
        let state = *self.state.read().unwrap_or_else(|e| e.into_inner());
        let circuit_open = *self.circuit_open.read().unwrap_or_else(|e| e.into_inner());
        let backend_version = self
            .backend_version
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .clone();

        BackendStatus {
            state,
            ready: state == BackendLifecycleState::Ready,
            backend_version: Some(backend_version),
            circuit_open,
        }
    }

    pub fn echo(&self, text: &str, request_id: &str, trace_id: &str) -> AppResult<EchoResponse> {
        if *self.circuit_open.read().unwrap_or_else(|e| e.into_inner())
            || *self.state.read().unwrap_or_else(|e| e.into_inner())
                == BackendLifecycleState::Faulted
        {
            return Err(AppError::unavailable(trace_id));
        }
        if text.chars().count() > TEXT_MAX_CHARACTERS {
            return Err(AppError::exhausted(trace_id));
        }
        let operation = BackendOperation::authorize("spike.echo", trace_id)?;
        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: EchoPayload { text },
        };

        let proc = self
            .process
            .read()
            .map_err(|_| AppError::internal(trace_id))?;
        proc.write_frame(&request, trace_id)?;

        let frame = match proc.recv_frame(REQUEST_TIMEOUT) {
            Ok(Ok(f)) => f,
            Ok(Err(err)) => return Err(map_frame_error(err, trace_id)),
            Err(_) => return Err(AppError::unavailable(trace_id)),
        };

        let response: GenericIncomingFrame = serde_json::from_slice(&frame)
            .map_err(|_| AppError::protocol("Backend response is malformed.", trace_id))?;

        if response.kind == "result" {
            if let Some(payload) = response.payload {
                if let Some(res_text) = payload.get("text").and_then(|v| v.as_str()) {
                    return Ok(EchoResponse {
                        text: res_text.to_owned(),
                        trace_id: trace_id.to_owned(),
                    });
                }
            }
        } else if response.kind == "error" {
            if let Some(err) = response.error {
                return Err(AppError {
                    code: Box::leak(err.code.into_boxed_str()),
                    message: err.message,
                    trace_id: trace_id.to_owned(),
                });
            }
        }

        Err(AppError::protocol(
            "Invalid echo response structure.",
            trace_id,
        ))
    }

    pub fn count<F>(
        &self,
        target: u64,
        delay_ms: u64,
        request_id: &str,
        trace_id: &str,
        task_id: &str,
        mut on_event: F,
    ) -> AppResult<u64>
    where
        F: FnMut(TaskEvent),
    {
        if *self.circuit_open.read().unwrap_or_else(|e| e.into_inner())
            || *self.state.read().unwrap_or_else(|e| e.into_inner())
                == BackendLifecycleState::Faulted
        {
            return Err(AppError::unavailable(trace_id));
        }

        let operation = BackendOperation::authorize("spike.count", trace_id)?;
        self.task_store.start_task(
            task_id.to_owned(),
            operation.name().to_owned(),
            target,
            trace_id,
        )?;
        {
            let mut state_guard = self
                .state
                .write()
                .map_err(|_| AppError::internal(trace_id))?;
            if *state_guard != BackendLifecycleState::Ready {
                return Err(AppError::busy("Backend is not ready.", trace_id));
            }
            *state_guard = BackendLifecycleState::Busy;
        }
        *self.active_task.write().unwrap() = Some(task_id.to_owned());
        *self.cancelling_task.write().unwrap() = None;

        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: CountPayload {
                target,
                delay_ms,
                task_id: Some(task_id),
            },
        };

        {
            let proc = self
                .process
                .read()
                .map_err(|_| AppError::internal(trace_id))?;
            if let Err(err) = proc.write_frame(&request, trace_id) {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                self.task_store.complete_task(
                    task_id,
                    TaskState::Failed,
                    Some("Failed to send request to backend".to_owned()),
                );
                return Err(err);
            }
        }

        let mut last_progress_sent = Instant::now() - Duration::from_millis(150);
        let mut last_reported_count = 0_u64;
        let max_timeout = Duration::from_millis(delay_ms.saturating_mul(target) + 15_000);
        let start_time = Instant::now();

        loop {
            if start_time.elapsed() > max_timeout {
                self.task_store.complete_task(
                    task_id,
                    TaskState::TimedOut,
                    Some("Task execution timed out".to_owned()),
                );
                self.handle_failure(trace_id);
                return Err(AppError::timed_out(trace_id));
            }

            // Cancellation deadline escalation check (<= 2s)
            if let Some((cancelling_id, requested_at)) =
                self.cancelling_task.read().unwrap().as_ref()
            {
                if cancelling_id == task_id && requested_at.elapsed() > CANCELLATION_DEADLINE {
                    if let Ok(proc) = self.process.read() {
                        proc.kill();
                    }
                    self.task_store.complete_task(
                        task_id,
                        TaskState::Interrupted,
                        Some("Cancellation deadline escalated to termination".to_owned()),
                    );
                    self.handle_failure(trace_id);
                    on_event(TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: request_id.to_owned(),
                        trace_id: trace_id.to_owned(),
                        task_id: task_id.to_owned(),
                        sequence: 999999,
                        event: "terminal".to_owned(),
                        payload: TaskEventPayload {
                            current: None,
                            target: Some(target),
                            status: Some(TaskState::Interrupted),
                            completed: Some(last_reported_count),
                        },
                    });
                    return Err(AppError::timed_out(trace_id));
                }
            }

            let frame_res = {
                let proc = self
                    .process
                    .read()
                    .map_err(|_| AppError::internal(trace_id))?;
                if !proc.is_alive() {
                    drop(proc);
                    self.task_store.complete_task(
                        task_id,
                        TaskState::Interrupted,
                        Some("Process terminated unexpectedly".to_owned()),
                    );
                    self.handle_failure(trace_id);
                    on_event(TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: request_id.to_owned(),
                        trace_id: trace_id.to_owned(),
                        task_id: task_id.to_owned(),
                        sequence: 999999,
                        event: "terminal".to_owned(),
                        payload: TaskEventPayload {
                            current: None,
                            target: Some(target),
                            status: Some(TaskState::Interrupted),
                            completed: Some(last_reported_count),
                        },
                    });
                    return Err(AppError::crashed(trace_id));
                }
                proc.recv_frame(Duration::from_millis(100))
            };

            let frame = match frame_res {
                Ok(Ok(bytes)) => bytes,
                Ok(Err(err)) => {
                    self.handle_failure(trace_id);
                    return Err(map_frame_error(err, trace_id));
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    continue;
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    self.handle_failure(trace_id);
                    return Err(AppError::crashed(trace_id));
                }
            };

            let incoming: GenericIncomingFrame = serde_json::from_slice(&frame)
                .map_err(|_| AppError::protocol("Malformed task frame from backend.", trace_id))?;

            if incoming.kind == "event" {
                let event_type = incoming.event.as_deref().unwrap_or("");
                let is_terminal = event_type == "terminal";
                let event_payload: TaskEventPayload = incoming
                    .payload
                    .and_then(|p| serde_json::from_value(p).ok())
                    .unwrap_or(TaskEventPayload {
                        current: None,
                        target: None,
                        status: None,
                        completed: None,
                    });

                if let Some(cur) = event_payload.current {
                    last_reported_count = cur;
                    self.task_store.update_progress(task_id, cur, target);
                }
                if let Some(comp) = event_payload.completed {
                    last_reported_count = comp;
                    self.task_store.update_progress(task_id, comp, target);
                }
                if is_terminal {
                    if let Some(st) = event_payload.status {
                        self.task_store.complete_task(task_id, st, None);
                    }
                }

                let is_final_progress =
                    event_payload.current.is_some() && event_payload.current == Some(target);
                let should_send = if is_terminal || is_final_progress {
                    last_progress_sent = Instant::now();
                    true
                } else {
                    let now = Instant::now();
                    if now.duration_since(last_progress_sent) >= Duration::from_millis(100) {
                        last_progress_sent = now;
                        true
                    } else {
                        false
                    }
                };

                if should_send {
                    let task_event = TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: incoming.request_id.clone().unwrap_or_default(),
                        trace_id: trace_id.to_owned(),
                        task_id: incoming
                            .task_id
                            .clone()
                            .unwrap_or_else(|| task_id.to_owned()),
                        sequence: incoming.sequence.unwrap_or(0),
                        event: event_type.to_owned(),
                        payload: event_payload,
                    };
                    on_event(task_event);
                }
            } else if incoming.kind == "result" {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                *self.cancelling_task.write().unwrap() = None;
                self.task_store
                    .complete_task(task_id, TaskState::Succeeded, None);
                let completed = incoming
                    .payload
                    .and_then(|p| p.get("completed").and_then(|v| v.as_u64()))
                    .unwrap_or(target);
                return Ok(completed);
            } else if incoming.kind == "error" {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                *self.cancelling_task.write().unwrap() = None;
                let code = incoming
                    .error
                    .as_ref()
                    .map(|e| e.code.as_str())
                    .unwrap_or("INTERNAL_ERROR");
                let msg = incoming
                    .error
                    .as_ref()
                    .map(|e| e.message.clone())
                    .unwrap_or_else(|| "Task error".to_owned());
                let final_status = if code == "TASK_CANCELLED" {
                    TaskState::Cancelled
                } else {
                    TaskState::Failed
                };
                self.task_store
                    .complete_task(task_id, final_status, Some(msg.clone()));
                if code == "TASK_CANCELLED" {
                    return Err(AppError::cancelled(trace_id));
                }
                return Err(AppError {
                    code: Box::leak(code.to_owned().into_boxed_str()),
                    message: msg,
                    trace_id: trace_id.to_owned(),
                });
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn analyze_document<F>(
        &self,
        text: &str,
        query: Option<&str>,
        max_top_terms: Option<usize>,
        request_id: &str,
        trace_id: &str,
        task_id: &str,
        mut on_event: F,
    ) -> AppResult<DocumentAnalysisMetrics>
    where
        F: FnMut(TaskEvent),
    {
        if *self.circuit_open.read().unwrap_or_else(|e| e.into_inner())
            || *self.state.read().unwrap_or_else(|e| e.into_inner())
                == BackendLifecycleState::Faulted
        {
            return Err(AppError::unavailable(trace_id));
        }

        let operation = BackendOperation::authorize("doc.analyze", trace_id)?;
        self.task_store.start_task(
            task_id.to_owned(),
            operation.name().to_owned(),
            100,
            trace_id,
        )?;
        {
            let mut state_guard = self
                .state
                .write()
                .map_err(|_| AppError::internal(trace_id))?;
            if *state_guard != BackendLifecycleState::Ready {
                return Err(AppError::busy("Backend is not ready.", trace_id));
            }
            *state_guard = BackendLifecycleState::Busy;
        }
        *self.active_task.write().unwrap() = Some(task_id.to_owned());
        *self.cancelling_task.write().unwrap() = None;

        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: DocAnalyzePayload {
                text,
                query,
                max_top_terms,
                task_id: Some(task_id),
            },
        };

        {
            let proc = self
                .process
                .read()
                .map_err(|_| AppError::internal(trace_id))?;
            if let Err(err) = proc.write_frame(&request, trace_id) {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                self.task_store.complete_task(
                    task_id,
                    TaskState::Failed,
                    Some("Failed to send request to backend".to_owned()),
                );
                return Err(err);
            }
        }

        let mut last_progress_sent = Instant::now() - Duration::from_millis(150);
        let mut last_reported_progress = 0_u64;
        let max_timeout = Duration::from_millis(60_000);
        let start_time = Instant::now();

        loop {
            if start_time.elapsed() > max_timeout {
                self.task_store.complete_task(
                    task_id,
                    TaskState::TimedOut,
                    Some("Task execution timed out".to_owned()),
                );
                self.handle_failure(trace_id);
                return Err(AppError::timed_out(trace_id));
            }

            // Cancellation deadline escalation check (<= 2s)
            if let Some((cancelling_id, requested_at)) =
                self.cancelling_task.read().unwrap().as_ref()
            {
                if cancelling_id == task_id && requested_at.elapsed() > CANCELLATION_DEADLINE {
                    if let Ok(proc) = self.process.read() {
                        proc.kill();
                    }
                    self.task_store.complete_task(
                        task_id,
                        TaskState::Interrupted,
                        Some("Cancellation deadline escalated to termination".to_owned()),
                    );
                    self.handle_failure(trace_id);
                    on_event(TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: request_id.to_owned(),
                        trace_id: trace_id.to_owned(),
                        task_id: task_id.to_owned(),
                        sequence: 999999,
                        event: "terminal".to_owned(),
                        payload: TaskEventPayload {
                            current: None,
                            target: Some(100),
                            status: Some(TaskState::Interrupted),
                            completed: Some(last_reported_progress),
                        },
                    });
                    return Err(AppError::timed_out(trace_id));
                }
            }

            let frame_res = {
                let proc = self
                    .process
                    .read()
                    .map_err(|_| AppError::internal(trace_id))?;
                if !proc.is_alive() {
                    drop(proc);
                    self.task_store.complete_task(
                        task_id,
                        TaskState::Interrupted,
                        Some("Process terminated unexpectedly".to_owned()),
                    );
                    self.handle_failure(trace_id);
                    on_event(TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: request_id.to_owned(),
                        trace_id: trace_id.to_owned(),
                        task_id: task_id.to_owned(),
                        sequence: 999999,
                        event: "terminal".to_owned(),
                        payload: TaskEventPayload {
                            current: None,
                            target: Some(100),
                            status: Some(TaskState::Interrupted),
                            completed: Some(last_reported_progress),
                        },
                    });
                    return Err(AppError::crashed(trace_id));
                }
                proc.recv_frame(Duration::from_millis(100))
            };

            let frame = match frame_res {
                Ok(Ok(bytes)) => bytes,
                Ok(Err(err)) => {
                    self.handle_failure(trace_id);
                    return Err(map_frame_error(err, trace_id));
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    continue;
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    self.handle_failure(trace_id);
                    return Err(AppError::crashed(trace_id));
                }
            };

            let incoming: GenericIncomingFrame = serde_json::from_slice(&frame)
                .map_err(|_| AppError::protocol("Malformed task frame from backend.", trace_id))?;

            if incoming.kind == "event" {
                let event_type = incoming.event.as_deref().unwrap_or("");
                let is_terminal = event_type == "terminal";
                let event_payload: TaskEventPayload = incoming
                    .payload
                    .and_then(|p| serde_json::from_value(p).ok())
                    .unwrap_or(TaskEventPayload {
                        current: None,
                        target: None,
                        status: None,
                        completed: None,
                    });

                if let Some(cur) = event_payload.current {
                    last_reported_progress = cur;
                    self.task_store.update_progress(task_id, cur, 100);
                }
                if let Some(comp) = event_payload.completed {
                    last_reported_progress = comp;
                    self.task_store.update_progress(task_id, comp, 100);
                }
                if is_terminal {
                    if let Some(st) = event_payload.status {
                        self.task_store.complete_task(task_id, st, None);
                    }
                }

                let is_final_progress =
                    event_payload.current.is_some() && event_payload.current == Some(100);
                let should_send = if is_terminal || is_final_progress {
                    last_progress_sent = Instant::now();
                    true
                } else {
                    let now = Instant::now();
                    if now.duration_since(last_progress_sent) >= Duration::from_millis(100) {
                        last_progress_sent = now;
                        true
                    } else {
                        false
                    }
                };

                if should_send {
                    let task_event = TaskEvent {
                        protocol: "generic-app".to_owned(),
                        kind: "event".to_owned(),
                        request_id: incoming.request_id.clone().unwrap_or_default(),
                        trace_id: trace_id.to_owned(),
                        task_id: incoming
                            .task_id
                            .clone()
                            .unwrap_or_else(|| task_id.to_owned()),
                        sequence: incoming.sequence.unwrap_or(0),
                        event: event_type.to_owned(),
                        payload: event_payload,
                    };
                    on_event(task_event);
                }
            } else if incoming.kind == "result" {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                *self.cancelling_task.write().unwrap() = None;
                self.task_store
                    .complete_task(task_id, TaskState::Succeeded, None);
                let result_payload: DocAnalyzeResultPayload = incoming
                    .payload
                    .and_then(|p| serde_json::from_value(p).ok())
                    .ok_or_else(|| {
                        AppError::protocol("Invalid doc.analyze result payload.", trace_id)
                    })?;
                return Ok(result_payload.metrics);
            } else if incoming.kind == "error" {
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
                *self.active_task.write().unwrap() = None;
                *self.cancelling_task.write().unwrap() = None;
                let code = incoming
                    .error
                    .as_ref()
                    .map(|e| e.code.as_str())
                    .unwrap_or("INTERNAL_ERROR");
                let msg = incoming
                    .error
                    .as_ref()
                    .map(|e| e.message.clone())
                    .unwrap_or_else(|| "Task error".to_owned());
                let final_status = if code == "TASK_CANCELLED" {
                    TaskState::Cancelled
                } else {
                    TaskState::Failed
                };
                self.task_store
                    .complete_task(task_id, final_status, Some(msg.clone()));
                if code == "TASK_CANCELLED" {
                    return Err(AppError::cancelled(trace_id));
                }
                return Err(AppError {
                    code: Box::leak(code.to_owned().into_boxed_str()),
                    message: msg,
                    trace_id: trace_id.to_owned(),
                });
            }
        }
    }

    pub fn cancel_task(
        &self,
        task_id: &str,
        request_id: &str,
        trace_id: &str,
    ) -> AppResult<AckEnvelope> {
        let active = self.active_task.read().unwrap().clone();
        if active.as_deref() != Some(task_id) {
            return Ok(AckEnvelope {
                protocol: "generic-app".to_owned(),
                kind: "ack".to_owned(),
                request_id: request_id.to_owned(),
                trace_id: trace_id.to_owned(),
                task_id: task_id.to_owned(),
                status: "not_found".to_owned(),
            });
        }

        self.task_store.request_cancellation(task_id);
        *self.cancelling_task.write().unwrap() = Some((task_id.to_owned(), Instant::now()));

        let cancel = CancelEnvelope {
            protocol: "generic-app",
            kind: "cancel",
            request_id,
            trace_id,
            task_id,
        };
        let proc = self
            .process
            .read()
            .map_err(|_| AppError::internal(trace_id))?;
        proc.write_frame(&cancel, trace_id)?;

        Ok(AckEnvelope {
            protocol: "generic-app".to_owned(),
            kind: "ack".to_owned(),
            request_id: request_id.to_owned(),
            trace_id: trace_id.to_owned(),
            task_id: task_id.to_owned(),
            status: "cancelling".to_owned(),
        })
    }

    pub fn crash(&self, request_id: &str, trace_id: &str) -> AppResult<()> {
        let operation = BackendOperation::authorize("spike.crash", trace_id)?;
        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: EmptyPayload {},
        };
        {
            let proc = self
                .process
                .read()
                .map_err(|_| AppError::internal(trace_id))?;
            let _ = proc.write_frame(&request, trace_id);
        }
        thread::sleep(Duration::from_millis(150));
        self.handle_failure(trace_id);
        Err(AppError::crashed(trace_id))
    }

    pub fn hang(&self, request_id: &str, trace_id: &str) -> AppResult<()> {
        let operation = BackendOperation::authorize("spike.hang", trace_id)?;
        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: EmptyPayload {},
        };
        {
            let proc = self
                .process
                .read()
                .map_err(|_| AppError::internal(trace_id))?;
            let _ = proc.write_frame(&request, trace_id);
        }

        // Simulate hang: wait deadline, then escalate and kill
        thread::sleep(CANCELLATION_DEADLINE);
        {
            let proc = self
                .process
                .read()
                .map_err(|_| AppError::internal(trace_id))?;
            proc.kill();
        }
        self.handle_failure(trace_id);
        Err(AppError::timed_out(trace_id))
    }

    pub fn large_rejected(&self, request_id: &str, trace_id: &str) -> AppResult<()> {
        let operation = BackendOperation::authorize("spike.largeRejected", trace_id)?;
        let request = RequestEnvelope {
            protocol: "generic-app",
            kind: "request",
            request_id,
            trace_id,
            operation: operation.name(),
            payload: EmptyPayload {},
        };
        let proc = self
            .process
            .read()
            .map_err(|_| AppError::internal(trace_id))?;
        proc.write_frame(&request, trace_id)?;

        let frame = match proc.recv_frame(REQUEST_TIMEOUT) {
            Ok(Ok(bytes)) => bytes,
            Ok(Err(err)) => return Err(map_frame_error(err, trace_id)),
            Err(_) => return Err(AppError::unavailable(trace_id)),
        };

        let response: GenericIncomingFrame = serde_json::from_slice(&frame)
            .map_err(|_| AppError::protocol("Malformed response.", trace_id))?;

        if response.kind == "error" {
            return Err(AppError::exhausted(trace_id));
        }
        Ok(())
    }

    pub fn reset(&self) -> AppResult<BackendStatus> {
        let trace = "backend-reset";
        *self.circuit_open.write().unwrap() = false;
        self.failure_history.lock().unwrap().clear();
        *self.restart_budget.lock().unwrap() = 1;

        *self.state.write().unwrap() = BackendLifecycleState::Starting;
        let (new_proc, new_version) = BackendProcess::spawn(&self.spec, trace)?;

        {
            let mut proc_guard = self
                .process
                .write()
                .map_err(|_| AppError::internal(trace))?;
            *proc_guard = new_proc;
        }
        *self.backend_version.write().unwrap() = new_version;
        *self.state.write().unwrap() = BackendLifecycleState::Ready;
        *self.active_task.write().unwrap() = None;
        *self.cancelling_task.write().unwrap() = None;

        Ok(self.status())
    }

    fn handle_failure(&self, trace_id: &str) {
        let now = Instant::now();
        let mut history = self.failure_history.lock().unwrap();
        history.retain(|t| now.duration_since(*t) < CIRCUIT_WINDOW);
        history.push(now);

        *self.active_task.write().unwrap() = None;
        *self.cancelling_task.write().unwrap() = None;

        let mut budget = self.restart_budget.lock().unwrap();
        // Check circuit breaker
        if history.len() >= 2 || *budget == 0 {
            *self.circuit_open.write().unwrap() = true;
            *self.state.write().unwrap() = BackendLifecycleState::Faulted;
            if let Ok(proc) = self.process.read() {
                proc.kill();
            }
            return;
        }

        // Attempt single bounded restart
        *self.state.write().unwrap() = BackendLifecycleState::Restarting;
        if let Ok(proc) = self.process.read() {
            proc.kill();
        }

        thread::sleep(Duration::from_millis(100));
        match BackendProcess::spawn(&self.spec, trace_id) {
            Ok((new_proc, ver)) => {
                if let Ok(mut proc_guard) = self.process.write() {
                    *proc_guard = new_proc;
                }
                *self.backend_version.write().unwrap() = ver;
                *budget = budget.saturating_sub(1);
                *self.state.write().unwrap() = BackendLifecycleState::Ready;
            }
            Err(_) => {
                *self.circuit_open.write().unwrap() = true;
                *self.state.write().unwrap() = BackendLifecycleState::Faulted;
            }
        }
    }
}

fn map_frame_error(error: FrameReadError, trace_id: &str) -> AppError {
    match error {
        FrameReadError::TooLarge => AppError::exhausted(trace_id),
        FrameReadError::Io => AppError::io(trace_id),
        FrameReadError::Eof => AppError::crashed(trace_id),
    }
}

fn read_bounded_line<R: BufRead>(
    reader: &mut R,
    maximum: usize,
) -> Result<Vec<u8>, FrameReadError> {
    let mut line = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(|_| FrameReadError::Io)?;
        if available.is_empty() {
            if line.is_empty() {
                return Err(FrameReadError::Eof);
            }
            if line.len() > maximum {
                return Err(FrameReadError::TooLarge);
            }
            return Ok(line);
        }
        if let Some(index) = available.iter().position(|byte| *byte == b'\n') {
            if line.len() + index > maximum {
                return Err(FrameReadError::TooLarge);
            }
            line.extend_from_slice(&available[..index]);
            reader.consume(index + 1);
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            return Ok(line);
        }
        if line.len() + available.len() > maximum {
            return Err(FrameReadError::TooLarge);
        }
        let count = available.len();
        line.extend_from_slice(available);
        reader.consume(count);
    }
}

fn target_identity() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "windows-x86_64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "macos-aarch64"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "linux-x86_64"
    } else {
        "unsupported-target"
    }
}

fn apply_minimal_environment(command: &mut Command) {
    if cfg!(windows) {
        for key in ["SYSTEMROOT", "WINDIR", "TEMP", "TMP"] {
            if let Some(value) = env::var_os(key) {
                command.env(key, value);
            }
        }
    } else {
        command.env("LANG", "C.UTF-8").env("LC_ALL", "C.UTF-8");
    }
}

fn working_directory_from<'a>(executable: &'a Path, trace_id: &str) -> AppResult<&'a Path> {
    executable
        .parent()
        .ok_or_else(|| AppError::unavailable(trace_id))
}

fn verify_bundle(bundle_root: &Path, manifest: &BundleManifest, trace_id: &str) -> AppResult<()> {
    let canonical_root = bundle_root
        .canonicalize()
        .map_err(|_| AppError::unavailable(trace_id))?;
    let mut total = 0_u64;
    if manifest.files.is_empty() {
        return Err(AppError::mismatch("Sidecar manifest is empty.", trace_id));
    }
    for entry in &manifest.files {
        let path = bundle_root.join(&entry.path);
        let canonical = path
            .canonicalize()
            .map_err(|_| AppError::mismatch("Sidecar bundle file is missing.", trace_id))?;
        if !canonical.starts_with(&canonical_root) {
            return Err(AppError::mismatch(
                "Sidecar bundle path escapes its resource directory.",
                trace_id,
            ));
        }
        let bytes = fs::read(&canonical)
            .map_err(|_| AppError::mismatch("Sidecar bundle file is unreadable.", trace_id))?;
        if bytes.len() as u64 != entry.size {
            return Err(AppError::mismatch(
                "Sidecar bundle size mismatch.",
                trace_id,
            ));
        }
        let hash = format!("{:x}", Sha256::digest(&bytes));
        if hash != entry.sha256 {
            return Err(AppError::mismatch(
                "Sidecar bundle hash mismatch.",
                trace_id,
            ));
        }
        total = total.saturating_add(entry.size);
    }
    if total != manifest.bundle_bytes {
        return Err(AppError::mismatch(
            "Sidecar bundle aggregate size mismatch.",
            trace_id,
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::io::{BufReader, Cursor};

    use super::{read_bounded_line, FrameReadError};

    #[test]
    fn crlf_is_accepted() {
        let mut reader = BufReader::new(Cursor::new(b"{\"ok\":true}\r\n"));
        assert_eq!(
            read_bounded_line(&mut reader, 64).expect("line must parse"),
            b"{\"ok\":true}"
        );
    }

    #[test]
    fn oversized_frame_is_rejected_without_unbounded_growth() {
        let data = vec![b'x'; 65];
        let mut reader = BufReader::new(Cursor::new(data));
        assert!(matches!(
            read_bounded_line(&mut reader, 64),
            Err(FrameReadError::TooLarge)
        ));
    }
}
