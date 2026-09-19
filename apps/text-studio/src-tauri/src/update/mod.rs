pub mod manager;
pub mod models;

pub use manager::UpdateManager;
pub use models::*;

use crate::backend::{AppError, AppResult};
use std::str::FromStr;
use tauri::State;

#[tauri::command]
pub fn get_update_status(update_manager: State<'_, UpdateManager>) -> AppResult<UpdateStatus> {
    update_manager.get_status()
}

#[tauri::command]
pub fn set_update_channel(
    channel: String,
    update_manager: State<'_, UpdateManager>,
) -> AppResult<UpdateStatus> {
    let ch = UpdateChannel::from_str(&channel)
        .map_err(|e| AppError::validation(&e, "invalid-channel"))?;
    update_manager.set_channel(ch)
}

#[tauri::command]
pub fn check_for_updates(
    channel: Option<String>,
    update_manager: State<'_, UpdateManager>,
) -> AppResult<UpdateStatus> {
    if let Some(ch_str) = channel {
        let ch = UpdateChannel::from_str(&ch_str)
            .map_err(|e| AppError::validation(&e, "invalid-channel"))?;
        update_manager.set_channel(ch)?;
    }

    let current_channel = update_manager.get_channel();
    let sample_manifest = match current_channel {
        UpdateChannel::Stable => UpdateManifest {
            version: "0.2.0".to_string(),
            notes: "Prime Shell 0.2.0 release with production security and signed updates."
                .to_string(),
            pub_date: crate::diagnostics::manager::iso_now(),
            channel: UpdateChannel::Stable,
            platforms: {
                let mut map = std::collections::HashMap::new();
                map.insert(
                    "windows-x86_64".to_string(),
                    PlatformUpdate {
                        url: "https://staging-updates.primeshell.internal/releases/v0.2.0/prime-shell-setup-0.2.0.exe".to_string(),
                        signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdFNpZ25hdHVyZTFDdW11bGF0aXZlRWQyNTUxOVN0cmVhbVZlcmlmaWVyMDAwMDAwMDAwMDAwMDAwMA==".to_string(),
                        size_bytes: Some(15482910),
                        sha256: Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()),
                    },
                );
                map.insert(
                    "darwin-aarch64".to_string(),
                    PlatformUpdate {
                        url: "https://staging-updates.primeshell.internal/releases/v0.2.0/prime-shell-0.2.0.tar.gz".to_string(),
                        signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdFNpZ25hdHVyZTJNYWNPc0FybTY0VmVyaWZpZXJNb2R1bGUwMDAwMDAwMDAwMDAwMDAwMDAwMA==".to_string(),
                        size_bytes: Some(14298112),
                        sha256: Some("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb".to_string()),
                    },
                );
                map
            },
        },
        UpdateChannel::Beta => UpdateManifest {
            version: "0.3.0-beta.1".to_string(),
            notes: "Prime Shell 0.3.0-beta.1 preview release for beta testing.".to_string(),
            pub_date: crate::diagnostics::manager::iso_now(),
            channel: UpdateChannel::Beta,
            platforms: {
                let mut map = std::collections::HashMap::new();
                map.insert(
                    "windows-x86_64".to_string(),
                    PlatformUpdate {
                        url: "https://staging-updates.primeshell.internal/releases/v0.3.0-beta.1/prime-shell-setup-0.3.0-beta.1.exe".to_string(),
                        signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIG1pbmlzaWduIHNlY3JldCBrZXkKUlVTVGVzdEJldGFTaWduYXR1cmUxQ3VtdWxhdGl2ZUVkMjU1MTlTdHJlYW1WZXJpZmllcjAwMDAwMDAwMDAwMA==".to_string(),
                        size_bytes: Some(15510200),
                        sha256: Some("4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a".to_string()),
                    },
                );
                map
            },
        },
    };

    update_manager.process_manifest(&sample_manifest)
}
