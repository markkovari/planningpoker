pub mod nats;
pub mod subjects;

use pp_events::{DomainEvent, EventEnvelope};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("NATS error: {0}")]
    Nats(#[from] async_nats::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("publish error: {0}")]
    Publish(String),
    #[error("stream error: {0}")]
    Stream(String),
}

#[async_trait::async_trait]
pub trait EventStore: Send + Sync {
    async fn publish(&self, subject: &str, event: DomainEvent)
        -> Result<EventEnvelope, StoreError>;
    async fn replay(&self, subject_filter: &str) -> Result<Vec<EventEnvelope>, StoreError>;
}

pub use nats::NatsEventStore;
pub use subjects::Subjects;
