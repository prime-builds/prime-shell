use super::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendOperation {
    SpikeEcho,
    SpikeCount,
    SpikeCrash,
    SpikeHang,
    SpikeLargeRejected,
    DocAnalyze,
}

impl BackendOperation {
    pub const fn name(self) -> &'static str {
        match self {
            Self::SpikeEcho => "spike.echo",
            Self::SpikeCount => "spike.count",
            Self::SpikeCrash => "spike.crash",
            Self::SpikeHang => "spike.hang",
            Self::SpikeLargeRejected => "spike.largeRejected",
            Self::DocAnalyze => "doc.analyze",
        }
    }

    pub const fn version(self) -> u32 {
        1
    }

    pub const fn max_payload_bytes(self) -> usize {
        match self {
            Self::SpikeEcho => 262_144,
            Self::SpikeCount => 1024,
            Self::SpikeCrash => 1024,
            Self::SpikeHang => 1024,
            Self::SpikeLargeRejected => 1024 * 1024,
            Self::DocAnalyze => 10 * 1024 * 1024,
        }
    }

    pub const fn timeout_ms(self) -> u64 {
        match self {
            Self::SpikeEcho => 5_000,
            Self::SpikeCount => 60_000,
            Self::SpikeCrash => 5_000,
            Self::SpikeHang => 5_000,
            Self::SpikeLargeRejected => 5_000,
            Self::DocAnalyze => 60_000,
        }
    }

    pub const fn cancellable(self) -> bool {
        match self {
            Self::SpikeCount | Self::DocAnalyze => true,
            _ => false,
        }
    }

    pub const fn idempotent(self) -> bool {
        match self {
            Self::SpikeEcho | Self::DocAnalyze => true,
            _ => false,
        }
    }

    pub const fn destination(self) -> &'static str {
        "python-sidecar"
    }

    pub fn authorize(name: &str, trace_id: &str) -> AppResult<Self> {
        match name {
            "spike.echo" => Ok(Self::SpikeEcho),
            "spike.count" => Ok(Self::SpikeCount),
            "spike.crash" => Ok(Self::SpikeCrash),
            "spike.hang" => Ok(Self::SpikeHang),
            "spike.largeRejected" => Ok(Self::SpikeLargeRejected),
            "doc.analyze" => Ok(Self::DocAnalyze),
            _ => Err(AppError::authorization(
                "The requested operation is not authorized.",
                trace_id,
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::BackendOperation;

    #[test]
    fn unknown_operation_is_rejected_before_backend() {
        let error = BackendOperation::authorize("spike.future", "trace-registry")
            .expect_err("unknown operation must fail");
        assert_eq!(error.code, "AUTHORIZATION_ERROR");
    }

    #[test]
    fn all_six_operations_are_authorized() {
        for name in [
            "spike.echo",
            "spike.count",
            "spike.crash",
            "spike.hang",
            "spike.largeRejected",
            "doc.analyze",
        ] {
            let op = BackendOperation::authorize(name, "trace-registry")
                .expect("operation must be authorized");
            assert_eq!(op.name(), name);
        }
    }

    #[test]
    fn shared_unknown_operation_fixture_is_rejected() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../../../../packages/app-contracts/fixtures/invalid/unknown-operation.json"
        ))
        .expect("fixture must be valid JSON");
        let operation = fixture["operation"]
            .as_str()
            .expect("fixture operation must be a string");
        assert!(BackendOperation::authorize(operation, "fixture-trace").is_err());
    }
}
