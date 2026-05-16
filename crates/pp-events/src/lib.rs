pub mod room;
pub mod session;
pub mod vote;

pub use room::RoomEvent;
pub use session::SessionEvent;
pub use vote::VoteEvent;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "aggregate", content = "event")]
pub enum DomainEvent {
    Room(RoomEvent),
    Session(SessionEvent),
    Vote(VoteEvent),
}

/// Envelope written to / read from NATS JetStream.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub id: String,
    pub sequence: u64,
    pub subject: String,
    pub payload: DomainEvent,
    #[serde(with = "time::serde::rfc3339")]
    pub occurred_at: time::OffsetDateTime,
}
