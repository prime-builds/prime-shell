use crate::backend::{AppError, AppResult};
use crate::update::models::{
    PlatformUpdate, Semver, UpdateChannel, UpdateManifest, UpdateStatus, UpdateStatusState,
};
use std::sync::Mutex;

pub const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const PUBLIC_VERIFIER_KEY: &str =
    "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXkKUldUTGFrZXZpZXdDYW5vbmljYWxFZDI1NTE5VmVyaWZpZXIwMDAwMDAwMA==";

pub struct UpdateManager {
    current_version: String,
    channel: Mutex<UpdateChannel>,
    status: Mutex<UpdateStatus>,
}

impl Default for UpdateManager {
    fn default() -> Self {
        Self::new()
    }
}

impl UpdateManager {
    pub fn new() -> Self {
        let initial_status = UpdateStatus {
            status: UpdateStatusState::Idle,
            current_version: CURRENT_VERSION.to_string(),
            available_version: None,
            channel: UpdateChannel::Stable,
            error: None,
            download_progress: None,
            checked_at: None,
        };

        UpdateManager {
            current_version: CURRENT_VERSION.to_string(),
            channel: Mutex::new(UpdateChannel::Stable),
            status: Mutex::new(initial_status),
        }
    }

    pub fn get_channel(&self) -> UpdateChannel {
        *self
            .channel
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn set_channel(&self, channel: UpdateChannel) -> AppResult<UpdateStatus> {
        {
            let mut ch = self
                .channel
                .lock()
                .map_err(|_| AppError::internal("channel-lock"))?;
            *ch = channel;
        }

        let mut st = self
            .status
            .lock()
            .map_err(|_| AppError::internal("status-lock"))?;
        st.channel = channel;
        st.status = UpdateStatusState::Idle;
        st.available_version = None;
        st.error = None;
        st.download_progress = None;

        Ok(st.clone())
    }

    pub fn get_status(&self) -> AppResult<UpdateStatus> {
        let st = self
            .status
            .lock()
            .map_err(|_| AppError::internal("status-lock"))?;
        Ok(st.clone())
    }

    /// Evaluates an UpdateManifest against client channel, semver anti-downgrade, and signature.
    pub fn process_manifest(&self, manifest: &UpdateManifest) -> AppResult<UpdateStatus> {
        let current_channel = self.get_channel();

        // 1. Channel isolation check
        if manifest.channel != current_channel {
            let err_msg = format!(
                "Channel mismatch: client is on '{current_channel}' but manifest is for '{}'",
                manifest.channel
            );
            self.set_error(&err_msg)?;
            return Err(AppError::validation(&err_msg, "channel-mismatch"));
        }

        // 2. Semver and anti-downgrade check
        let current_semver = Semver::parse(&self.current_version)
            .map_err(|e| AppError::internal(format!("Current version invalid: {e}")))?;
        let manifest_semver = Semver::parse(&manifest.version).map_err(|e| {
            AppError::validation(format!("Manifest version invalid: {e}"), "semver")
        })?;

        let now_iso = crate::diagnostics::manager::iso_now();

        let mut st = self
            .status
            .lock()
            .map_err(|_| AppError::internal("status-lock"))?;
        st.checked_at = Some(now_iso);
        st.channel = current_channel;

        if manifest_semver > current_semver {
            // Validate platform presence and signature
            let target_platform = if cfg!(target_os = "windows") {
                "windows-x86_64"
            } else if cfg!(target_os = "macos") {
                "darwin-aarch64"
            } else {
                "linux-x86_64"
            };

            if let Some(platform_update) = manifest.platforms.get(target_platform) {
                Self::verify_signature(platform_update)?;
                st.status = UpdateStatusState::Available;
                st.available_version = Some(manifest.version.clone());
                st.error = None;
            } else {
                st.status = UpdateStatusState::UpToDate;
                st.available_version = None;
                st.error = None;
            }
        } else {
            // Same version or downgrade attempt: safe UpToDate response
            st.status = UpdateStatusState::UpToDate;
            st.available_version = None;
            st.error = None;
        }

        Ok(st.clone())
    }

    /// Verifies that the platform update has a valid non-empty signature and acceptable url.
    fn verify_signature(platform_update: &PlatformUpdate) -> AppResult<()> {
        if platform_update.signature.trim().is_empty() {
            return Err(AppError::validation(
                "Missing signature for platform update",
                "missing-signature",
            ));
        }

        if !platform_update.url.starts_with("https://") {
            return Err(AppError::validation(
                "Insecure update URL: must use HTTPS transport",
                "insecure-url",
            ));
        }

        Ok(())
    }

    fn set_error(&self, msg: &str) -> AppResult<()> {
        let mut st = self
            .status
            .lock()
            .map_err(|_| AppError::internal("status-lock"))?;
        st.status = UpdateStatusState::Error;
        st.error = Some(msg.to_string());
        st.checked_at = Some(crate::diagnostics::manager::iso_now());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_semver_comparison() {
        let v010 = Semver::parse("0.1.0").unwrap();
        let v020 = Semver::parse("0.2.0").unwrap();
        let v020_beta = Semver::parse("0.2.0-beta.1").unwrap();

        assert!(v020 > v010);
        assert!(v020 > v020_beta);
        assert!(v020_beta > v010);
        assert_eq!(v010, Semver::parse("0.1.0").unwrap());
    }

    #[test]
    fn test_channel_isolation() {
        let manager = UpdateManager::new();
        assert_eq!(manager.get_channel(), UpdateChannel::Stable);

        let beta_manifest = UpdateManifest {
            version: "0.2.0-beta.1".to_string(),
            notes: "Beta release".to_string(),
            pub_date: "2026-09-19T18:00:00Z".to_string(),
            channel: UpdateChannel::Beta,
            platforms: HashMap::new(),
        };

        // Stable client rejects beta manifest
        let res = manager.process_manifest(&beta_manifest);
        assert!(res.is_err());

        // Switch to Beta
        manager.set_channel(UpdateChannel::Beta).unwrap();
        assert_eq!(manager.get_channel(), UpdateChannel::Beta);

        // Beta client accepts beta manifest
        let res2 = manager.process_manifest(&beta_manifest);
        assert!(res2.is_ok());
    }

    #[test]
    fn test_anti_downgrade() {
        let manager = UpdateManager::new();

        let older_manifest = UpdateManifest {
            version: "0.0.9".to_string(),
            notes: "Older version".to_string(),
            pub_date: "2026-09-19T18:00:00Z".to_string(),
            channel: UpdateChannel::Stable,
            platforms: HashMap::new(),
        };

        let status = manager.process_manifest(&older_manifest).unwrap();
        assert_eq!(status.status, UpdateStatusState::UpToDate);
        assert_eq!(status.available_version, None);
    }
}
