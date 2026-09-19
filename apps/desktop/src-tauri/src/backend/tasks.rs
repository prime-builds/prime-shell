use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::error::{AppError, AppResult};
use super::protocol::TaskState;

pub const MAX_STORED_SNAPSHOTS: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskSnapshot {
    pub task_id: String,
    pub operation: String,
    pub status: TaskState,
    pub current: u64,
    pub target: u64,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Validates whether a state transition from `current` to `target` is allowed by the task state machine.
pub fn can_transition(current: TaskState, target: TaskState) -> bool {
    match current {
        TaskState::Queued => matches!(
            target,
            TaskState::Running
                | TaskState::Cancelling
                | TaskState::TimedOut
                | TaskState::Interrupted
                | TaskState::Failed
        ),
        TaskState::Running => matches!(
            target,
            TaskState::Cancelling
                | TaskState::Succeeded
                | TaskState::Failed
                | TaskState::Cancelled
                | TaskState::TimedOut
                | TaskState::Interrupted
        ),
        TaskState::Cancelling => matches!(
            target,
            TaskState::Cancelled
                | TaskState::Succeeded // Valid race: task succeeded before cancellation could take effect
                | TaskState::TimedOut
                | TaskState::Interrupted
                | TaskState::Failed
        ),
        // All terminal states are immutable. Once terminal, no further transitions are allowed.
        TaskState::Succeeded
        | TaskState::Failed
        | TaskState::Cancelled
        | TaskState::TimedOut
        | TaskState::Interrupted => false,
    }
}

pub fn is_terminal(state: TaskState) -> bool {
    matches!(
        state,
        TaskState::Succeeded
            | TaskState::Failed
            | TaskState::Cancelled
            | TaskState::TimedOut
            | TaskState::Interrupted
    )
}

fn iso_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}Z", now.as_secs(), now.subsec_millis())
}

#[derive(Debug, Default)]
struct InnerStore {
    snapshots: VecDeque<TaskSnapshot>,
}

#[derive(Debug, Clone, Default)]
pub struct TaskStore {
    inner: Arc<Mutex<InnerStore>>,
}

