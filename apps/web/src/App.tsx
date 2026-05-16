import { CardPicker, ParticipantList, SessionHeader, TicketQueue, VoteReveal } from "@planning-poker/ui";
import React, { useEffect, useState } from "react";
import { usePokerSocket } from "./usePokerSocket";

const WS_URL = "ws://localhost:8080/ws";

const FIBONACCI_CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];

export function App() {
  const { room, connected, error, createdRoomId, send } = usePokerSocket(WS_URL);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (createdRoomId) setRoomId(createdRoomId);
  }, [createdRoomId]);

  const participantId = React.useRef(crypto.randomUUID());

  const join = () => {
    if (!roomId || !displayName) return;
    send({
      type: "JoinRoom",
      room_id: roomId,
      participant_id: participantId.current,
      display_name: displayName,
    });
    setJoined(true);
  };

  const startSession = () => {
    if (!room) return;
    send({ type: "StartSession", room_id: room.id });
  };

  const castVote = (card: string) => {
    if (!room?.active_session) return;
    setSelectedCard(card);
    send({
      type: "CastVote",
      room_id: room.id,
      session_id: room.active_session.id,
      card,
    });
  };

  const reveal = () => {
    if (!room?.active_session) return;
    send({ type: "RevealVotes", room_id: room.id, session_id: room.active_session.id });
  };

  const reset = () => {
    if (!room?.active_session) return;
    setSelectedCard(null);
    send({ type: "ResetSession", room_id: room.id, session_id: room.active_session.id });
  };

  const addTicket = (title: string, description?: string) => {
    if (!room) return;
    send({ type: "AddTicket", room_id: room.id, title, description });
  };

  if (!joined) {
    return (
      <div data-testid="join-form" style={{ padding: 32, maxWidth: 400, margin: "0 auto" }}>
        <h1>Planning Poker</h1>

        <details style={{ marginBottom: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, color: "#555" }}>Create a new room</summary>
          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
            <input
              data-testid="room-name-input"
              placeholder="Room name"
              id="room-name"
              style={{ padding: 8, fontSize: 16, flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const name = (e.target as HTMLInputElement).value.trim();
                  if (name) send({ type: "CreateRoom", name });
                }
              }}
            />
            <button
              data-testid="create-room-btn"
              style={{ padding: "8px 12px", fontSize: 14 }}
              onClick={() => {
                const input = document.getElementById("room-name") as HTMLInputElement;
                const name = input?.value.trim();
                if (name) send({ type: "CreateRoom", name });
              }}
            >
              Create
            </button>
          </div>
          {createdRoomId && (
            <p style={{ fontSize: 13, color: "#080", marginTop: 4 }}>
              Room created! ID copied to field below.
            </p>
          )}
        </details>

        <form
          onSubmit={(e) => { e.preventDefault(); join(); }}
          style={{ display: "flex", flexDirection: "column", gap: 8 }}
        >
          <input
            data-testid="room-id-input"
            placeholder="Room ID"
            value={roomId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value)}
            style={{ padding: 8, fontSize: 16 }}
          />
          <input
            data-testid="name-input"
            placeholder="Your name"
            value={displayName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
            style={{ padding: 8, fontSize: 16 }}
          />
          <button data-testid="join-btn" type="submit" style={{ padding: 10, fontSize: 16 }}>
            Join Room
          </button>
        </form>
        <p data-testid="connection-status" style={{ color: connected ? "green" : "red" }}>
          {connected ? "Connected" : "Disconnected"}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="room-view" style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1 data-testid="room-heading">Room: {room?.name ?? roomId}</h1>
      {!connected && (
        <p style={{ color: "orange", fontWeight: "bold" }}>Reconnecting…</p>
      )}
      {error && connected && <p data-testid="error-msg" style={{ color: "red" }}>{error}</p>}

      {room && !room.active_session && (
        <button data-testid="start-session-btn" onClick={startSession} style={{ padding: "8px 16px", marginBottom: 16 }}>
          Start Session
        </button>
      )}

      <SessionHeader
        session={room?.active_session ?? null}
        onReveal={reveal}
        onReset={reset}
      />

      {room && (
        <ParticipantList
          participants={room.participants}
          votes={room.active_session?.votes ?? []}
          revealed={room.active_session?.revealed ?? false}
        />
      )}

      {room && !room.active_session && (
        <TicketQueue tickets={room.ticket_queue} onAdd={addTicket} />
      )}

      {room?.active_session && !room.active_session.revealed && (
        <div data-testid="card-picker" style={{ marginTop: 24 }}>
          <h3>Your vote</h3>
          <CardPicker
            cards={FIBONACCI_CARDS}
            selected={selectedCard}
            onSelect={castVote}
          />
        </div>
      )}

      {room?.active_session?.revealed && (
        <div data-testid="vote-reveal" style={{ marginTop: 24 }}>
          <VoteReveal votes={room.active_session.votes} />
        </div>
      )}
    </div>
  );
}
