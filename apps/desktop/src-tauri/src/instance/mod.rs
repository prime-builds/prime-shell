use crate::backend::{DocumentRef, ReferenceRegistry};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

pub const MAX_LAUNCH_ARGUMENTS: usize = 16;
pub const MAX_LAUNCH_ARGV_BYTES: usize = 1024;
pub const MAX_PATH_LENGTH: usize = 260;

#[derive(Debug, Clone, PartialEq)]
pub enum ParsedLaunchIntent {
    Focus,
    OpenDocument(PathBuf),
    Rejected(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LaunchIntentPayload {
    Focus,
    OpenDocument { document: DocumentRef },
}

pub fn parse_launch_args(argv: &[String]) -> ParsedLaunchIntent {
    if argv.is_empty() {
        return ParsedLaunchIntent::Focus;
    }

    if argv.len() > MAX_LAUNCH_ARGUMENTS {
        return ParsedLaunchIntent::Rejected("Argument count exceeds bound (max 16)".to_string());
    }

    let total_bytes: usize = argv.iter().map(|a| a.len()).sum();
    if total_bytes > MAX_LAUNCH_ARGV_BYTES {
        return ParsedLaunchIntent::Rejected(
            "Total argument bytes exceed bound (max 1024)".to_string(),
        );
    }

    // Skip executable path (argv[0]) if present
    let args: Vec<&str> = if argv.len() > 1 {
        argv[1..].iter().map(|s| s.as_str()).collect()
    } else {
        vec![]
    };

    if args.is_empty() || args == ["--focus"] {
        return ParsedLaunchIntent::Focus;
    }

    // Check for --open <path> or --open=<path>
    let mut open_target: Option<&str> = None;
    let mut iter = args.iter().peekable();
    while let Some(&arg) = iter.next() {
        if arg == "--open" {
            if let Some(&path_arg) = iter.next() {
                open_target = Some(path_arg);
            } else {
                return ParsedLaunchIntent::Rejected(
                    "--open requires a file path argument".to_string(),
                );
            }
        } else if let Some(path_arg) = arg.strip_prefix("--open=") {
            open_target = Some(path_arg);
        } else if arg.starts_with('-') {
            // Unknown flag fails safely into Focus intent without executing arbitrary commands
            return ParsedLaunchIntent::Focus;
        } else if open_target.is_none() && arg.ends_with(".txt") {
            // Positional text file argument
            open_target = Some(arg);
        }
    }

    if let Some(target) = open_target {
        if target.len() > MAX_PATH_LENGTH {
            return ParsedLaunchIntent::Rejected(
                "File path exceeds maximum length (260)".to_string(),
            );
        }
        let path = PathBuf::from(target);
        if path.is_file() {
            ParsedLaunchIntent::OpenDocument(path)
        } else {
            ParsedLaunchIntent::Rejected("Target is not an existing file".to_string())
        }
    } else {
        ParsedLaunchIntent::Focus
    }
}

pub fn focus_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn handle_secondary_launch(app: &AppHandle, argv: Vec<String>) {
    focus_main_window(app);

    let intent = parse_launch_args(&argv);
    match intent {
        ParsedLaunchIntent::OpenDocument(path) => {
            let trace_id = format!("secondary-open-{}", std::process::id());
            if let Some(registry) = app.try_state::<ReferenceRegistry>() {
                if let Ok(doc_ref) = registry.register_document(&path, &trace_id) {
                    let _ = app.emit(
                        "launch-intent",
                        LaunchIntentPayload::OpenDocument { document: doc_ref },
                    );
                    return;
                }
            }
            let _ = app.emit("launch-intent", LaunchIntentPayload::Focus);
        }
        ParsedLaunchIntent::Focus | ParsedLaunchIntent::Rejected(_) => {
            let _ = app.emit("launch-intent", LaunchIntentPayload::Focus);
        }
    }
}

pub fn init_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_single_instance::init(|app, argv, _cwd| {
        handle_secondary_launch(app, argv);
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_args_defaults_to_focus() {
        let argv: Vec<String> = vec![];
        assert_eq!(parse_launch_args(&argv), ParsedLaunchIntent::Focus);

        let argv2: Vec<String> = vec!["prime-shell.exe".to_string()];
        assert_eq!(parse_launch_args(&argv2), ParsedLaunchIntent::Focus);

        let argv3: Vec<String> = vec!["prime-shell.exe".to_string(), "--focus".to_string()];
        assert_eq!(parse_launch_args(&argv3), ParsedLaunchIntent::Focus);
    }

    #[test]
    fn test_parse_oversized_args_rejected() {
        let argv: Vec<String> = (0..20).map(|i| format!("arg{i}")).collect();
        match parse_launch_args(&argv) {
            ParsedLaunchIntent::Rejected(msg) => {
                assert!(msg.contains("Argument count exceeds bound"))
            }
            _ => panic!("Expected rejection"),
        }

        let long_arg = "a".repeat(1100);
        let argv2 = vec!["prime-shell.exe".to_string(), long_arg];
        match parse_launch_args(&argv2) {
            ParsedLaunchIntent::Rejected(msg) => {
                assert!(msg.contains("Total argument bytes exceed bound"))
            }
            _ => panic!("Expected rejection"),
        }
    }

    #[test]
    fn test_parse_open_document_intent() {
        let temp_file =
            std::env::temp_dir().join(format!("test-launch-{}.txt", std::process::id()));
        std::fs::write(&temp_file, "sample content").unwrap();

        let argv = vec![
            "prime-shell.exe".to_string(),
            "--open".to_string(),
            temp_file.to_string_lossy().to_string(),
        ];
        assert_eq!(
            parse_launch_args(&argv),
            ParsedLaunchIntent::OpenDocument(temp_file.clone())
        );

        let argv_eq = vec![
            "prime-shell.exe".to_string(),
            format!("--open={}", temp_file.to_string_lossy()),
        ];
        assert_eq!(
            parse_launch_args(&argv_eq),
            ParsedLaunchIntent::OpenDocument(temp_file.clone())
        );

        let argv_pos = vec![
            "prime-shell.exe".to_string(),
            temp_file.to_string_lossy().to_string(),
        ];
        assert_eq!(
            parse_launch_args(&argv_pos),
            ParsedLaunchIntent::OpenDocument(temp_file.clone())
        );

        let _ = std::fs::remove_file(&temp_file);
    }

    #[test]
    fn test_parse_unknown_flag_safely_falls_back_to_focus() {
        let argv = vec![
            "prime-shell.exe".to_string(),
            "--unknown-dangerous-flag".to_string(),
        ];
        assert_eq!(parse_launch_args(&argv), ParsedLaunchIntent::Focus);
    }
}
