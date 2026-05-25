mod event_store;
mod jira_handler;
mod room_object;
mod ws;

pub use room_object::RoomObject;

use pp_jira::{config::JiraConfig, models::CachedJiraTicket};
use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

fn jsv(s: &str) -> JsValue {
    JsValue::from_str(s)
}

fn jsf(f: f64) -> JsValue {
    JsValue::from_f64(f)
}

fn jsnull() -> JsValue {
    JsValue::NULL
}

#[event(fetch)]
async fn main_fetch(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    if let Ok(limiter) = env.rate_limiter("RATE_LIMITER") {
        let ip = req
            .headers()
            .get("CF-Connecting-IP")?
            .unwrap_or_else(|| "unknown".to_string());
        let outcome = limiter.limit(ip).await?;
        if !outcome.success {
            return Response::error("Too Many Requests", 429);
        }
    }

    let url = req.url()?;
    let path = url.path();

    if path == "/ws" {
        return route_to_room_do(req, env).await;
    }

    match (req.method(), path) {
        (Method::Post, "/api/rooms") => create_room(req, env).await,
        (Method::Get, p) if p.starts_with("/api/rooms/") && p.ends_with("/jira-tickets") => {
            let room_id = p
                .strip_prefix("/api/rooms/")
                .and_then(|s| s.strip_suffix("/jira-tickets"))
                .unwrap_or("");
            get_jira_tickets(env, room_id).await
        }
        _ => {
            // Static assets are served by the [assets] config in wrangler.toml.
            // Wrangler 4 routes unmatched requests to the asset directory automatically,
            // so this arm is only reached during local dev fallback.
            Response::error("not found", 404)
        }
    }
}

#[event(scheduled)]
async fn scheduled(_event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    if let Err(e) = cleanup_expired_data(&env).await {
        console_error!("Cleanup failed: {e}");
    }
    if let Err(e) = run_jira_sync(env).await {
        console_error!("Jira cron failed: {e}");
    }
}

async fn cleanup_expired_data(env: &Env) -> Result<()> {
    let db = env.d1("DB")?;
    let now = js_sys::Date::now();
    db.prepare(
        "DELETE FROM events WHERE room_id IN (SELECT room_id FROM rooms WHERE expires_at < ?1)",
    )
    .bind(&[jsf(now)])?
    .run()
    .await?;
    db.prepare(
        "DELETE FROM completed_sessions WHERE room_id IN (SELECT room_id FROM rooms WHERE expires_at < ?1)",
    )
    .bind(&[jsf(now)])?
    .run()
    .await?;
    db.prepare("DELETE FROM rooms WHERE expires_at < ?1")
        .bind(&[jsf(now)])?
        .run()
        .await?;
    Ok(())
}

async fn route_to_room_do(req: Request, env: Env) -> Result<Response> {
    let url = req.url()?;
    let room_id = url
        .query_pairs()
        .find(|(k, _)| k == "room")
        .map(|(_, v)| v.into_owned())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let namespace = env.durable_object("ROOM_OBJECT")?;
    let stub = namespace.id_from_name(&room_id)?.get_stub()?;
    stub.fetch_with_request(req).await
}

