use std::{
    env,
    path::PathBuf,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use prime_shell_desktop_lib::backend::{
    protocol::{BackendLifecycleState, TaskState},
    BackendClient, LaunchSpec,
};

fn get_client() -> BackendClient {
    let executable = PathBuf::from(
        env::var_os("PRIME_SHELL_PACKAGED_SIDECAR")
            .expect("PRIME_SHELL_PACKAGED_SIDECAR must be set"),
    );
    let bundle_directory = executable.parent().expect("bundle directory");
    let target_root = bundle_directory
        .parent()
        .expect("target root")
        .to_path_buf();
    BackendClient::launch(LaunchSpec::from_paths(executable, target_root))
        .expect("packaged backend must launch")
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_unicode_echo() {
    let client = get_client();
    let text = "Hello — مرحبا — こんにちは 👋";
    let result = client
        .echo(text, "integration-request", "integration-trace")
        .expect("echo must succeed");
    assert_eq!(result.text, text);
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_count_completion() {
    let client = get_client();
    let events = Arc::new(Mutex::new(Vec::new()));
    let events_clone = events.clone();

    let completed = client
        .count(
            5,
            20,
            "req-count",
            "trace-count",
            "task-count-1",
            move |ev| {
                events_clone.lock().unwrap().push(ev);
            },
        )
        .expect("count must succeed");

    assert_eq!(completed, 5);
    let recorded = events.lock().unwrap();
    assert!(!recorded.is_empty(), "Must have recorded events");
    let terminal = recorded.iter().find(|e| e.event == "terminal");
    assert!(terminal.is_some(), "Must have terminal event");
    assert_eq!(terminal.unwrap().payload.status, Some(TaskState::Succeeded));
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_count_cancellation() {
    let client = get_client();
    let client_clone = client.clone();
    let events = Arc::new(Mutex::new(Vec::new()));
    let events_clone = events.clone();

    let handle = thread::spawn(move || {
        client_clone.count(
            50,
            40,
            "req-cancel",
            "trace-cancel",
            "task-cancel-1",
            move |ev| {
                events_clone.lock().unwrap().push(ev);
            },
        )
    });

    thread::sleep(Duration::from_millis(80));

    let ack = client
        .cancel_task("task-cancel-1", "cancel-req", "cancel-trace")
        .expect("cancel must return ack");
    assert_eq!(ack.status, "cancelling");

    let count_result = handle.join().expect("thread join must succeed");
    assert!(count_result.is_err());
    assert_eq!(count_result.unwrap_err().code, "TASK_CANCELLED");

    let recorded = events.lock().unwrap();
    let terminal = recorded.iter().find(|e| e.event == "terminal");
    assert!(terminal.is_some(), "Must have terminal cancellation event");
    assert_eq!(terminal.unwrap().payload.status, Some(TaskState::Cancelled));
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_crash_and_restart() {
    let client = get_client();
    let err = client
        .crash("req-crash", "trace-crash")
        .expect_err("crash must return error");
    assert_eq!(err.code, "BACKEND_CRASHED");

    // After 1 crash, auto-restart budget (1) restores state to Ready
    let status = client.status();
    assert_eq!(status.state, BackendLifecycleState::Ready);
    assert!(status.ready);

    // Echo works on restarted backend
    let echo_res = client
        .echo("recovered", "req-after-crash", "trace-after-crash")
        .expect("echo after crash must succeed");
    assert_eq!(echo_res.text, "recovered");
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_circuit_breaker() {
    let client = get_client();

    // 1st crash
    let _ = client.crash("req-crash-1", "trace-crash-1");
    assert_eq!(client.status().state, BackendLifecycleState::Ready);

    // 2nd crash within 60s window
    let _ = client.crash("req-crash-2", "trace-crash-2");
    let faulted_status = client.status();
    assert_eq!(faulted_status.state, BackendLifecycleState::Faulted);
    assert!(faulted_status.circuit_open);
    assert!(!faulted_status.ready);

    // Subsequent requests are blocked by circuit breaker
    let blocked_err = client
        .echo("blocked", "req-blocked", "trace-blocked")
        .expect_err("must be blocked");
    assert_eq!(blocked_err.code, "BACKEND_UNAVAILABLE");

    // Explicit reset restores backend
    let reset_status = client.reset().expect("reset must succeed");
    assert_eq!(reset_status.state, BackendLifecycleState::Ready);
    assert!(!reset_status.circuit_open);
    assert!(reset_status.ready);

    let echo_res = client
        .echo("recovered-after-reset", "req-ok", "trace-ok")
        .expect("echo after reset must succeed");
    assert_eq!(echo_res.text, "recovered-after-reset");
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_large_rejected() {
    let client = get_client();
    let err = client
        .large_rejected("req-large", "trace-large")
        .expect_err("large_rejected must fail with RESOURCE_EXHAUSTED");
    assert_eq!(err.code, "RESOURCE_EXHAUSTED");
}

#[test]
#[ignore = "requires PRIME_SHELL_PACKAGED_SIDECAR after the PyInstaller build"]
fn rust_to_packaged_python_hang_timeout_recovery() {
    let client = get_client();

    // 1. Start spike.hang, confirm no cooperative completion within deadline
    let err = client
        .hang("req-hang-1", "trace-hang-1")
        .expect_err("hang must trigger timeout escalation and return TASK_TIMED_OUT error");
    assert_eq!(err.code, "TASK_TIMED_OUT");

    // 2. Forced process termination & backend lifecycle recovery
    let status = client.status();
    assert_eq!(status.state, BackendLifecycleState::Ready);
    assert!(status.ready);

    // 3. Verify backend is cleanly responsive and hung work is NOT replayed
    let echo_res = client
        .echo("recovered-after-hang", "req-after-hang", "trace-after-hang")
        .expect("echo after hang escalation must succeed cleanly without replay");
    assert_eq!(echo_res.text, "recovered-after-hang");
}
