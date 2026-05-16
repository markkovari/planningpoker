use pp_domain::participant::Role;
use pp_domain::room::DeckType;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RoomEvent {
    RoomCreated {
        room_id: String,
        name: String,
        deck_type: DeckType,
        facilitator_id: String,
        #[serde(with = "time::serde::rfc3339")]
        created_at: OffsetDateTime,
    },
    ParticipantJoined {
        room_id: String,
        participant_id: String,
        display_name: String,
        role: Role,
        #[serde(with = "time::serde::rfc3339")]
        joined_at: OffsetDateTime,
    },
    ParticipantLeft {
        room_id: String,
        participant_id: String,
        #[serde(with = "time::serde::rfc3339")]
        left_at: OffsetDateTime,
    },
    ParticipantRenamed {
        room_id: String,
        participant_id: String,
        new_name: String,
        #[serde(with = "time::serde::rfc3339")]
        changed_at: OffsetDateTime,
    },
    ParticipantRoleChanged {
        room_id: String,
        participant_id: String,
        new_role: Role,
        #[serde(with = "time::serde::rfc3339")]
        changed_at: OffsetDateTime,
    },
    TicketAdded {
        room_id: String,
        ticket_id: String,
        title: String,
        description: Option<String>,
        #[serde(with = "time::serde::rfc3339")]
        added_at: OffsetDateTime,
    },
}

impl RoomEvent {
    pub fn room_id(&self) -> &str {
        match self {
            RoomEvent::RoomCreated { room_id, .. }
            | RoomEvent::ParticipantJoined { room_id, .. }
            | RoomEvent::ParticipantLeft { room_id, .. }
            | RoomEvent::ParticipantRenamed { room_id, .. }
            | RoomEvent::ParticipantRoleChanged { room_id, .. }
            | RoomEvent::TicketAdded { room_id, .. } => room_id,
        }
    }
}
