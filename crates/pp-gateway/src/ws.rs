use crate::AppState;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use pp_events::DomainEvent;
use pp_store::EventStore;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::broadcast;
use tracing::{error, instrument, warn};

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Per-connection identity captured at JoinRoom time.
#[derive(Clone, Debug)]
struct ConnContext {
    participant_id: String,
    #[expect(dead_code)] // reserved for future per-connection routing
    room_id: String,
}

/// Messages the browser sends to the gateway.
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    CreateRoom {
        name: String,
        deck_type: Option<pp_domain::room::DeckType>,
    },
    AddTicket {
        room_id: String,
        title: String,
        description: Option<String>,
    },
    JoinRoom {
        room_id: String,
        participant_id: String,
        display_name: String,
    },
    CastVote {
        room_id: String,
        session_id: String,
        card: String,
    },
    RetractVote {
        room_id: String,
        session_id: String,
    },
    StartSession {
        room_id: String,
        ticket_id: Option<String>,
        ticket_description: Option<String>,
        countdown_secs: Option<u32>,
    },
    RevealVotes {
        room_id: String,
        session_id: String,
    },
    ResetSession {
        room_id: String,
        session_id: String,
    },
}

/// Messages the gateway pushes to the browser.
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    RoomCreated {
        room_id: String,
        name: String,
    },
    RoomState {
        room: pp_projection::RoomView,
    },
    #[expect(dead_code)] // future: low-level event push
    EventApplied {
        event: DomainEvent,
    },
    Error {
        message: String,
    },
    CountdownTick {
        room_id: String,
        session_id: String,
        remaining_secs: u32,
    },
}

