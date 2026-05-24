use pp_domain::participant::Role;
use pp_domain::room::DeckType;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RoomEvent {
    RoomCreated {
        room_id: String,
        name: String,
        deck_type: DeckType,
        facilitator_id: String,
        created_at: u64,
    },
    ParticipantJoined {
        room_id: String,
        participant_id: String,
        display_name: String,
        role: Role,
        joined_at: u64,
    },
    ParticipantLeft {
        room_id: String,
        participant_id: String,
        left_at: u64,
    },
    ParticipantRenamed {
        room_id: String,
        participant_id: String,
        new_name: String,
        changed_at: u64,
    },
    ParticipantRoleChanged {
        room_id: String,
        participant_id: String,
        new_role: Role,
        changed_at: u64,
    },
    TicketAdded {
        room_id: String,
        ticket_id: String,
        title: String,
        description: Option<String>,
        added_at: u64,
    },
    JiraTicketImported {
        room_id: String,
        issue_key: String,
        summary: String,
        description: Option<String>,
        jira_base_url: String,
        imported_at: u64,
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
            | RoomEvent::TicketAdded { room_id, .. }
            | RoomEvent::JiraTicketImported { room_id, .. } => room_id,
        }
    }
}
