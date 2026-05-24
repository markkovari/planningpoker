use crate::event_store::DoEventStore;
use crate::jira_handler;
use crate::ws::{ClientMessage, ConnTag, ServerMessage};
use pp_domain::participant::Role;
use pp_events::{DomainEvent, RoomEvent, SessionEvent, VoteEvent};
use pp_jira::{config::JiraConfig, estimate_to_points, JiraCredentials, JiraRoomConfig};
use pp_projection::{apply_event, RoomView};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use uuid::Uuid;
use wasm_bindgen::JsValue;
use worker::*;

fn now_millis() -> u64 {
    js_sys::Date::now() as u64
}

fn jsv(s: &str) -> JsValue {
    JsValue::from_str(s)
}

fn jsf(f: f64) -> JsValue {
    JsValue::from_f64(f)
}

struct Inner {
    room_view: RoomView,
    votes: HashMap<(String, String), String>,
    initialized: bool,
}

impl Inner {
    fn apply(&mut self, event: &DomainEvent) {
        apply_event(&mut self.room_view, &mut self.votes, event);
    }
}

#[durable_object]
pub struct RoomObject {
    state: State,
    env: Env,
    inner: RefCell<Inner>,
}

impl DurableObject for RoomObject {
    fn new(state: State, env: Env) -> Self {
        Self {
            state,
            env,
            inner: RefCell::new(Inner {
                room_view: RoomView::default(),
                votes: HashMap::new(),
                initialized: false,
            }),
        }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        self.handle_ws_upgrade(req).await
    }

    async fn alarm(&self) -> Result<Response> {
        let _ = self.ensure_initialized().await;

        let countdown_key = "countdown";
        let state: Option<CountdownState> =
            self.state.storage().get(countdown_key).await.ok().flatten();

        if let Some(mut cd) = state {
            if cd.remaining_secs == 0 {
                let _ = self.state.storage().delete(countdown_key).await;
                return Response::ok("");
            }

            cd.remaining_secs -= 1;

            let tick = ServerMessage::CountdownTick {
                room_id: self.inner.borrow().room_view.id.clone(),
                session_id: cd.session_id.clone(),
                remaining_secs: cd.remaining_secs,
            };
            self.broadcast(&tick);

            if cd.remaining_secs == 0 {
                let _ = self.state.storage().delete(countdown_key).await;
                let sid = cd.session_id.clone();
                let _ = self.auto_reveal_session(&sid).await;
            } else {
                let _ = self.state.storage().put(countdown_key, &cd).await;
                let _ = self
                    .state
                    .storage()
                    .set_alarm(std::time::Duration::from_secs(1))
                    .await;
            }
        }

        Response::ok("")
    }

    async fn websocket_message(
        &self,
        ws: WebSocket,
        message: WebSocketIncomingMessage,
    ) -> Result<()> {
        let text = match message {
            WebSocketIncomingMessage::String(s) => s,
            _ => return Ok(()),
        };

        let _ = self.ensure_initialized().await;

        let msg: ClientMessage = match serde_json::from_str(&text) {
            Ok(m) => m,
            Err(e) => {
                let _ = ws.send_with_str(
                    serde_json::to_string(&ServerMessage::error(format!("invalid message: {e}")))
                        .unwrap_or_default(),
                );
                return Ok(());
            }
        };

        if let Err(e) = self.handle_message(ws.clone(), msg).await {
            let _ = ws.send_with_str(
                serde_json::to_string(&ServerMessage::error(e.to_string())).unwrap_or_default(),
            );
        }
        Ok(())
    }

    async fn websocket_close(
        &self,
        _ws: WebSocket,
        _code: usize,
        _reason: String,
        _was_clean: bool,
    ) -> Result<()> {
        Ok(())
    }
}

