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
}

export interface TicketView {
  id: string;
  title: string;
  description: string | null;
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
  | { type: "CreateRoom"; name: string }
  | { type: "AddTicket"; room_id: string; title: string; description?: string }
  | { type: "JoinRoom"; room_id: string; participant_id: string; display_name: string }
  | { type: "CastVote"; room_id: string; session_id: string; card: string }
  | { type: "RetractVote"; room_id: string; session_id: string }
  | { type: "StartSession"; room_id: string; ticket_id?: string; ticket_description?: string }
  | { type: "RevealVotes"; room_id: string; session_id: string }
  | { type: "ResetSession"; room_id: string; session_id: string };

// ---- WebSocket: server → client ----

export type ServerMessage =
  | { type: "RoomCreated"; room_id: string; name: string }
  | { type: "RoomState"; room: RoomView }
  | { type: "EventApplied"; event: DomainEvent }
  | { type: "Error"; message: string };

// ---- Domain events (mirrors pp-events) ----

export type DomainEvent =
  | { aggregate: "Room"; event: RoomEvent }
  | { aggregate: "Session"; event: SessionEvent }
  | { aggregate: "Vote"; event: VoteEvent };

export type RoomEvent =
  | { type: "RoomCreated"; room_id: string; name: string; deck_type: DeckType; facilitator_id: string; created_at: string }
  | { type: "ParticipantJoined"; room_id: string; participant_id: string; display_name: string; role: Role; joined_at: string }
  | { type: "ParticipantLeft"; room_id: string; participant_id: string; left_at: string }
  | { type: "ParticipantRenamed"; room_id: string; participant_id: string; new_name: string; changed_at: string }
  | { type: "ParticipantRoleChanged"; room_id: string; participant_id: string; new_role: Role; changed_at: string };

export type SessionEvent =
  | { type: "SessionStarted"; session_id: string; room_id: string; ticket_id: string | null; ticket_description: string | null; started_at: string }
  | { type: "SessionEnded"; session_id: string; room_id: string; final_estimate: string | null; revealed_at: string }
  | { type: "SessionReset"; session_id: string; room_id: string; reset_at: string };

export type VoteEvent =
  | { type: "VoteCast"; session_id: string; room_id: string; participant_id: string; card: Card; cast_at: string }
  | { type: "VoteRetracted"; session_id: string; room_id: string; participant_id: string; retracted_at: string };
