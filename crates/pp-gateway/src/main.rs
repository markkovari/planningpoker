mod ws;

use axum::{extract::State, response::Json, routing::get, Router};
use std::net::SocketAddr;
use dashmap::DashMap;
use pp_projection::room_view::RoomProjection;
use pp_store::{EventStore, NatsEventStore};
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

pub type RoomBus = Arc<DashMap<String, broadcast::Sender<String>>>;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<NatsEventStore>,
    pub projection: Arc<RoomProjection>,
    pub room_bus: RoomBus,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let nats_url = std::env::var("NATS_URL").unwrap_or_else(|_| "nats://localhost:4222".into());
    info!("connecting to NATS at {nats_url}");

    let store = Arc::new(NatsEventStore::connect(&nats_url).await?);
    let projection = Arc::new(RoomProjection::new());
    let room_bus: RoomBus = Arc::new(DashMap::new());

    // Replay all persisted events into the projection before accepting traffic.
    match store.replay(pp_store::subjects::STREAM_FILTER).await {
        Ok(envelopes) => {
            info!("replaying {} events into projection", envelopes.len());
            for env in envelopes {
                projection.apply(&env.payload);
            }
        }
        Err(e) => warn!("event replay failed (cold start): {e}"),
    }

    let state = AppState {
        store,
        projection,
        room_bus,
    };

    // HTTP-level rate limiting: 60 new requests/second per IP, burst of 100.
    // Applies to new HTTP connections and WS upgrade handshakes.
    // Per-message rate limiting (10 msg/s, burst 20) is enforced inside each WS connection.
    // If deployed behind a reverse proxy, swap PeerIpKeyExtractor for SmartIpKeyExtractor
    // and ensure the proxy sets X-Forwarded-For / X-Real-IP.
    let rate_limit_config = GovernorConfigBuilder::default()
        .const_per_second(60)
        .const_burst_size(100)
        .finish()
        .expect("valid rate limit config");

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws::handler))
        .layer(GovernorLayer::new(rate_limit_config))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = "0.0.0.0:8080";
    info!("listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await?;
    Ok(())
}

async fn health(State(_state): State<AppState>) -> Json<Value> {
    Json(json!({ "status": "ok" }))
}
