mod client;
pub mod containment;
mod error;
pub mod protocol;
pub mod references;
mod registry;
pub mod tasks;

pub use client::{BackendClient, LaunchSpec};
pub use containment::ProcessContainment;
pub use error::{AppError, AppResult};
pub use protocol::{
    BackendStatus, DocAnalyzePayload, DocAnalyzeResultPayload, DocumentAnalysisMetrics,
    EchoResponse, KeywordMatchItem, TermFrequencyItem,
};
pub use references::{
    pick_document_dialog, save_document_dialog, ArtifactRef, DocumentRef, ReferenceRegistry,
};
pub use registry::BackendOperation;
pub use tasks::{TaskSnapshot, TaskStore};

