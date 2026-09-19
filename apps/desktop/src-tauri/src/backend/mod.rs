mod client;
mod error;
pub mod protocol;
pub mod references;
mod registry;

pub use client::{BackendClient, LaunchSpec};
pub use error::{AppError, AppResult};
pub use protocol::{BackendStatus, EchoResponse};
pub use references::{
    pick_document_dialog, save_document_dialog, ArtifactRef, DocumentRef, ReferenceRegistry,
};
pub use registry::BackendOperation;

