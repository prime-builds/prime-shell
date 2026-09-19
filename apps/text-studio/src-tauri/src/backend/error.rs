use serde::Serialize;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, Error, Serialize)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    pub trace_id: String,
}

impl AppError {
    pub fn validation(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "VALIDATION_ERROR",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn unavailable(trace_id: impl Into<String>) -> Self {
        Self {
            code: "BACKEND_UNAVAILABLE",
            message: "The packaged backend is unavailable.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn protocol(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "PROTOCOL_ERROR",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn mismatch(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "BACKEND_PROTOCOL_MISMATCH",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn exhausted(trace_id: impl Into<String>) -> Self {
        Self {
            code: "RESOURCE_EXHAUSTED",
            message: "The request exceeds the configured protocol limit.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn io(trace_id: impl Into<String>) -> Self {
        Self {
            code: "IO_ERROR",
            message: "The packaged backend could not be reached.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn internal(trace_id: impl Into<String>) -> Self {
        Self {
            code: "INTERNAL_ERROR",
            message: "The operation could not be completed.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn crashed(trace_id: impl Into<String>) -> Self {
        Self {
            code: "BACKEND_CRASHED",
            message: "The packaged backend process exited unexpectedly.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn cancelled(trace_id: impl Into<String>) -> Self {
        Self {
            code: "TASK_CANCELLED",
            message: "The task was cancelled.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn timed_out(trace_id: impl Into<String>) -> Self {
        Self {
            code: "TASK_TIMED_OUT",
            message: "The task exceeded its configured deadline.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn interrupted(trace_id: impl Into<String>) -> Self {
        Self {
            code: "TASK_INTERRUPTED",
            message: "The task was interrupted by backend failure.".to_owned(),
            trace_id: trace_id.into(),
        }
    }

    pub fn busy(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "BACKEND_UNAVAILABLE",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn authorization(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "AUTHORIZATION_ERROR",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn version_mismatch(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "VERSION_MISMATCH",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn reference_not_found(message: impl Into<String>, trace_id: impl Into<String>) -> Self {
        Self {
            code: "REFERENCE_NOT_FOUND",
            message: message.into(),
            trace_id: trace_id.into(),
        }
    }

    pub fn picker_cancelled(trace_id: impl Into<String>) -> Self {
        Self {
            code: "PICKER_CANCELLED",
            message: "The file selection was cancelled.".to_owned(),
            trace_id: trace_id.into(),
        }
    }
}
