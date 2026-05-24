use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JiraConfig {
    /// e.g. "https://myteam.atlassian.net"
    pub base_url: String,
    /// e.g. "PROJ"
    pub project_key: String,
    /// Jira account email
    pub email: String,
    /// Jira API token (generated at id.atlassian.com/manage-profile/security/api-tokens)
    pub api_token: String,
    /// Story points custom field, typically "customfield_10016" for Jira Next-gen
    pub story_points_field: String,
}

impl JiraConfig {
    pub fn basic_auth_header(&self) -> String {
        use std::fmt::Write;
        let raw = format!("{}:{}", self.email, self.api_token);
        // base64 encode using only std — avoids pulling in a dep for WASM compat
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
