pub mod config;
pub mod models;

pub use config::{JiraConfig, JiraCredentials, JiraRoomConfig};
pub use models::{CachedJiraTicket, JiraIssue, JiraSearchResult, StoryPointsUpdate};

/// Build the JQL query for fetching unestimated stories.
pub fn unestimated_jql(project_key: &str, story_points_field: &str) -> String {
    format!(
        r#"project = "{}" AND "{}" is EMPTY AND issuetype = Story ORDER BY created DESC"#,
        project_key, story_points_field
    )
}

/// Parse a story points value from the final_estimate string.
/// Returns None for non-numeric values (e.g. "?", "☕").
pub fn parse_story_points(estimate: &str) -> Option<f64> {
    estimate.parse::<f64>().ok()
}

/// Map T-shirt size to numeric story points using the default mapping.
pub fn tshirt_to_points(card: &str) -> Option<f64> {
    match card {
        "XS" => Some(1.0),
        "S" => Some(2.0),
        "M" => Some(3.0),
        "L" => Some(5.0),
        "XL" => Some(8.0),
        "XXL" => Some(13.0),
        _ => None,
    }
}

/// Resolve any estimate string to a story points value.
pub fn estimate_to_points(estimate: &str) -> Option<f64> {
    parse_story_points(estimate).or_else(|| tshirt_to_points(estimate))
}