impl RoomObject {
    async fn handle_ws_upgrade(&self, req: Request) -> Result<Response> {
        let url = req.url()?;
        let room_id_param = url
            .query_pairs()
            .find(|(k, _)| k == "room")
            .map(|(_, v)| v.into_owned());

        if let Some(rid) = room_id_param {
            if self.inner.borrow().room_view.id.is_empty() {
                let _ = self.state.storage().put("pending_room_id", &rid).await;
            }
        }

        let pair = WebSocketPair::new()?;
        let client = pair.client;
        let server = pair.server;
        self.state.accept_web_socket(&server);
        Response::from_websocket(client)
    }

    async fn ensure_initialized(&self) -> Result<()> {
        if self.inner.borrow().initialized {
            return Ok(());
        }
        self.inner.borrow_mut().initialized = true;

        let cached_id = self.inner.borrow().room_view.id.clone();
        let room_id = if !cached_id.is_empty() {
            cached_id
        } else {
            self.state
                .storage()
                .get::<String>("pending_room_id")
                .await
                .ok()
                .flatten()
                .unwrap_or_default()
        };

        if room_id.is_empty() {
            return Ok(());
        }

        let db = self.env.d1("DB")?;
        let store = DoEventStore::new(&db, &room_id);
        let _ = store.init_schema().await;

        let envelopes = store.replay().await.unwrap_or_default();
        let mut inner = self.inner.borrow_mut();
        for env in envelopes {
            inner.apply(&env.payload);
        }
        Ok(())
    }

