use serde::{Deserialize, Serialize};
use tauri::{window::Color, AppHandle, Manager, Theme, Window};

use crate::backend::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialCapabilities {
    pub mica: bool,
    pub mica_alt: bool,
    pub transparency_enabled: bool,
    pub forced_colors: bool,
    pub reduced_transparency: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeStatePayload {
    pub system_theme: String,
    pub system_accent: Option<String>,
    pub material_capabilities: MaterialCapabilities,
}

fn hex_to_color(hex: &str) -> Option<Color> {
    let sanitized = hex.trim().trim_start_matches('#');
    if sanitized.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&sanitized[0..2], 16).ok()?;
    let g = u8::from_str_radix(&sanitized[2..4], 16).ok()?;
    let b = u8::from_str_radix(&sanitized[4..6], 16).ok()?;
    Some(Color(r, g, b, 255))
}

pub fn detect_platform_materials() -> MaterialCapabilities {
    #[cfg(target_os = "windows")]
    {
        // On Windows 11 (build 22000+), Mica materials are supported natively by DWM
        MaterialCapabilities {
            mica: true,
            mica_alt: true,
            transparency_enabled: true,
            forced_colors: false,
            reduced_transparency: false,
            reason: None,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        MaterialCapabilities {
            mica: false,
            mica_alt: false,
            transparency_enabled: false,
            forced_colors: false,
            reduced_transparency: false,
            reason: Some(
                "Mica materials are exclusively supported on Windows 11+ DWM surfaces.".to_string(),
            ),
        }
    }
}

pub fn apply_initial_window_theme(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_dark = window.theme().map(|t| t == Theme::Dark).unwrap_or(false);
        let bg_color = if is_dark {
            Color(31, 31, 31, 255) // #1F1F1F
        } else {
            Color(245, 245, 245, 255) // #F5F5F5
        };
        let _ = window.set_background_color(Some(bg_color));
    }
}

#[tauri::command]
pub fn get_theme_state(window: Window) -> AppResult<ThemeStatePayload> {
    let is_dark = window.theme().map(|t| t == Theme::Dark).unwrap_or(false);
    let system_theme = if is_dark { "dark" } else { "light" }.to_string();

    Ok(ThemeStatePayload {
        system_theme,
        system_accent: None,
        material_capabilities: detect_platform_materials(),
    })
}

#[tauri::command]
pub fn sync_native_window_theme(
    effective_theme: String,
    background_hex: String,
    window: Window,
) -> AppResult<()> {
    let trace = "sync-window-theme";
    let color = hex_to_color(&background_hex)
        .ok_or_else(|| AppError::validation("Invalid hex color for window background", trace))?;

    window
        .set_background_color(Some(color))
        .map_err(|e| AppError::internal(format!("{trace}: {e}")))?;

    let tauri_theme = match effective_theme.as_str() {
        "dark" => Some(Theme::Dark),
        "light" => Some(Theme::Light),
        _ => None,
    };

    if let Some(theme) = tauri_theme {
        let _ = window.set_theme(Some(theme));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_to_color_parses_valid_hex() {
        let dark_color = hex_to_color("#1F1F1F").unwrap();
        assert_eq!(dark_color.0, 31);
        assert_eq!(dark_color.1, 31);
        assert_eq!(dark_color.2, 31);
        assert_eq!(dark_color.3, 255);

        let light_color = hex_to_color("#F5F5F5").unwrap();
        assert_eq!(light_color.0, 245);
        assert_eq!(light_color.1, 245);
        assert_eq!(light_color.2, 245);
        assert_eq!(light_color.3, 255);
    }

    #[test]
    fn hex_to_color_rejects_invalid() {
        assert!(hex_to_color("xyz").is_none());
        assert!(hex_to_color("#12345").is_none());
        assert!(hex_to_color("").is_none());
    }
}
