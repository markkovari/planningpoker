use pp_events::{DomainEvent, EventEnvelope};
use serde_json;
use worker::{D1Database, Result};

pub struct DoEventStore<'a> {
    db: &'a D1Database,
    room_id: &'a str,
}

impl<'a> DoEventStore<'a> {
    pub fn new(db: &'a D1Database, room_id: &'a str) -> Self {
        Self { db, room_id }
    }

    pub async fn init_schema(&self) -> Result<()> {
        self.db
            .exec(
                "CREATE TABLE IF NOT EXISTS events (
                    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id    TEXT NOT NULL UNIQUE,
                    room_id     TEXT NOT NULL,
                    subject     TEXT NOT NULL,
                    payload     TEXT NOT NULL,
                    occurred_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_events_room ON events(room_id, seq);",
            )
            .await?;
        Ok(())
    }

    pub async fn append(
        &self,
        event_id: &str,
        subject: &str,
        event: &DomainEvent,
        occurred_at: u64,
    ) -> Result<()> {
        let payload = serde_json::to_string(event)
            .map_err(|e| worker::Error::RustError(e.to_string()))?;
        self.db
            .prepare(
                "INSERT INTO events (event_id, room_id, subject, payload, occurred_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(&[
                event_id.into(),
                self.room_id.into(),
                subject.into(),
                payload.as_str().into(),
                (occurred_at as f64).into(),
            ])?
            .run()
            .await?;
        Ok(())
    }

    pub async fn replay(&self) -> Result<Vec<EventEnvelope>> {
        #[derive(serde::Deserialize)]
        struct Row {
            event_id: String,
            seq: u64,
            subject: String,
            payload: String,
            occurred_at: f64,
        }

        let rows = self
            .db
            .prepare(
                "SELECT event_id, seq, subject, payload, occurred_at
                 FROM events WHERE room_id = ?1 ORDER BY seq ASC",
            )
            .bind(&[self.room_id.into()])?
            .all()
            .await?
            .results::<Row>()
            .map_err(|e| worker::Error::RustError(e.to_string()))?;

        let mut envelopes = Vec::with_capacity(rows.len());
        for row in rows {
            let payload: DomainEvent = serde_json::from_str(&row.payload)
                .map_err(|e| worker::Error::RustError(e.to_string()))?;
            envelopes.push(EventEnvelope {
                id: row.event_id,
                sequence: row.seq,
                subject: row.subject,
                payload,
                occurred_at: row.occurred_at as u64,
            });
        }
        Ok(envelopes)
    }
}