    async fn handle_message(&self, ws: WebSocket, msg: ClientMessage) -> Result<()> {
        match msg {
            ClientMessage::CreateRoom { name, deck_type } => {
                let room_id = Uuid::new_v4().to_string();
                let resolved = deck_type.unwrap_or(pp_domain::room::DeckType::Fibonacci);
                let event = DomainEvent::Room(RoomEvent::RoomCreated {
                    room_id: room_id.clone(),
                    name: name.clone(),
                    deck_type: resolved,
                    facilitator_id: String::new(),
                    created_at: now_millis(),
                });
                self.persist_and_apply_for_room(&room_id, "pp.room.created", &event)
                    .await?;

                let _ = self.register_room_in_d1(&room_id, &name, resolved).await;

                let reply = ServerMessage::RoomCreated { room_id, name };
                let _ = ws.send_with_str(serde_json::to_string(&reply).unwrap_or_default());
                self.broadcast_room_state();
            }

            ClientMessage::JoinRoom {
                room_id,
                participant_id,
                display_name,
            } => {
                let tag = ConnTag {
                    participant_id: participant_id.clone(),
                    room_id: room_id.clone(),
                };
                let _ = ws.serialize_attachment(serde_json::to_string(&tag).unwrap_or_default());

                if self.inner.borrow().room_view.id.is_empty() {
                    let db = self.env.d1("DB")?;
                    let store = DoEventStore::new(&db, &room_id);
                    let _ = store.init_schema().await;
                    let envelopes = store.replay().await.unwrap_or_default();
                    let mut inner = self.inner.borrow_mut();
                    for env in envelopes {
                        inner.apply(&env.payload);
                    }
                }

                let event = DomainEvent::Room(RoomEvent::ParticipantJoined {
                    room_id: room_id.clone(),
                    participant_id,
                    display_name,
                    role: Role::Voter,
                    joined_at: now_millis(),
                });
                self.persist_and_apply_for_room(
                    &room_id,
                    &format!("pp.room.{}.joined", room_id),
                    &event,
                )
                .await?;
                self.broadcast_room_state();
            }

            ClientMessage::AddTicket {
                room_id,
                title,
                description,
            } => {
                let ticket_id = Uuid::new_v4().to_string();
                let event = DomainEvent::Room(RoomEvent::TicketAdded {
                    room_id: room_id.clone(),
                    ticket_id,
                    title,
                    description,
                    added_at: now_millis(),
                });
                self.persist_and_apply(&format!("pp.room.{}.ticket.added", room_id), &event)
                    .await?;
                self.broadcast_room_state();
            }

            ClientMessage::StartSession {
                room_id,
                ticket_id,
                ticket_description,
                countdown_secs,
            } => {
                let session_id = Uuid::new_v4().to_string();
                let event = DomainEvent::Session(SessionEvent::SessionStarted {
                    session_id: session_id.clone(),
                    room_id: room_id.clone(),
                    ticket_id,
                    ticket_description,
                    started_at: now_millis(),
                });
                self.persist_and_apply(
                    &format!("pp.session.{}.{}.started", room_id, session_id),
                    &event,
                )
                .await?;
                self.broadcast_room_state();

                if let Some(secs) = countdown_secs {
                    if secs > 0 && secs <= 300 {
                        let cd = CountdownState {
                            session_id,
                            remaining_secs: secs,
                        };
                        self.state.storage().put("countdown", &cd).await?;
                        self.state
                            .storage()
                            .set_alarm(std::time::Duration::from_secs(1))
                            .await?;
                    }
                }
            }

            ClientMessage::CastVote {
                room_id,
                session_id,
                card,
            } => {
                let participant_id = self
                    .participant_id_from_ws(&ws)
                    .unwrap_or_else(|| "unknown".to_string());
                let parsed: pp_domain::Card =
                    card.parse().map_err(|e: String| Error::RustError(e))?;
                let event = DomainEvent::Vote(VoteEvent::VoteCast {
                    session_id: session_id.clone(),
                    room_id: room_id.clone(),
                    participant_id,
                    card: parsed,
                    cast_at: now_millis(),
                });
                self.persist_and_apply(&format!("pp.vote.{}.{}.cast", room_id, session_id), &event)
                    .await?;
                self.broadcast_room_state();
            }

            ClientMessage::RetractVote {
                room_id,
                session_id,
            } => {
                let participant_id = self
                    .participant_id_from_ws(&ws)
                    .unwrap_or_else(|| "unknown".to_string());
                let event = DomainEvent::Vote(VoteEvent::VoteRetracted {
                    session_id: session_id.clone(),
                    room_id: room_id.clone(),
                    participant_id,
                    retracted_at: now_millis(),
                });
                self.persist_and_apply(
                    &format!("pp.vote.{}.{}.retracted", room_id, session_id),
                    &event,
                )
                .await?;
                self.broadcast_room_state();
            }

            ClientMessage::RevealVotes {
                room_id,
                session_id,
            } => {
                self.end_session(&room_id, &session_id, None).await?;
            }

            ClientMessage::ResetSession {
                room_id,
                session_id,
            } => {
                let _ = self.state.storage().delete("countdown").await;
                let event = DomainEvent::Session(SessionEvent::SessionReset {
                    session_id: session_id.clone(),
                    room_id: room_id.clone(),
                    reset_at: now_millis(),
                });
                self.persist_and_apply(
                    &format!("pp.session.{}.{}.reset", room_id, session_id),
                    &event,
                )
                .await?;
                self.broadcast_room_state();
            }

            ClientMessage::LinkJiraProject {
                room_id,
                jira_base_url,
                jira_project_key,
                jira_email,
                jira_api_token,
            } => {
                let story_points_field = self
                    .env
                    .var("JIRA_CUSTOM_FIELD")
                    .map(|v| v.to_string())
                    .unwrap_or_else(|_| "customfield_10016".to_string());

                let room_config = JiraRoomConfig {
                    base_url: jira_base_url.clone(),
                    project_key: jira_project_key.clone(),
                    story_points_field,
                };
                let creds = JiraCredentials {
                    email: jira_email,
                    api_token: jira_api_token,
                };
                let config = JiraConfig::from_parts(room_config.clone(), creds.clone());

                let _ = self
                    .update_room_jira_config(&room_id, &jira_base_url, &jira_project_key)
                    .await;
                let _ = self
                    .state
                    .storage()
                    .put("jira_room_config", &room_config)
                    .await;
                let _ = self.state.storage().put("jira_credentials", &creds).await;

                match jira_handler::fetch_unestimated(&config).await {
                    Ok(tickets) => {
                        let count = tickets.len() as u32;
                        for (issue_key, summary, description) in tickets {
                            let event = DomainEvent::Room(RoomEvent::JiraTicketImported {
                                room_id: room_id.clone(),
                                issue_key,
                                summary,
                                description,
                                jira_base_url: jira_base_url.clone(),
                                imported_at: now_millis(),
                            });
                            let _ = self
                                .persist_and_apply(
                                    &format!("pp.room.{}.jira.imported", room_id),
                                    &event,
                                )
                                .await;
                        }
                        self.broadcast_room_state();
                        let reply = ServerMessage::JiraLinked {
                            project_key: jira_project_key,
                            ticket_count: count,
                        };
                        let _ = ws.send_with_str(serde_json::to_string(&reply).unwrap_or_default());
                    }
                    Err(e) => {
                        return Err(Error::RustError(format!("Jira fetch failed: {e}")));
                    }
                }
            }

            ClientMessage::ImportJiraTickets { room_id } => {
                let room_cfg: Option<JiraRoomConfig> = self
                    .state
                    .storage()
                    .get("jira_room_config")
                    .await
                    .ok()
                    .flatten();
                let creds: Option<JiraCredentials> = self
                    .state
                    .storage()
                    .get("jira_credentials")
                    .await
                    .ok()
                    .flatten();
                let Some(config) = room_cfg
                    .zip(creds)
                    .map(|(c, k)| JiraConfig::from_parts(c, k))
                else {
                    return Err(Error::RustError(
                        "no Jira project linked to this room".to_string(),
                    ));
                };
                match jira_handler::fetch_unestimated(&config).await {
                    Ok(tickets) => {
                        let count = tickets.len() as u32;
                        for (issue_key, summary, description) in tickets {
                            let event = DomainEvent::Room(RoomEvent::JiraTicketImported {
                                room_id: room_id.clone(),
                                issue_key,
                                summary,
                                description,
                                jira_base_url: config.base_url.clone(),
                                imported_at: now_millis(),
                            });
                            let _ = self
                                .persist_and_apply(
                                    &format!("pp.room.{}.jira.imported", room_id),
                                    &event,
                                )
                                .await;
                        }
                        self.broadcast_room_state();
                        let reply = ServerMessage::JiraLinked {
                            project_key: config.project_key,
                            ticket_count: count,
                        };
                        let _ = ws.send_with_str(serde_json::to_string(&reply).unwrap_or_default());
                    }
                    Err(e) => {
                        return Err(Error::RustError(format!("Jira fetch failed: {e}")));
                    }
                }
            }
        }

        Ok(())
    }

