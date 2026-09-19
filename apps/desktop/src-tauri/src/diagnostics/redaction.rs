pub const MAX_MESSAGE_LEN: usize = 256;
pub const MAX_HINT_LEN: usize = 256;
pub const MAX_DETAIL_STR_LEN: usize = 64;

/// Redact paths, secrets, and enforce length bounds on a message string.
pub fn redact_text(input: &str) -> String {
    let mut result = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;

    while i < len {
        // 1. Check for file URI: file://
        if i + 7 <= len
            && chars[i..i + 7]
                .iter()
                .collect::<String>()
                .eq_ignore_ascii_case("file://")
        {
            result.push_str("[REDACTED_PATH]");
            i += 7;
            while i < len
                && !chars[i].is_whitespace()
                && chars[i] != '"'
                && chars[i] != '\''
                && chars[i] != ')'
            {
                i += 1;
            }
            continue;
        }

        // 2. Check for Windows Drive Path: [A-Za-z]:\ or [A-Za-z]:/
        if i + 3 <= len
            && chars[i].is_ascii_alphabetic()
            && chars[i + 1] == ':'
            && (chars[i + 2] == '\\' || chars[i + 2] == '/')
        {
            result.push_str("[REDACTED_PATH]");
            i += 3;
            while i < len
                && !chars[i].is_whitespace()
                && chars[i] != '"'
                && chars[i] != '\''
                && chars[i] != ')'
            {
                i += 1;
            }
            continue;
        }

        // 3. Check for Unix standard paths: /home/, /Users/, /usr/, /etc/, /var/, /tmp/, /private/
        let unix_prefixes = [
            "/home/",
            "/users/",
            "/usr/",
            "/etc/",
            "/var/",
            "/tmp/",
            "/private/",
        ];
        let mut matched_prefix_len = 0;
        for prefix in &unix_prefixes {
            let p_len = prefix.len();
            if i + p_len <= len
                && chars[i..i + p_len]
                    .iter()
                    .collect::<String>()
                    .to_ascii_lowercase()
                    == *prefix
            {
                matched_prefix_len = p_len;
                break;
            }
        }
        if matched_prefix_len > 0 {
            result.push_str("[REDACTED_PATH]");
            i += matched_prefix_len;
            while i < len
                && !chars[i].is_whitespace()
                && chars[i] != '"'
                && chars[i] != '\''
                && chars[i] != ')'
            {
                i += 1;
            }
            continue;
        }

        // 4. Check for Bearer token: "bearer "
        if i + 7 <= len
            && chars[i..i + 7]
                .iter()
                .collect::<String>()
                .eq_ignore_ascii_case("bearer ")
        {
            result.push_str("Bearer [REDACTED_TOKEN]");
            i += 7;
            while i < len && !chars[i].is_whitespace() && chars[i] != '"' && chars[i] != '\'' {
                i += 1;
            }
            continue;
        }

        // 5. Check for secrets/passwords/tokens/api_keys
        let secret_keywords = [
            "password=",
            "password:",
            "password = ",
            "password : ",
            "secret=",
            "secret:",
            "secret = ",
            "secret : ",
            "token=",
            "token:",
            "token = ",
            "token : ",
            "api_key=",
            "api_key:",
            "api_key = ",
            "api_key : ",
            "apikey=",
            "apikey:",
            "apikey = ",
            "apikey : ",
        ];
        let mut matched_secret_len = 0;
        let mut keyword_name = "";
        for kw in &secret_keywords {
            let kw_len = kw.len();
            if i + kw_len <= len
                && chars[i..i + kw_len]
                    .iter()
                    .collect::<String>()
                    .to_ascii_lowercase()
                    == *kw
            {
                matched_secret_len = kw_len;
                keyword_name = kw;
                break;
            }
        }
        if matched_secret_len > 0 {
            result.push_str(keyword_name);
            result.push_str("[REDACTED_SECRET]");
            i += matched_secret_len;
            // skip spaces and opening quotes
            while i < len
                && (chars[i] == ' ' || chars[i] == '\t' || chars[i] == '"' || chars[i] == '\'')
            {
                i += 1;
            }
            // skip the actual secret token
            while i < len
                && !chars[i].is_whitespace()
                && chars[i] != '"'
                && chars[i] != '\''
                && chars[i] != ','
                && chars[i] != '}'
            {
                i += 1;
            }
            continue;
        }

        // 6. Check for JWT token pattern: "ey" + base64 + "." + base64
        if i + 30 <= len && chars[i] == 'e' && chars[i + 1] == 'y' {
            let slice: String = chars[i..i + 30].iter().collect();
            if slice.contains('.') {
                result.push_str("[REDACTED_TOKEN]");
                while i < len
                    && (chars[i].is_ascii_alphanumeric()
                        || chars[i] == '_'
                        || chars[i] == '-'
                        || chars[i] == '.')
                {
                    i += 1;
                }
                continue;
            }
        }

        result.push(chars[i]);
        i += 1;
    }

    truncate_string(&result, MAX_MESSAGE_LEN)
}

/// Helper to truncate a string to `max_chars` preserving valid UTF-8 boundaries.
pub fn truncate_string(input: &str, max_chars: usize) -> String {
    let char_count = input.chars().count();
    if char_count <= max_chars {
        input.to_string()
    } else {
        input.chars().take(max_chars).collect()
    }
}

/// Verify that text contains zero unredacted native paths, file URIs, or plain credentials.
pub fn verify_no_leaks(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();

    // Check Windows Drive Path
    for i in 0..len.saturating_sub(2) {
        if chars[i].is_ascii_alphabetic()
            && chars[i + 1] == ':'
            && (chars[i + 2] == '\\' || chars[i + 2] == '/')
        {
            return false;
        }
    }

    // Check Unix paths
    let forbidden_unix = ["/home/", "/users/", "/usr/", "/etc/", "/var/", "/tmp/"];
    for p in &forbidden_unix {
        if lower.contains(p) {
            return false;
        }
    }

    // Check File URI
    if lower.contains("file://") {
        return false;
    }

    // Check secret labels
    let forbidden_secrets = ["bearer ", "password=", "password:", "api_key=", "apikey="];
    for s in &forbidden_secrets {
        if lower.contains(s) {
            // If it contains the keyword, check if the value is redacted
            if !lower.contains("[redacted_") {
                return false;
            }
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redaction_windows_path() {
        let input = "Error opening file C:\\Users\\Alice\\secret.txt on disk";
        let redacted = redact_text(input);
        assert_eq!(redacted, "Error opening file [REDACTED_PATH] on disk");
        assert!(verify_no_leaks(&redacted));
    }

    #[test]
    fn test_redaction_unix_path() {
        let input = "Failed to load /home/bob/.config/prime.json";
        let redacted = redact_text(input);
        assert_eq!(redacted, "Failed to load [REDACTED_PATH]");
        assert!(verify_no_leaks(&redacted));
    }

    #[test]
    fn test_redaction_secret() {
        let input = "Authentication token: secret12345 in request";
        let redacted = redact_text(input);
        assert!(redacted.contains("[REDACTED_SECRET]"));
        assert!(!redacted.contains("secret12345"));
    }

    #[test]
    fn test_redaction_truncation() {
        let long_str = "a".repeat(500);
        let redacted = redact_text(&long_str);
        assert_eq!(redacted.chars().count(), MAX_MESSAGE_LEN);
    }
}
