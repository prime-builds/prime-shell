use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateChannel {
    Stable,
    Beta,
}

impl std::fmt::Display for UpdateChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateChannel::Stable => write!(f, "stable"),
            UpdateChannel::Beta => write!(f, "beta"),
        }
    }
}

impl std::str::FromStr for UpdateChannel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "stable" => Ok(UpdateChannel::Stable),
            "beta" => Ok(UpdateChannel::Beta),
            other => Err(format!(
                "Invalid update channel '{other}'. Expected 'stable' or 'beta'."
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateStatusState {
    Idle,
    Checking,
    Available,
    UpToDate,
    Downloading,
    Downloaded,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformUpdate {
    pub url: String,
    pub signature: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sha256: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateManifest {
    pub version: String,
    pub notes: String,
    pub pub_date: String,
    pub channel: UpdateChannel,
    pub platforms: HashMap<String, PlatformUpdate>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub status: UpdateStatusState,
    pub current_version: String,
    pub available_version: Option<String>,
    pub channel: UpdateChannel,
    pub error: Option<String>,
    pub download_progress: Option<f64>,
    pub checked_at: Option<String>,
}

/// A lightweight semantic version parser and comparator.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Semver {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    pub pre_release: Option<String>,
}

impl Semver {
    pub fn parse(s: &str) -> Result<Self, String> {
        let (version_core, pre) = match s.split_once('-') {
            Some((core, pre)) => (core, Some(pre.to_string())),
            None => (s, None),
        };

        let parts: Vec<&str> = version_core.split('.').collect();
        if parts.len() != 3 {
            return Err(format!("Invalid semver '{s}': expected major.minor.patch"));
        }

        let major = parts[0]
            .parse::<u64>()
            .map_err(|e| format!("Invalid semver major in '{s}': {e}"))?;
        let minor = parts[1]
            .parse::<u64>()
            .map_err(|e| format!("Invalid semver minor in '{s}': {e}"))?;
        let patch = parts[2]
            .parse::<u64>()
            .map_err(|e| format!("Invalid semver patch in '{s}': {e}"))?;

        Ok(Semver {
            major,
            minor,
            patch,
            pre_release: pre,
        })
    }
}

impl PartialOrd for Semver {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for Semver {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        match self.major.cmp(&other.major) {
            std::cmp::Ordering::Equal => match self.minor.cmp(&other.minor) {
                std::cmp::Ordering::Equal => match self.patch.cmp(&other.patch) {
                    std::cmp::Ordering::Equal => match (&self.pre_release, &other.pre_release) {
                        (None, None) => std::cmp::Ordering::Equal,
                        (Some(_), None) => std::cmp::Ordering::Less,
                        (None, Some(_)) => std::cmp::Ordering::Greater,
                        (Some(a), Some(b)) => a.cmp(b),
                    },
                    ord => ord,
                },
                ord => ord,
            },
            ord => ord,
        }
    }
}
