use crate::subjects::{STREAM_FILTER, STREAM_NAME};
use crate::{EventStore, StoreError};
use async_nats::jetstream::{self, stream::Config as StreamConfig};
use pp_events::{DomainEvent, EventEnvelope};
use std::time::Duration;
use tracing::instrument;
use uuid::Uuid;

/// Events older than this are purged from the stream — rooms become unreachable after this window.
const ROOM_MAX_AGE: Duration = Duration::from_secs(24 * 60 * 60);

pub struct NatsEventStore {
    js: jetstream::Context,
}

impl NatsEventStore {
    pub async fn connect(nats_url: &str) -> Result<Self, StoreError> {
        let client = async_nats::connect(nats_url)
            .await
            .map_err(|e| StoreError::Nats(Box::new(e)))?;
        let js = jetstream::new(client);

        let mut stream = js
            .get_or_create_stream(StreamConfig {
                name: STREAM_NAME.to_string(),
                subjects: vec![STREAM_FILTER.to_string()],
                max_age: ROOM_MAX_AGE,
                ..Default::default()
            })
            .await
            .map_err(|e| StoreError::Stream(e.to_string()))?;

        // Enforce max_age on pre-existing streams (get_or_create does not update config).
        let info = stream.info().await.map_err(|e| StoreError::Stream(e.to_string()))?;
        if info.config.max_age != ROOM_MAX_AGE {
            let updated = StreamConfig {
                max_age: ROOM_MAX_AGE,
                ..info.config.clone()
            };
            js.update_stream(updated)
                .await
                .map_err(|e| StoreError::Stream(e.to_string()))?;
        }

        Ok(Self { js })
    }
}

#[async_trait::async_trait]
impl EventStore for NatsEventStore {
    #[instrument(skip(self, event))]
    async fn publish(
        &self,
        subject: &str,
        event: DomainEvent,
    ) -> Result<EventEnvelope, StoreError> {
        let envelope = EventEnvelope {
            id: Uuid::new_v4().to_string(),
            sequence: 0, // filled after ack
            subject: subject.to_string(),
            payload: event,
            occurred_at: time::OffsetDateTime::now_utc(),
        };

        let bytes = serde_json::to_vec(&envelope)?;
        let ack = self
            .js
            .publish(subject.to_string(), bytes.into())
            .await
            .map_err(|e| StoreError::Publish(e.to_string()))?
            .await
            .map_err(|e| StoreError::Publish(e.to_string()))?;

        Ok(EventEnvelope {
            sequence: ack.sequence,
            ..envelope
        })
    }

    #[instrument(skip(self))]
    async fn replay(&self, subject_filter: &str) -> Result<Vec<EventEnvelope>, StoreError> {
        let consumer = self
            .js
            .create_consumer_on_stream(
                jetstream::consumer::pull::Config {
                    filter_subject: subject_filter.to_string(),
                    // Auto-delete consumer after 5s inactivity so they don't accumulate.
                    inactive_threshold: Duration::from_secs(5),
                    ..Default::default()
                },
                STREAM_NAME,
            )
            .await
            .map_err(|e| StoreError::Stream(e.to_string()))?;

        let mut messages = consumer
            .fetch()
            .max_messages(10_000)
            .expires(Duration::from_secs(5))
            .messages()
            .await
            .map_err(|e| StoreError::Stream(e.to_string()))?;

        let mut events = Vec::new();
        use futures_util::StreamExt;
        while let Some(Ok(msg)) = messages.next().await {
            let envelope: EventEnvelope = serde_json::from_slice(&msg.payload)?;
            let _ = msg.ack().await;
            events.push(envelope);
        }

        Ok(events)
    }
}