#[instrument(skip_all)]
pub async fn handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Lazily set when JoinRoom arrives.
    let mut conn: Option<ConnContext> = None;
    // Lazily subscribed when JoinRoom arrives.
    let mut broadcast_rx: Option<broadcast::Receiver<String>> = None;

    // Per-connection rate limiter: max 10 messages/s, burst of 20.
    let msg_limiter: Arc<DefaultDirectRateLimiter> = Arc::new(RateLimiter::direct(
        Quota::per_second(NonZeroU32::new(10).unwrap())
            .allow_burst(NonZeroU32::new(20).unwrap()),
    ));

    loop {
        tokio::select! {
            // Incoming WS frame from browser
            maybe_msg = receiver.next() => {
                match maybe_msg {
                    Some(Ok(Message::Text(text))) => {
                        if msg_limiter.check().is_err() {
                            warn!("WS message rate limit exceeded, dropping frame");
                            let err = ServerMessage::Error { message: "rate limit exceeded".into() };
                            let _ = sender
                                .send(Message::Text(serde_json::to_string(&err).unwrap_or_default().into()))
                                .await;
                            continue;
                        }
                        match serde_json::from_str::<ClientMessage>(&text) {
                            Ok(client_msg) => {
                                // Capture JoinRoom identity on first message.
                                if let ClientMessage::JoinRoom { ref room_id, ref participant_id, .. } = client_msg {
                                    let room_bus = state.room_bus.clone();
                                    let tx = room_bus
                                        .entry(room_id.clone())
                                        .or_insert_with(|| broadcast::channel(64).0)
                                        .clone();
                                    broadcast_rx = Some(tx.subscribe());
                                    conn = Some(ConnContext {
                                        participant_id: participant_id.clone(),
                                        room_id: room_id.clone(),
                                    });
                                }

                                match handle_client_message(
                                    client_msg,
                                    conn.as_ref(),
                                    &state,
                                )
                                .await
                                {
                                    Ok(Some(reply)) => {
                                        let _ = sender
                                            .send(Message::Text(
                                                serde_json::to_string(&reply).unwrap_or_default().into(),
                                            ))
                                            .await;
                                    }
                                    Ok(None) => {}
                                    Err(e) => {
                                        let err = ServerMessage::Error { message: e.to_string() };
                                        let _ = sender
                                            .send(Message::Text(
                                                serde_json::to_string(&err).unwrap_or_default().into(),
                                            ))
                                            .await;
                                    }
                                }
                            }
                            Err(e) => error!("invalid client message: {e}"),
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }

            // Broadcast from another connection in the same room
            Some(Ok(broadcast_msg)) = async {
                match broadcast_rx.as_mut() {
                    Some(rx) => Some(rx.recv().await),
                    None => None,
                }
            } => {
                let _ = sender.send(Message::Text(broadcast_msg.into())).await;
            }
        }
    }
}

async fn handle_client_message(
    msg: ClientMessage,
    conn: Option<&ConnContext>,
    state: &AppState,
) -> Result<Option<ServerMessage>, Box<dyn std::error::Error + Send + Sync>> {
    use pp_events::{RoomEvent, SessionEvent};
    use pp_store::subjects::Subjects;
    use uuid::Uuid;

    match msg {
        ClientMessage::CreateRoom { name, deck_type } => {
            let room_id = Uuid::new_v4().to_string();
            let resolved_deck = deck_type.unwrap_or(pp_domain::room::DeckType::Fibonacci);
            let event = DomainEvent::Room(RoomEvent::RoomCreated {
                room_id: room_id.clone(),
                name: name.clone(),
                deck_type: resolved_deck,
                facilitator_id: String::new(),
                created_at: now_millis(),
            });
            let subject = Subjects::room_created(&room_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            return Ok(Some(ServerMessage::RoomCreated { room_id, name }));
        }

        ClientMessage::AddTicket {
            room_id,
            title,
            description,
        } => {
            let ticket_id = Uuid::new_v4().to_string();
            let event = DomainEvent::Room(RoomEvent::TicketAdded {
                room_id: room_id.clone(),
                ticket_id: ticket_id.clone(),
                title,
                description,
                added_at: now_millis(),
            });
            let subject = Subjects::ticket_added(&room_id, &ticket_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
        }

        ClientMessage::JoinRoom {
            room_id,
            participant_id,
            display_name,
        } => {
            // If the room isn't in the projection yet (created via CLI while gateway
            // was already running), replay its persisted events now.
            if state.projection.get(&room_id).is_none() {
                let filter = pp_store::subjects::Subjects::room_all(&room_id);
                if let Ok(envelopes) = state.store.replay(&filter).await {
                    for env in envelopes {
                        state.projection.apply(&env.payload);
                    }
                }
            }

            let event = DomainEvent::Room(RoomEvent::ParticipantJoined {
                room_id: room_id.clone(),
                participant_id,
                display_name,
                role: pp_domain::participant::Role::Voter,
                joined_at: now_millis(),
            });
            let subject = Subjects::participant_joined(&room_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
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
            let subject = Subjects::session_started(&room_id, &session_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;

            // Spawn countdown task if requested.
            if let Some(secs) = countdown_secs {
                if secs > 0 && secs <= 300 {
                    let state2 = state.clone();
                    let rid = room_id.clone();
                    let sid = session_id.clone();
                    tokio::spawn(async move {
                        for remaining in (0..=secs).rev() {
                            let tick = ServerMessage::CountdownTick {
                                room_id: rid.clone(),
                                session_id: sid.clone(),
                                remaining_secs: remaining,
                            };
                            let Ok(text) = serde_json::to_string(&tick) else { break };
                            if let Some(tx) = state2.room_bus.get(&rid) {
                                let _ = tx.send(text);
                            }
                            if remaining == 0 { break; }
                            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                        }
                        // Auto-reveal when countdown hits 0.
                        let reveal_event = DomainEvent::Session(SessionEvent::SessionEnded {
                            session_id: sid.clone(),
                            room_id: rid.clone(),
                            final_estimate: None,
                            revealed_at: now_millis(),
                        });
                        let subject = Subjects::session_ended(&rid, &sid);
                        if let Ok(env) = state2.store.publish(&subject, reveal_event).await {
                            state2.projection.apply(&env.payload);
                            broadcast_room_state(&rid, &state2).await;
                        }
                    });
                }
            }
        }

        ClientMessage::CastVote {
            room_id,
            session_id,
            card,
        } => {
            let participant_id = conn
                .map(|c| c.participant_id.clone())
                .unwrap_or_else(|| "unknown".to_string());
            let parsed: pp_domain::Card = card.parse().map_err(|e: String| e)?;
            let event = DomainEvent::Vote(pp_events::VoteEvent::VoteCast {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                participant_id: participant_id.clone(),
                card: parsed,
                cast_at: now_millis(),
            });
            let subject = Subjects::vote_cast(&room_id, &session_id, &participant_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
        }

        ClientMessage::RetractVote {
            room_id,
            session_id,
        } => {
            let participant_id = conn
                .map(|c| c.participant_id.clone())
                .unwrap_or_else(|| "unknown".to_string());
            let event = DomainEvent::Vote(pp_events::VoteEvent::VoteRetracted {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                participant_id: participant_id.clone(),
                retracted_at: now_millis(),
            });
            let subject = Subjects::vote_retracted(&room_id, &session_id, &participant_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
        }

        ClientMessage::RevealVotes {
            room_id,
            session_id,
        } => {
            let event = DomainEvent::Session(SessionEvent::SessionEnded {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                final_estimate: None,
                revealed_at: now_millis(),
            });
            let subject = Subjects::session_ended(&room_id, &session_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
        }

        ClientMessage::ResetSession {
            room_id,
            session_id,
        } => {
            let event = DomainEvent::Session(SessionEvent::SessionReset {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                reset_at: now_millis(),
            });
            let subject = Subjects::session_reset(&room_id, &session_id);
            let envelope = state.store.publish(&subject, event).await?;
            state.projection.apply(&envelope.payload);
            broadcast_room_state(&room_id, state).await;
        }
    }

    Ok(None)
}

/// Serialize the current RoomState and broadcast it to every connection in the room.
async fn broadcast_room_state(room_id: &str, state: &AppState) {
    let Some(room) = state.projection.get(room_id) else {
        return;
    };
    let msg = ServerMessage::RoomState { room };
    let Ok(text) = serde_json::to_string(&msg) else {
        return;
    };
    if let Some(tx) = state.room_bus.get(room_id) {
        // Receivers may have dropped — that's fine.
        let _ = tx.send(text);
    }
}
