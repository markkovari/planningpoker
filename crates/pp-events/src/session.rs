use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SessionEvent {
    SessionStarted {
        session_id: String,
        room_id: String,
        ticket_id: Option<String>,
        ticket_description: Option<String>,
        #[serde(with = "time::serde::rfc3339")]
        started_at: OffsetDateTime,
    },
    SessionEnded {
        session_id: String,
        room_id: String,
        final_estimate: Option<String>,
        #[serde(with = "time::serde::rfc3339")]
        revealed_at: OffsetDateTime,
    },
    SessionReset {
        session_id: String,
        room_id: String,
        #[serde(with = "time::serde::rfc3339")]
        reset_at: OffsetDateTime,
    },
}

impl SessionEvent {
    pub fn room_id(&self) -> &str {
        match self {
            SessionEvent::SessionStarted { room_id, .. }
            | SessionEvent::SessionEnded { room_id, .. }
            | SessionEvent::SessionReset { room_id, .. } => room_id,
        }
    }

    pub fn session_id(&self) -> &str {
        match self {
            SessionEvent::SessionStarted { session_id, .. }
            | SessionEvent::SessionEnded { session_id, .. }
            | SessionEvent::SessionReset { session_id, .. } => session_id,
        }
    }
}
