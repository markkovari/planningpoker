import type { ParticipantView, VoteView } from "@planning-poker/api-types";
import { Badge } from "./components/badge";
import { cn } from "./components/utils";

interface ParticipantListProps {
  participants: ParticipantView[];
  votes: VoteView[];
  revealed: boolean;
}

export function ParticipantList({ participants, votes, revealed }: ParticipantListProps) {
  const voteMap = new Map(votes.map((v) => [v.participant_id, v]));

  return (
    <ul data-testid="participant-list" className="space-y-2 p-0 m-0 list-none">
      {participants.map((p) => {
        const vote = voteMap.get(p.id);
        const hasVoted = vote?.has_voted ?? false;

        let badge: React.ReactNode;
        if (revealed && hasVoted) {
          badge = (
            <Badge variant="default" className="text-sm font-bold px-3 shrink-0">
              {vote?.card ?? "?"}
            </Badge>
          );
        } else if (hasVoted) {
          badge = <Badge variant="success" className="shrink-0">voted ✓</Badge>;
        } else {
          badge = <Badge variant="muted" className="shrink-0">waiting…</Badge>;
        }

        return (
          <li
            key={p.id}
            data-testid={`participant-${p.id}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-3 py-2.5",
              "border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            )}
          >
            <span data-testid={`participant-name-${p.id}`} className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
              <span className="font-medium text-sm truncate">{p.display_name}</span>
              {p.role === "Facilitator" ? (
                <Badge data-testid="facilitator-badge" variant="secondary" className="text-xs shrink-0">Facilitator</Badge>
              ) : (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">({p.role})</span>
              )}
            </span>
            <span data-testid={`participant-vote-${p.id}`}>{badge}</span>
          </li>
        );
      })}
    </ul>
  );
}
