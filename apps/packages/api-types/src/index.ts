// ---- Domain value types ----

export type DeckType = "Fibonacci" | "TShirt";
export type Role = "Facilitator" | "Voter" | "Observer";

export type Card =
  | { Fibonacci: string }
  | { TShirt: string };

// ---- Read model (mirrors pp-projection::RoomView) ----

export interface ParticipantView {
  id: string;
  display_name: string;
  role: Role;
}

export interface VoteView {
  participant_id: string;
  card: string | null;
  has_voted: boolean;
}

export interface SessionView {
  id: string;
  ticket_id: string | null;
  ticket_description: string | null;
  revealed: boolean;
  votes: VoteView[];
  final_estimate: string | null;
  /** Jira issue key (e.g. "PROJ-123") if this session was started from a Jira ticket. */
  jira_issue_key: string | null;
  /** Status of story-points push after session ends. */
  jira_push_status: "pending" | "pushed" | "failed" | null;
}

export interface TicketView {
  id: string;
  title: string;
  description: string | null;
  /** Jira issue key if imported from Jira (e.g. "PROJ-123"). */
  jira_issue_key: string | null;
  /** Full URL to the Jira issue. */
  jira_url: string | null;
}

export interface RoomView {
  id: string;
  name: string;
  deck_type: DeckType;
  participants: ParticipantView[];
  active_session: SessionView | null;
  ticket_queue: TicketView[];
}

// ---- WebSocket: client → server ----

export type ClientMessage =
  | { type: "CreateRoom"; name: string; deck_type?: DeckType }
  | { type: "AddTicket"; room_id: string; title: string; description?: string }
  | { type: "JoinRoom"; room_id: string; participant_id: string; display_name: string }
  | { type: "CastVote"; room_id: string; session_id: string; card: string }
  | { type: "RetractVote"; room_id: string; session_id: string }
  | { type: "StartSession"; room_id: string; ticket_id?: string; ticket_description?: string; countdown_secs?: number }
  | { type: "RevealVotes"; room_id: string; session_id: string }
  | { type: "ResetSession"; room_id: string; session_id: string }
  | {
      type: "LinkJiraProject";
      room_id: string;
      jira_base_url: string;
      jira_project_key: string;
      jira_email: string;
      jira_api_token: string;
    }
  | { type: "ImportJiraTickets"; room_id: string };

// ---- WebSocket: server → client ----

export type ServerMessage =
  | { type: "RoomCreated"; room_id: string; name: string }
  | { type: "RoomState"; room: RoomView }
  | { type: "EventApplied"; event: DomainEvent }
  | { type: "Error"; message: string }
  | { type: "CountdownTick"; room_id: string; session_id: string; remaining_secs: number }
  | { type: "JiraLinked"; project_key: string; ticket_count: number }
  | { type: "JiraSyncStatus"; session_id: string; issue_key: string; status: "pushed" | "failed" | "skipped" };

// ---- Domain events (mirrors pp-events) ----

export type DomainEvent =
  | { aggregate: "Room"; event: RoomEvent }
  | { aggregate: "Session"; event: SessionEvent }
  | { aggregate: "Vote"; event: VoteEvent };

export type RoomEvent =
  | { type: "RoomCreated"; room_id: string; name: string; deck_type: DeckType; facilitator_id: string; created_at: number }
  | { type: "ParticipantJoined"; room_id: string; participant_id: string; display_name: string; role: Role; joined_at: number }
  | { type: "ParticipantLeft"; room_id: string; participant_id: string; left_at: number }
  | { type: "ParticipantRenamed"; room_id: string; participant_id: string; new_name: string; changed_at: number }
  | { type: "ParticipantRoleChanged"; room_id: string; participant_id: string; new_role: Role; changed_at: number }
  | { type: "TicketAdded"; room_id: string; ticket_id: string; title: string; description: string | null; added_at: number }
  | { type: "JiraTicketImported"; room_id: string; issue_key: string; summary: string; description: string | null; jira_base_url: string; imported_at: number };

export type SessionEvent =
  | { type: "SessionStarted"; session_id: string; room_id: string; ticket_id: string | null; ticket_description: string | null; started_at: number }
  | { type: "SessionEnded"; session_id: string; room_id: string; final_estimate: string | null; revealed_at: number }
  | { type: "SessionReset"; session_id: string; room_id: string; reset_at: number };

export type VoteEvent =
  | { type: "VoteCast"; session_id: string; room_id: string; participant_id: string; card: Card; cast_at: number }
  | { type: "VoteRetracted"; session_id: string; room_id: string; participant_id: string; retracted_at: number };
