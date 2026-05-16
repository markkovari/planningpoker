/// NATS JetStream stream name.
pub const STREAM_NAME: &str = "PLANNING_POKER";

/// All planning poker subjects match this filter.
pub const STREAM_FILTER: &str = "pp.>";

pub struct Subjects;

impl Subjects {
    pub fn room_created(room_id: &str) -> String {
        format!("pp.room.{room_id}.created")
    }

    pub fn participant_joined(room_id: &str) -> String {
        format!("pp.room.{room_id}.joined")
    }

    pub fn participant_left(room_id: &str) -> String {
        format!("pp.room.{room_id}.left")
    }

    pub fn participant_renamed(room_id: &str) -> String {
        format!("pp.room.{room_id}.renamed")
    }

    pub fn participant_role_changed(room_id: &str) -> String {
        format!("pp.room.{room_id}.role_changed")
    }

    pub fn session_started(room_id: &str, session_id: &str) -> String {
        format!("pp.session.{room_id}.{session_id}.started")
    }

    pub fn session_ended(room_id: &str, session_id: &str) -> String {
        format!("pp.session.{room_id}.{session_id}.ended")
    }

    pub fn session_reset(room_id: &str, session_id: &str) -> String {
        format!("pp.session.{room_id}.{session_id}.reset")
    }

    pub fn vote_cast(room_id: &str, session_id: &str, participant_id: &str) -> String {
        format!("pp.vote.{room_id}.{session_id}.{participant_id}.cast")
    }

    pub fn vote_retracted(room_id: &str, session_id: &str, participant_id: &str) -> String {
        format!("pp.vote.{room_id}.{session_id}.{participant_id}.retracted")
    }

    pub fn ticket_added(room_id: &str, ticket_id: &str) -> String {
        format!("pp.room.{room_id}.ticket.{ticket_id}.added")
    }

    /// Subscribe to all events in a room.
    pub fn room_all(room_id: &str) -> String {
        format!("pp.room.{room_id}.>")
    }
}
