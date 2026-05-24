-- D1 global schema for planning-poker Worker
-- Apply: wrangler d1 execute planning-poker --file migrations/d1/schema.sql

CREATE TABLE IF NOT EXISTS rooms (
    room_id          TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    deck_type        TEXT NOT NULL DEFAULT 'Fibonacci',
    jira_project_key TEXT,
    jira_base_url    TEXT,
    created_at       INTEGER NOT NULL,
    last_active_at   INTEGER,
    expires_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS jira_tickets (
    issue_key    TEXT NOT NULL,
    project_key  TEXT NOT NULL,
    summary      TEXT NOT NULL,
    description  TEXT,
    story_points REAL,
    fetched_at   INTEGER NOT NULL,
    PRIMARY KEY (issue_key, project_key)
);

CREATE TABLE IF NOT EXISTS completed_sessions (
    session_id           TEXT PRIMARY KEY,
    room_id              TEXT NOT NULL,
    ticket_id            TEXT,
    final_estimate       TEXT,
    jira_issue_key       TEXT,
    jira_push_status     TEXT NOT NULL DEFAULT 'pending',
    jira_push_attempts   INTEGER NOT NULL DEFAULT 0,
    completed_at         INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- Events table used by the Durable Object (one DB per region, shared across DOs)
-- For lower latency consider migrating to DO-local SQLite storage in production.
CREATE TABLE IF NOT EXISTS events (
    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    TEXT NOT NULL UNIQUE,
    room_id     TEXT NOT NULL,
    subject     TEXT NOT NULL,
    payload     TEXT NOT NULL,
    occurred_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_expires      ON rooms(expires_at);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_proj  ON jira_tickets(project_key, story_points);
CREATE INDEX IF NOT EXISTS idx_sessions_room      ON completed_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jira_status ON completed_sessions(jira_push_status);
CREATE INDEX IF NOT EXISTS idx_events_room        ON events(room_id, seq);