    async fn end_session(
        &self,
        room_id: &str,
        session_id: &str,
        final_estimate: Option<String>,
    ) -> Result<()> {
        let event = DomainEvent::Session(SessionEvent::SessionEnded {
            session_id: session_id.to_string(),
            room_id: room_id.to_string(),
            final_estimate,
            revealed_at: now_millis(),
        });
        self.persist_and_apply(
            &format!("pp.session.{}.{}.ended", room_id, session_id),
            &event,
        )
        .await?;
        self.broadcast_room_state();

        let (jira_issue_key, final_est) = {
            let inner = self.inner.borrow();
            inner
                .room_view
                .active_session
                .as_ref()
                .map(|s| (s.jira_issue_key.clone(), s.final_estimate.clone()))
                .unwrap_or((None, None))
        };

        if let (Some(issue_key), Some(est)) = (jira_issue_key, final_est) {
            if let Some(points) = estimate_to_points(&est) {
                let room_cfg: Option<JiraRoomConfig> = self
                    .state
                    .storage()
                    .get("jira_room_config")
                    .await
                    .ok()
                    .flatten();
                let creds: Option<JiraCredentials> = self
                    .state
                    .storage()
                    .get("jira_credentials")
                    .await
                    .ok()
                    .flatten();
                if let Some(config) = room_cfg
                    .zip(creds)
                    .map(|(c, k)| JiraConfig::from_parts(c, k))
                {
                    let push_ok = jira_handler::push_story_points(&config, &issue_key, points)
                        .await
                        .is_ok();
                    let status = if push_ok { "pushed" } else { "failed" };

                    if let Some(session) = self.inner.borrow_mut().room_view.active_session.as_mut()
                    {
                        session.jira_push_status = Some(status.to_string());
                    }

                    self.broadcast(&ServerMessage::JiraSyncStatus {
                        session_id: session_id.to_string(),
                        issue_key: issue_key.clone(),
                        status: status.to_string(),
                    });

                    let _ = self
                        .record_completed_session(session_id, room_id, &issue_key, &est, status)
                        .await;
                }
            }
        }

        Ok(())
    }

