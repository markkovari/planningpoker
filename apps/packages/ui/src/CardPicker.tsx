import React from "react";

interface CardPickerProps {
  cards: string[];
  selected: string | null;
  onSelect: (card: string) => void;
  disabled?: boolean;
}

export function CardPicker({ cards, selected, onSelect, disabled }: CardPickerProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {cards.map((card) => (
        <button
          key={card}
          onClick={() => !disabled && onSelect(card)}
          disabled={disabled}
          style={{
            padding: "12px 20px",
            fontSize: 18,
            fontWeight: selected === card ? "bold" : "normal",
            border: selected === card ? "2px solid #2563eb" : "2px solid #d1d5db",
            borderRadius: 8,
            cursor: disabled ? "not-allowed" : "pointer",
            background: selected === card ? "#eff6ff" : "#fff",
          }}
        >
          {card}
        </button>
      ))}
    </div>
  );
}