async fn create_room(mut req: Request, env: Env) -> Result<Response> {
    #[derive(serde::Deserialize)]
    struct Body {
        name: String,
        deck_type: Option<String>,
        jira_project_key: Option<String>,
        jira_base_url: Option<String>,
    }

    let body: Body = req.json().await?;
    let room_id = uuid::Uuid::new_v4().to_string();
    let deck_type = body.deck_type.unwrap_or_else(|| "Fibonacci".to_string());
    let now = js_sys::Date::now();
    let expires = now + 86_400_000.0;

    let db = env.d1("DB")?;
    db.prepare(
        "INSERT INTO rooms
         (room_id, name, deck_type, jira_project_key, jira_base_url, created_at, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&[
        jsv(&room_id),
        jsv(&body.name),
        jsv(&deck_type),
        body.jira_project_key
            .as_deref()
            .map(jsv)
            .unwrap_or_else(jsnull),
        body.jira_base_url
            .as_deref()
            .map(jsv)
            .unwrap_or_else(jsnull),
        jsf(now),
        jsf(expires),
    ])?
    .run()
    .await?;

    Response::from_json(&serde_json::json!({ "room_id": room_id }))
}

async fn get_jira_tickets(env: Env, room_id: &str) -> Result<Response> {
    let db = env.d1("DB")?;

    #[derive(serde::Deserialize)]
    struct RoomRow {
        jira_project_key: Option<String>,
    }

    let row = db
        .prepare("SELECT jira_project_key FROM rooms WHERE room_id = ?1")
        .bind(&[jsv(room_id)])?
        .first::<RoomRow>(None)
        .await?;

    let project_key = row
        .and_then(|r| r.jira_project_key)
        .ok_or_else(|| Error::RustError("room not found or no Jira project".to_string()))?;

    let tickets = db
        .prepare(
            "SELECT issue_key, project_key, summary, description, story_points, fetched_at
             FROM jira_tickets WHERE project_key = ?1 AND story_points IS NULL
             ORDER BY issue_key",
        )
        .bind(&[jsv(&project_key)])?
        .all()
        .await?
        .results::<CachedJiraTicket>()
        .map_err(|e| Error::RustError(e.to_string()))?;

    Response::from_json(&tickets)
}

async fn run_jira_sync(env: Env) -> Result<()> {
    let db = env.d1("DB")?;
    let story_points_field = env
        .var("JIRA_CUSTOM_FIELD")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "customfield_10016".to_string());
    let jira_email = env
        .secret("JIRA_EMAIL")
        .map(|v| v.to_string())
        .unwrap_or_default();
    let jira_token = env
        .secret("JIRA_API_TOKEN")
        .map(|v| v.to_string())
        .unwrap_or_default();

    #[derive(serde::Deserialize)]
    struct ProjectRow {
        jira_project_key: String,
        jira_base_url: String,
    }

    let now = js_sys::Date::now();
    let projects = db
        .prepare(
            "SELECT DISTINCT jira_project_key, jira_base_url FROM rooms
             WHERE expires_at > ?1
               AND jira_project_key IS NOT NULL
               AND jira_base_url IS NOT NULL",
        )
        .bind(&[jsf(now)])?
        .all()
        .await?
        .results::<ProjectRow>()
        .map_err(|e| Error::RustError(e.to_string()))?;

    for project in projects {
        let config = JiraConfig {
            base_url: project.jira_base_url,
            project_key: project.jira_project_key.clone(),
            email: jira_email.clone(),
            api_token: jira_token.clone(),
            story_points_field: story_points_field.clone(),
        };

        match jira_handler::fetch_unestimated(&config).await {
            Ok(tickets) => {
                for (issue_key, summary, description) in tickets {
                    let result = db
                        .prepare(
                            "INSERT OR REPLACE INTO jira_tickets
                             (issue_key, project_key, summary, description, story_points, fetched_at)
                             VALUES (?1, ?2, ?3, ?4, NULL, ?5)",
                        )
                        .bind(&[
                            jsv(&issue_key),
                            jsv(&project.jira_project_key),
                            jsv(&summary),
                            description.as_deref().map(jsv).unwrap_or_else(jsnull),
                            jsf(now),
                        ]);
                    if let Ok(stmt) = result {
                        let _ = stmt.run().await;
                    }
                }
            }
            Err(e) => {
                console_error!("Jira sync failed for {}: {e}", project.jira_project_key);
            }
        }
    }

    // Retry failed story-point pushes (max 3 attempts)
    #[derive(serde::Deserialize)]
    struct FailedSession {
        session_id: String,
        #[allow(dead_code)]
        room_id: String,
        jira_issue_key: String,
        final_estimate: String,
        jira_base_url: String,
    }

    let failed_sessions = db
        .prepare(
            "SELECT cs.session_id, cs.room_id, cs.jira_issue_key, cs.final_estimate,
                    r.jira_base_url
             FROM completed_sessions cs
             JOIN rooms r ON cs.room_id = r.room_id
             WHERE cs.jira_push_status = 'failed' AND cs.jira_push_attempts < 3
             LIMIT 50",
        )
        .bind(&[])?
        .all()
        .await?
        .results::<FailedSession>()
        .map_err(|e| Error::RustError(e.to_string()))?;

    for session in failed_sessions {
        if let Some(points) = pp_jira::estimate_to_points(&session.final_estimate) {
            let config = JiraConfig {
                base_url: session.jira_base_url,
                project_key: String::new(),
                email: jira_email.clone(),
                api_token: jira_token.clone(),
                story_points_field: story_points_field.clone(),
            };
            let push_ok = jira_handler::push_story_points(&config, &session.jira_issue_key, points)
                .await
                .is_ok();
            let new_status = if push_ok { "success" } else { "failed" };
            let result = db
                .prepare(
                    "UPDATE completed_sessions
                     SET jira_push_status = ?1,
                         jira_push_attempts = jira_push_attempts + 1
                     WHERE session_id = ?2",
                )
                .bind(&[jsv(new_status), jsv(&session.session_id)]);
            if let Ok(stmt) = result {
                let _ = stmt.run().await;
            }
        }
    }

    Ok(())
}
