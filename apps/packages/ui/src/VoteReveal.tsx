import type { VoteView } from "@planning-poker/api-types";
import React from "react";

interface VoteRevealProps {
  votes: VoteView[];
}

export function VoteReveal({ votes }: VoteRevealProps) {
  const counts = new Map<string, number>();
  for (const v of votes) {
    if (v.card) {
      counts.set(v.card, (counts.get(v.card) ?? 0) + 1);
    }
  }

  return (
    <div>
      <h3>Results</h3>
      <div style={{ display: "flex", gap: 16 }}>
        {[...counts.entries()].map(([card, count]) => (
          <div key={card} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>{card}</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>{count} vote{count !== 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
