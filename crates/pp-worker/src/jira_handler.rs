use pp_jira::{
    config::JiraConfig, models::JiraSearchResult, models::StoryPointsUpdate, unestimated_jql,
};
use wasm_bindgen::JsValue;
use worker::{Fetch, Headers, Method, Request, RequestInit, Result};

/// Fetch unestimated stories from Jira REST API v3.
/// Returns a list of (issue_key, summary, description_text).
pub async fn fetch_unestimated(
    config: &JiraConfig,
) -> Result<Vec<(String, String, Option<String>)>> {
    let jql = unestimated_jql(&config.project_key, &config.story_points_field);
    let url = format!(
        "{}/rest/api/3/search?jql={}&fields=summary,description,{}&maxResults=100",
        config.base_url,
        urlenccode(&jql),
        config.story_points_field,
    );

    let headers = Headers::new();
    headers.set("Authorization", &config.basic_auth_header())?;
    headers.set("Accept", "application/json")?;

    let mut init = RequestInit::new();
    init.with_method(Method::Get).with_headers(headers);

    let req = Request::new_with_init(&url, &init)?;
    let mut resp = Fetch::Request(req).send().await?;

    if resp.status_code() != 200 {
        return Err(worker::Error::RustError(format!(
            "Jira search returned {}",
            resp.status_code()
        )));
    }

    let result: JiraSearchResult = resp.json().await?;
    let tickets = result
        .issues
        .into_iter()
        .map(|issue| {
            let desc = issue.fields.description.as_ref().and_then(|d| d.as_text());
            (issue.key, issue.fields.summary, desc)
        })
        .collect();

    Ok(tickets)
}

/// Push story points to a Jira issue via REST API v3.
pub async fn push_story_points(
    config: &JiraConfig,
    issue_key: &str,
    story_points: f64,
) -> Result<()> {
    let url = format!("{}/rest/api/3/issue/{}", config.base_url, issue_key);
    let body = StoryPointsUpdate::new(&config.story_points_field, story_points);
    let body_str =
        serde_json::to_string(&body).map_err(|e| worker::Error::RustError(e.to_string()))?;

    let headers = Headers::new();
    headers.set("Authorization", &config.basic_auth_header())?;
    headers.set("Content-Type", "application/json")?;

    let mut init = RequestInit::new();
    init.with_method(Method::Put)
        .with_headers(headers)
        .with_body(Some(JsValue::from_str(&body_str)));

    let req = Request::new_with_init(&url, &init)?;
    let resp = Fetch::Request(req).send().await?;

    let status = resp.status_code();
    if status != 204 && status != 200 {
        return Err(worker::Error::RustError(format!(
            "Jira PUT /issue/{} returned {}",
            issue_key, status
        )));
    }

    Ok(())
}

fn urlenccode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                out.push('%');
                out.push(
                    char::from_digit((b >> 4) as u32, 16)
                        .unwrap_or('0')
                        .to_ascii_uppercase(),
                );
                out.push(
                    char::from_digit((b & 0xf) as u32, 16)
                        .unwrap_or('0')
                        .to_ascii_uppercase(),
                );
            }
        }
    }
    out
}
