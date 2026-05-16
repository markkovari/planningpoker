import type { TicketView } from "@planning-poker/api-types";
import React, { useState } from "react";

interface Props {
  tickets: TicketView[];
  onAdd: (title: string, description?: string) => void;
}

export function TicketQueue({ tickets, onAdd }: Props) {
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
    <div data-testid="ticket-queue" style={{ marginTop: 24 }}>
      <h3 style={{ marginBottom: 8 }}>Ticket Queue</h3>

      {tickets.length === 0 ? (
        <p style={{ color: "#888", fontSize: 14 }}>No tickets queued. Add one below.</p>
      ) : (
        <ol style={{ margin: "0 0 16px", paddingLeft: 20 }}>
          {tickets.map((t, i) => (
            <li key={t.id} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: i === 0 ? "bold" : "normal" }}>{t.title}</span>
              {i === 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, color: "#080" }}>← next</span>
              )}
              {t.description && (
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#555" }}>{t.description}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <form
        data-testid="add-ticket-form"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <input
          data-testid="ticket-title-input"
          placeholder="Ticket title"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          style={{ padding: 6, fontSize: 14 }}
        />
        <input
          data-testid="ticket-description-input"
          placeholder="Description (optional)"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
          style={{ padding: 6, fontSize: 14 }}
        />
        <button data-testid="add-ticket-btn" type="submit" style={{ padding: "6px 12px", fontSize: 14 }}>
          Add Ticket
        </button>
      </form>
    </div>
  );
}
