use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JiraIssue {
    pub key: String,
    pub fields: JiraFields,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JiraFields {
    pub summary: String,
    pub description: Option<JiraDescription>,
    /// Story points — field name varies per Jira instance (see JiraConfig::story_points_field)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub story_points: Option<f64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(untagged)]
pub enum JiraDescription {
    /// Jira Cloud uses Atlassian Document Format (nested JSON)
    Adf { content: serde_json::Value },
    /// Server / older instances use a plain string
    Plain(String),
}

impl JiraDescription {
    pub fn as_text(&self) -> Option<String> {
        match self {
            JiraDescription::Plain(s) => Some(s.clone()),
            JiraDescription::Adf { content } => {
                // Best-effort: extract first paragraph text from ADF
                extract_adf_text(content)
            }
        }
    }
}

fn extract_adf_text(value: &serde_json::Value) -> Option<String> {
    if let Some(text) = value.get("text").and_then(|v| v.as_str()) {
        return Some(text.to_string());
    }
    if let Some(content) = value.get("content").and_then(|v| v.as_array()) {
        let parts: Vec<String> = content.iter().filter_map(extract_adf_text).collect();
        if !parts.is_empty() {
            return Some(parts.join(" "));
        }
    }
    None
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JiraSearchResult {
    pub issues: Vec<JiraIssue>,
    pub total: u32,
}

/// Payload for PUT /rest/api/3/issue/{key} to set story points.
#[derive(Debug, Serialize)]
pub struct StoryPointsUpdate {
    pub fields: serde_json::Value,
}

impl StoryPointsUpdate {
    pub fn new(story_points_field: &str, value: f64) -> Self {
        Self {
            fields: serde_json::json!({ story_points_field: value }),
        }
    }
}

/// Cached Jira ticket record stored in D1.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CachedJiraTicket {
    pub issue_key: String,
    pub project_key: String,
    pub summary: String,
    pub description: Option<String>,
    pub story_points: Option<f64>,
    pub fetched_at: u64,
}
