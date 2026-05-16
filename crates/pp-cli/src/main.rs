use clap::{Parser, Subcommand};
use pp_events::{DomainEvent, RoomEvent, SessionEvent, VoteEvent};
use pp_store::{subjects::Subjects, EventStore, NatsEventStore};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "pp", about = "Planning Poker CLI")]
struct Cli {
    #[arg(long, env = "NATS_URL", default_value = "nats://localhost:4222")]
    nats_url: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new room
    RoomCreate {
        #[arg(long)]
        name: String,
        #[arg(long, default_value = "fibonacci")]
        deck: String,
    },
    /// Start an estimation session in a room
    SessionStart {
        #[arg(long)]
        room_id: String,
        #[arg(long)]
        ticket_id: Option<String>,
        #[arg(long)]
        description: Option<String>,
    },
    /// Cast a vote in the active session
    VoteCast {
        #[arg(long)]
        room_id: String,
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        participant_id: String,
        #[arg(long)]
        card: String,
    },
    /// Reveal votes and end the session
    Reveal {
        #[arg(long)]
        room_id: String,
        #[arg(long)]
        session_id: String,
    },
    /// Replay all events for a room
    Replay {
        #[arg(long)]
        room_id: String,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let store = NatsEventStore::connect(&cli.nats_url).await?;

    match cli.command {
        Commands::RoomCreate { name, deck } => {
            let room_id = Uuid::new_v4().to_string();
            let facilitator_id = Uuid::new_v4().to_string();
            let deck_type = match deck.as_str() {
                "tshirt" => pp_domain::room::DeckType::TShirt,
                _ => pp_domain::room::DeckType::Fibonacci,
            };
            let event = DomainEvent::Room(RoomEvent::RoomCreated {
                room_id: room_id.clone(),
                name,
                deck_type,
                facilitator_id,
                created_at: OffsetDateTime::now_utc(),
            });
            let subject = Subjects::room_created(&room_id);
            let envelope = store.publish(&subject, event).await?;
            println!("created room {room_id} (seq {})", envelope.sequence);
        }
        Commands::SessionStart {
            room_id,
            ticket_id,
            description,
        } => {
            let session_id = Uuid::new_v4().to_string();
            let event = DomainEvent::Session(SessionEvent::SessionStarted {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                ticket_id,
                ticket_description: description,
                started_at: OffsetDateTime::now_utc(),
            });
            let subject = Subjects::session_started(&room_id, &session_id);
            let envelope = store.publish(&subject, event).await?;
            println!("started session {session_id} (seq {})", envelope.sequence);
        }
        Commands::VoteCast {
            room_id,
            session_id,
            participant_id,
            card,
        } => {
            let parsed: pp_domain::Card = card.parse().map_err(|e: String| anyhow::anyhow!(e))?;
            let event = DomainEvent::Vote(VoteEvent::VoteCast {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                participant_id: participant_id.clone(),
                card: parsed,
                cast_at: OffsetDateTime::now_utc(),
            });
            let subject = Subjects::vote_cast(&room_id, &session_id, &participant_id);
            let envelope = store.publish(&subject, event).await?;
            println!("vote cast (seq {})", envelope.sequence);
        }
        Commands::Reveal {
            room_id,
            session_id,
        } => {
            let event = DomainEvent::Session(SessionEvent::SessionEnded {
                session_id: session_id.clone(),
                room_id: room_id.clone(),
                final_estimate: None,
                revealed_at: OffsetDateTime::now_utc(),
            });
            let subject = Subjects::session_ended(&room_id, &session_id);
            let envelope = store.publish(&subject, event).await?;
            println!("votes revealed (seq {})", envelope.sequence);
        }
        Commands::Replay { room_id } => {
            let filter = Subjects::room_all(&room_id);
            let events = store.replay(&filter).await?;
            println!("{} events for room {room_id}:", events.len());
            for e in events {
                println!("  [{}] seq={} {}", e.occurred_at, e.sequence, e.subject);
            }
        }
    }

    Ok(())
}
