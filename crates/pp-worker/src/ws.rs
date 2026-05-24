use pp_domain::room::DeckType;
use pp_projection::RoomView;
use serde::{Deserialize, Serialize};

/// Messages the browser sends to the Durable Object.
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    CreateRoom {
        name: String,
        deck_type: Option<DeckType>,
    },
    JoinRoom {
        room_id: String,
        participant_id: String,
        display_name: String,
    },
    AddTicket {
        room_id: String,
        title: String,
        description: Option<String>,
    },
    StartSession {
        room_id: String,
        ticket_id: Option<String>,
        ticket_description: Option<String>,
        countdown_secs: Option<u32>,
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
    RevealVotes {
        room_id: String,
        session_id: String,
    },
    ResetSession {
        room_id: String,
        session_id: String,
    },
    LinkJiraProject {
        room_id: String,
        jira_base_url: String,
        jira_project_key: String,
        jira_email: String,
        jira_api_token: String,
    },
    ImportJiraTickets {
        room_id: String,
    },
}

/// Messages the Durable Object pushes to the browser.
#[derive(Debug, Serialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    RoomCreated {
        room_id: String,
        name: String,
    },
    RoomState {
        room: Box<RoomView>,
    },
    Error {
        message: String,
    },
    CountdownTick {
        room_id: String,
        session_id: String,
        remaining_secs: u32,
    },
    JiraLinked {
        project_key: String,
        ticket_count: u32,
    },
    JiraSyncStatus {
        session_id: String,
        issue_key: String,
        status: String,
    },
}

impl ServerMessage {
    pub fn error(msg: impl Into<String>) -> Self {
        Self::Error {
            message: msg.into(),
        }
    }

    pub fn room_state(room: RoomView) -> Self {
        Self::RoomState {
            room: Box::new(room),
        }
    }
}

/// Tag serialized into the WebSocket attachment for per-connection identity.
#[derive(Debug, Serialize, Deserialize)]
pub struct ConnTag {
    pub participant_id: String,
    pub room_id: String,
}
