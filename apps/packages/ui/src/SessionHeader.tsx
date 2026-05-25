import type { SessionView } from "@planning-poker/api-types";
import { Button } from "./components/button";
import { Badge } from "./components/badge";

interface SessionHeaderProps {
  session: SessionView | null;
  onReveal: () => void;
  onReset: () => void;
  isFacilitator?: boolean;
}

export function SessionHeader({ session, onReveal, onReset, isFacilitator = false }: SessionHeaderProps) {
  if (!session) return (
    <p data-testid="no-session" className="text-sm text-[hsl(var(--muted-foreground))] italic">
      No active session
    </p>
  );

  return (
    <div data-testid="session-header" className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <h2 data-testid="session-ticket" className="text-xl font-semibold break-words">
            {session.ticket_id ?? "Estimation"}
          </h2>
          {session.ticket_description && (
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              {session.ticket_description}
            </p>
          )}
        </div>
        {session.revealed && (
          <Badge variant="secondary" className="self-start shrink-0">Revealed</Badge>
        )}
      </div>
      {!session.revealed && (
        <div className="flex flex-wrap gap-2">
          <Button data-testid="reveal-btn" onClick={onReveal} size="sm" className="flex-1 sm:flex-none" disabled={!isFacilitator}>
            Reveal Votes
          </Button>
          <Button data-testid="reset-btn" onClick={onReset} variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={!isFacilitator}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
