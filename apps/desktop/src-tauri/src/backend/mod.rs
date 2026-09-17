mod client;
mod error;
pub mod protocol;
mod registry;

pub use client::{BackendClient, LaunchSpec};
pub use error::{AppError, AppResult};
pub use protocol::{BackendStatus, EchoResponse};
pub use registry::BackendOperation;