    async fn auto_reveal_session(&self, session_id: &str) -> Result<()> {
        let room_id = self.inner.borrow().room_view.id.clone();
        self.end_session(&room_id, session_id, None).await
    }

    async fn persist_and_apply(&self, subject: &str, event: &DomainEvent) -> Result<()> {
        let room_id = self.inner.borrow().room_view.id.clone();
        self.persist_and_apply_for_room(&room_id, subject, event)
            .await
    }

    async fn persist_and_apply_for_room(
        &self,
        room_id: &str,
        subject: &str,
        event: &DomainEvent,
    ) -> Result<()> {
        let event_id = Uuid::new_v4().to_string();
        let db = self.env.d1("DB")?;
        let store = DoEventStore::new(&db, room_id);
        store
            .append(&event_id, subject, event, now_millis())
            .await?;
        let mut inner = self.inner.borrow_mut();
        inner.apply(event);
        Ok(())
    }

    fn broadcast_room_state(&self) {
        let msg = ServerMessage::room_state(self.inner.borrow().room_view.clone());
        self.broadcast(&msg);
    }

    fn broadcast(&self, msg: &ServerMessage) {
        let Ok(text) = serde_json::to_string(msg) else {
            return;
        };
        for ws in self.state.get_websockets() {
            let _ = ws.send_with_str(&text);
        }
    }

    fn participant_id_from_ws(&self, ws: &WebSocket) -> Option<String> {
        let tag: Option<String> = ws.deserialize_attachment().ok()?;
        let tag = tag?;
        let conn: ConnTag = serde_json::from_str(&tag).ok()?;
        Some(conn.participant_id)
    }

    async fn register_room_in_d1(
        &self,
        room_id: &str,
        name: &str,
        deck_type: pp_domain::room::DeckType,
    ) -> Result<()> {
        let db = self.env.d1("DB")?;
        let deck_str = serde_json::to_string(&deck_type)
            .unwrap_or_else(|_| "\"Fibonacci\"".to_string())
            .trim_matches('"')
            .to_string();
        let now = now_millis() as f64;
        let expires = now + 86_400_000.0;
        db.prepare(
            "INSERT OR IGNORE INTO rooms (room_id, name, deck_type, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(&[
            jsv(room_id),
            jsv(name),
            jsv(&deck_str),
            jsf(now),
            jsf(expires),
        ])?
        .run()
        .await?;
        Ok(())
    }

    async fn update_room_jira_config(
        &self,
        room_id: &str,
        jira_base_url: &str,
        jira_project_key: &str,
    ) -> Result<()> {
        let db = self.env.d1("DB")?;
        db.prepare("UPDATE rooms SET jira_base_url = ?1, jira_project_key = ?2 WHERE room_id = ?3")
            .bind(&[jsv(jira_base_url), jsv(jira_project_key), jsv(room_id)])?
            .run()
            .await?;
        Ok(())
    }

    async fn record_completed_session(
        &self,
        session_id: &str,
        room_id: &str,
        jira_issue_key: &str,
        final_estimate: &str,
        status: &str,
    ) -> Result<()> {
        let db = self.env.d1("DB")?;
        db.prepare(
            "INSERT OR REPLACE INTO completed_sessions
             (session_id, room_id, ticket_id, final_estimate, jira_issue_key,
              jira_push_status, jira_push_attempts, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)",
        )
        .bind(&[
            jsv(session_id),
            jsv(room_id),
            jsv(jira_issue_key),
            jsv(final_estimate),
            jsv(jira_issue_key),
            jsv(status),
            jsf(now_millis() as f64),
        ])?
        .run()
        .await?;
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct CountdownState {
    session_id: String,
    remaining_secs: u32,
}
