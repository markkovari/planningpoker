use serde::{Deserialize, Serialize};

/// Sensitive per-room Jira credentials stored separately from non-sensitive config.
#[derive(Clone, Serialize, Deserialize)]
pub struct JiraCredentials {
    pub email: String,
    pub api_token: String,
}

impl std::fmt::Debug for JiraCredentials {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("JiraCredentials")
            .field("email", &self.email)
            .field("api_token", &"[REDACTED]")
            .finish()
    }
}

/// Non-sensitive room Jira configuration — safe to log and serialize freely.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JiraRoomConfig {
    /// e.g. "https://myteam.atlassian.net"
    pub base_url: String,
    /// e.g. "PROJ"
    pub project_key: String,
    /// Story points custom field, typically "customfield_10016" for Jira Next-gen
    pub story_points_field: String,
}

/// Combined view used only within request handlers — never serialized to storage.
#[derive(Clone, Debug)]
pub struct JiraConfig {
    pub base_url: String,
    pub project_key: String,
    pub email: String,
    pub api_token: String,
    pub story_points_field: String,
}

impl JiraConfig {
    pub fn from_parts(config: JiraRoomConfig, creds: JiraCredentials) -> Self {
        Self {
            base_url: config.base_url,
            project_key: config.project_key,
            story_points_field: config.story_points_field,
            email: creds.email,
            api_token: creds.api_token,
        }
    }

    pub fn basic_auth_header(&self) -> String {
        use std::fmt::Write;
        let raw = format!("{}:{}", self.email, self.api_token);
        let mut encoded = String::new();
        let bytes = raw.as_bytes();
        let alphabet =
            b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut i = 0;
        while i < bytes.len() {
            let b0 = bytes[i] as u32;
            let b1 = if i + 1 < bytes.len() { bytes[i + 1] as u32 } else { 0 };
            let b2 = if i + 2 < bytes.len() { bytes[i + 2] as u32 } else { 0 };
            let triple = (b0 << 16) | (b1 << 8) | b2;
            write!(&mut encoded, "{}", alphabet[((triple >> 18) & 63) as usize] as char).ok();
            write!(&mut encoded, "{}", alphabet[((triple >> 12) & 63) as usize] as char).ok();
            if i + 1 < bytes.len() {
                write!(&mut encoded, "{}", alphabet[((triple >> 6) & 63) as usize] as char).ok();
            } else {
                encoded.push('=');
            }
            if i + 2 < bytes.len() {
                write!(&mut encoded, "{}", alphabet[(triple & 63) as usize] as char).ok();
            } else {
                encoded.push('=');
            }
            i += 3;
        }
        format!("Basic {encoded}")
    }
}
