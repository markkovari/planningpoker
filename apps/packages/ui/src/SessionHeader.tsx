import type { SessionView } from "@planning-poker/api-types";
import React from "react";

interface SessionHeaderProps {
  session: SessionView | null;
  onReveal?: () => void;
  onReset?: () => void;
}

export function SessionHeader({ session, onReveal, onReset }: SessionHeaderProps) {
  if (!session) return <p data-testid="no-session">No active session</p>;

  return (
    <div data-testid="session-header">
      <h2 data-testid="session-ticket">{session.ticket_id ?? "Estimation"}</h2>
      {session.ticket_description && <p>{session.ticket_description}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        {!session.revealed && (
          <button data-testid="reveal-btn" onClick={onReveal} style={{ padding: "8px 16px" }}>
            Reveal Votes
          </button>
        )}
        <button data-testid="reset-btn" onClick={onReset} style={{ padding: "8px 16px" }}>
          Reset
        </button>
      </div>
    </div>
  );
}
