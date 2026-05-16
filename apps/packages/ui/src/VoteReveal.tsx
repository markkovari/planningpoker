import type { VoteView } from "@planning-poker/api-types";
import { Card, CardContent } from "./components/card";
import { Button } from "./components/button";
import { Badge } from "./components/badge";

interface VoteRevealProps {
  votes: VoteView[];
  onStartNew?: () => void;
  onReset?: () => void;
}

const NUMERIC = /^\d+(\.\d+)?$/;

function parseNum(card: string): number | null {
  if (NUMERIC.test(card)) return parseFloat(card);
  const fib: Record<string, number> = { "½": 0.5 };
  return fib[card] ?? null;
}

export function VoteReveal({ votes, onStartNew, onReset }: VoteRevealProps) {
  const counts = new Map<string, number>();
  for (const v of votes) {
    if (v.card) counts.set(v.card, (counts.get(v.card) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = votes.filter((v) => v.card).length;

  const numericVotes = votes.flatMap((v) => {
    const n = v.card ? parseNum(v.card) : null;
    return n !== null ? [n] : [];
  });

  const hasNumeric = numericVotes.length > 0;
  const min = hasNumeric ? Math.min(...numericVotes) : null;
  const max = hasNumeric ? Math.max(...numericVotes) : null;
  const avg = hasNumeric ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length : null;
  const consensus = sorted.length === 1 || (sorted[0]?.[1] === total && total > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold">Results</h3>
        {consensus && total > 0 && (
          <Badge variant="secondary" className="text-[hsl(var(--success))] border-[hsl(var(--success))]">
            Consensus!
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {sorted.map(([card, count]) => (
          <Card key={card} className="min-w-[64px] sm:min-w-[72px] text-center">
            <CardContent className="p-3">
              <div className="text-2xl sm:text-3xl font-bold">{card}</div>
              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                {count} vote{count !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasNumeric && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-md bg-[hsl(var(--muted))] py-2">
            <div className="font-semibold">{min}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Min</div>
          </div>
          <div className="rounded-md bg-[hsl(var(--muted))] py-2">
            <div className="font-semibold">{avg?.toFixed(1)}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Avg</div>
          </div>
          <div className="rounded-md bg-[hsl(var(--muted))] py-2">
            <div className="font-semibold">{max}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">Max</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {onStartNew && (
          <Button data-testid="start-new-btn" onClick={onStartNew} className="flex-1 sm:flex-none">
            Vote on new ticket
          </Button>
        )}
        {onReset && (
          <Button data-testid="reset-from-reveal-btn" onClick={onReset} variant="outline" className="flex-1 sm:flex-none">
            Re-vote this ticket
          </Button>
        )}
      </div>
    </div>
  );
}