impl TaskStore {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(InnerStore {
                snapshots: VecDeque::with_capacity(MAX_STORED_SNAPSHOTS),
            })),
        }
    }

    /// Attempts to register a new long-running task.
    /// Enforces the single-active-long-task invariant: if another task is non-terminal, returns BUSY.
    pub fn start_task(
        &self,
        task_id: String,
        operation: String,
        target: u64,
        trace_id: &str,
    ) -> AppResult<()> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| AppError::internal(trace_id))?;

        // Verify no active non-terminal task exists
        for item in &guard.snapshots {
            if !is_terminal(item.status) {
                return Err(AppError::busy(
                    "Another long-running task is currently active.",
                    trace_id,
                ));
            }
        }

        let now = iso_now();
        let snapshot = TaskSnapshot {
            task_id,
            operation,
            status: TaskState::Running,
            current: 0,
            target,
            error: None,
            created_at: now.clone(),
            updated_at: now,
        };

        if guard.snapshots.len() >= MAX_STORED_SNAPSHOTS {
            guard.snapshots.pop_front();
        }
        guard.snapshots.push_back(snapshot);

        Ok(())
    }

    /// Records progress for an active task.
    pub fn update_progress(&self, task_id: &str, current: u64, target: u64) {
        if let Ok(mut guard) = self.inner.lock() {
            if let Some(item) = guard.snapshots.iter_mut().find(|s| s.task_id == task_id) {
                if !is_terminal(item.status) {
                    item.current = current;
                    item.target = target;
                    item.updated_at = iso_now();
                }
            }
        }
    }

    /// Requests cancellation of an active task. Transitions state to `Cancelling`.
    pub fn request_cancellation(&self, task_id: &str) -> bool {
        if let Ok(mut guard) = self.inner.lock() {
            if let Some(item) = guard.snapshots.iter_mut().find(|s| s.task_id == task_id) {
                if can_transition(item.status, TaskState::Cancelling) {
                    item.status = TaskState::Cancelling;
                    item.updated_at = iso_now();
                    return true;
                }
            }
        }
        false
    }

    /// Records terminal completion of a task.
    /// Returns true if the terminal transition was accepted; false if already terminal or invalid.
    pub fn complete_task(
        &self,
        task_id: &str,
        terminal_status: TaskState,
        error: Option<String>,
    ) -> bool {
        if !is_terminal(terminal_status) {
            return false;
        }

        if let Ok(mut guard) = self.inner.lock() {
            if let Some(item) = guard.snapshots.iter_mut().find(|s| s.task_id == task_id) {
                if can_transition(item.status, terminal_status) {
                    item.status = terminal_status;
                    item.error = error;
                    item.updated_at = iso_now();
                    return true;
                }
            }
        }
        false
    }

    /// Retrieves a task snapshot by ID.
    pub fn get_snapshot(&self, task_id: &str) -> Option<TaskSnapshot> {
        if let Ok(guard) = self.inner.lock() {
            guard
                .snapshots
                .iter()
                .find(|s| s.task_id == task_id)
                .cloned()
        } else {
            None
        }
    }

    /// Retrieves the most recent active or terminal task snapshot.
    pub fn get_latest_snapshot(&self) -> Option<TaskSnapshot> {
        if let Ok(guard) = self.inner.lock() {
            guard.snapshots.back().cloned()
        } else {
            None
        }
    }

    /// Lists all retained task snapshots.
    pub fn list_snapshots(&self) -> Vec<TaskSnapshot> {
        if let Ok(guard) = self.inner.lock() {
            guard.snapshots.iter().cloned().collect()
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(can_transition(TaskState::Queued, TaskState::Running));
        assert!(can_transition(TaskState::Running, TaskState::Cancelling));
        assert!(can_transition(TaskState::Running, TaskState::Succeeded));
        assert!(can_transition(TaskState::Running, TaskState::Failed));
        assert!(can_transition(TaskState::Running, TaskState::TimedOut));
        assert!(can_transition(TaskState::Running, TaskState::Interrupted));
        assert!(can_transition(TaskState::Cancelling, TaskState::Cancelled));
        assert!(can_transition(TaskState::Cancelling, TaskState::Succeeded));
    }

    #[test]
    fn test_terminal_states_are_immutable() {
        let terminals = [
            TaskState::Succeeded,
            TaskState::Failed,
            TaskState::Cancelled,
            TaskState::TimedOut,
            TaskState::Interrupted,
        ];

        for &terminal in &terminals {
            assert!(is_terminal(terminal));
            for &next in &terminals {
                assert!(
                    !can_transition(terminal, next),
                    "{terminal:?} -> {next:?} must be rejected"
                );
            }
            assert!(!can_transition(terminal, TaskState::Running));
            assert!(!can_transition(terminal, TaskState::Cancelling));
            assert!(!can_transition(terminal, TaskState::Queued));
        }
    }

    #[test]
    fn test_cancel_vs_success_race() {
        let store = TaskStore::new();
        store
            .start_task(
                "task-1".to_owned(),
                "spike.count".to_owned(),
                100,
                "trace-1",
            )
            .unwrap();

        // Task completes successfully
        let completed = store.complete_task("task-1", TaskState::Succeeded, None);
        assert!(completed);

        // Later cancellation attempt must be rejected and not overwrite Succeeded
        let cancelled = store.request_cancellation("task-1");
        assert!(!cancelled);

        let snap = store.get_snapshot("task-1").unwrap();
        assert_eq!(snap.status, TaskState::Succeeded);
    }

    #[test]
    fn test_single_active_task_enforcement() {
        let store = TaskStore::new();
        store
            .start_task(
                "task-1".to_owned(),
                "spike.count".to_owned(),
                100,
                "trace-1",
            )
            .unwrap();

        // Attempting to start a second task while task-1 is running must fail
        let err = store.start_task(
            "task-2".to_owned(),
            "spike.count".to_owned(),
            100,
            "trace-2",
        );
        assert!(err.is_err());

        // Complete task-1
        store.complete_task("task-1", TaskState::Succeeded, None);

        // Now task-2 can start
        let ok = store.start_task(
            "task-2".to_owned(),
            "spike.count".to_owned(),
            100,
            "trace-2",
        );
        assert!(ok.is_ok());
    }

    #[test]
    fn test_bounded_snapshot_capacity() {
        let store = TaskStore::new();
        for i in 0..(MAX_STORED_SNAPSHOTS + 5) {
            let id = format!("task-{i}");
            store
                .start_task(id.clone(), "spike.count".to_owned(), 10, "trace")
                .unwrap();
            store.complete_task(&id, TaskState::Succeeded, None);
        }

        let list = store.list_snapshots();
        assert_eq!(list.len(), MAX_STORED_SNAPSHOTS);
        assert_eq!(list.first().unwrap().task_id, "task-5");
        assert_eq!(
            list.last().unwrap().task_id,
            format!("task-{}", MAX_STORED_SNAPSHOTS + 4)
        );
    }
}
