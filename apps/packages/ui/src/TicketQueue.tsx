import type { TicketView } from "@planning-poker/api-types";
import React, { useState } from "react";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { Badge } from "./components/badge";
import { cn } from "./components/utils";

interface Props {
  tickets: TicketView[];
  onAdd: (title: string, description?: string) => void;
  activeTicketId?: string | null;
  activeTicketTitle?: string | null;
}

export function TicketQueue({ tickets, onAdd, activeTicketId, activeTicketTitle }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAdd(t, description.trim() || undefined);
    setTitle("");
    setDescription("");
  };

  return (
    <div data-testid="ticket-queue" className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold">Ticket Queue</h3>
        {tickets.length > 0 && (
          <Badge variant="secondary">{tickets.length}</Badge>
        )}
      </div>

      {/* Currently voting ticket */}
      {(activeTicketId || activeTicketTitle) && (
        <div className="rounded-md border border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-3 py-2.5 space-y-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">
              {activeTicketTitle ?? activeTicketId ?? "Estimation"}
            </p>
            <Badge variant="default" className="shrink-0 text-xs">voting now</Badge>
          </div>
        </div>
      )}

      {tickets.length === 0 && !activeTicketId && !activeTicketTitle ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] italic">
          No tickets queued. Add one below.
        </p>
      ) : tickets.length > 0 ? (
        <ol className="space-y-2 list-none p-0">
          {tickets.map((t, i) => {
            const isCurrent = t.id === activeTicketId;
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-md border px-3 py-2.5",
                  isCurrent
                    ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10"
                    : i === 0 && !activeTicketId
                    ? "border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/5"
                    : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-[hsl(var(--muted-foreground))] shrink-0 w-5 text-right">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", isCurrent || (i === 0 && !activeTicketId) ? "font-semibold" : "font-normal")}>
                      {t.title}
                    </p>
                    {t.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                </div>
                {isCurrent && (
                  <Badge variant="default" className="ml-1 shrink-0 text-xs">now</Badge>
                )}
                {!isCurrent && i === 0 && !activeTicketId && (
                  <Badge variant="secondary" className="ml-1 shrink-0 text-xs">next</Badge>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      <form
        data-testid="add-ticket-form"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="space-y-2"
      >
        <Input
          data-testid="ticket-title-input"
          placeholder="Ticket title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
        />
        <Input
          data-testid="ticket-description-input"
          placeholder="Description (optional)"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        />
        <Button data-testid="add-ticket-btn" type="submit" variant="outline" size="sm" className="w-full">
          Add Ticket
        </Button>
      </form>
    </div>
  );
}
