use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SessionEvent {
    SessionStarted {
        session_id: String,
        room_id: String,
        ticket_id: Option<String>,
        ticket_description: Option<String>,
        started_at: u64,
    },
    SessionEnded {
        session_id: String,
        room_id: String,
        final_estimate: Option<String>,
        revealed_at: u64,
    },
    SessionReset {
        session_id: String,
        room_id: String,
        reset_at: u64,
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
