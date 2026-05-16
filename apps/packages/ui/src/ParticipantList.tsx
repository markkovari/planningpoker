import type { ParticipantView, VoteView } from "@planning-poker/api-types";
import React from "react";

interface ParticipantListProps {
  participants: ParticipantView[];
  votes: VoteView[];
  revealed: boolean;
}

export function ParticipantList({ participants, votes, revealed }: ParticipantListProps) {
  const voteMap = new Map(votes.map((v) => [v.participant_id, v]));

  return (
    <ul data-testid="participant-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {participants.map((p) => {
        const vote = voteMap.get(p.id);
        const hasVoted = vote?.has_voted ?? false;

        let badge: React.ReactNode;
        if (revealed && hasVoted) {
          badge = (
            <span style={{
              background: "#1a73e8", color: "#fff",
              borderRadius: 4, padding: "2px 10px", fontWeight: "bold", fontSize: 15,
            }}>
              {vote?.card ?? "?"}
            </span>
          );
        } else if (hasVoted) {
          badge = (
            <span style={{
              background: "#34a853", color: "#fff",
              borderRadius: 4, padding: "2px 10px", fontSize: 13,
            }}>
              voted ✓
            </span>
          );
        } else {
          badge = (
            <span style={{
              background: "#f1f3f4", color: "#888",
              borderRadius: 4, padding: "2px 10px", fontSize: 13,
            }}>
              waiting…
            </span>
          );
        }

        return (
          <li
            key={p.id}
            data-testid={`participant-${p.id}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0", borderBottom: "1px solid #f0f0f0",
            }}
          >
            <span data-testid={`participant-name-${p.id}`} style={{ fontSize: 15 }}>
              {p.display_name}
              <span style={{ fontSize: 12, color: "#aaa", marginLeft: 6 }}>({p.role})</span>
            </span>
            <span data-testid={`participant-vote-${p.id}`}>{badge}</span>
          </li>
        );
      })}
    </ul>
  );
}
