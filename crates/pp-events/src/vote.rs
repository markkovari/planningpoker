use pp_domain::card::Card;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum VoteEvent {
    VoteCast {
        session_id: String,
        room_id: String,
        participant_id: String,
        card: Card,
        cast_at: u64,
    },
    VoteRetracted {
        session_id: String,
        room_id: String,
        participant_id: String,
        retracted_at: u64,
    },
}

impl VoteEvent {
    pub fn room_id(&self) -> &str {
        match self {
            VoteEvent::VoteCast { room_id, .. } | VoteEvent::VoteRetracted { room_id, .. } => {
                room_id
            }
        }
    }

    pub fn session_id(&self) -> &str {
        match self {
            VoteEvent::VoteCast { session_id, .. }
            | VoteEvent::VoteRetracted { session_id, .. } => session_id,
        }
    }

    pub fn participant_id(&self) -> &str {
        match self {
            VoteEvent::VoteCast { participant_id, .. }
            | VoteEvent::VoteRetracted { participant_id, .. } => participant_id,
        }
    }
}
