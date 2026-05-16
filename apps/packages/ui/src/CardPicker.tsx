import { cn } from "./components/utils";

const CARD_LABELS: Record<string, string> = {
  "?": "Unknown / unsure",
  "☕": "Coffee break needed",
};

function cardLabel(card: string): string {
  return CARD_LABELS[card] ?? `Vote ${card}`;
}

interface CardPickerProps {
  cards: string[];
  selected: string | null;
  onSelect: (card: string) => void;
  disabled?: boolean;
}

export function CardPicker({ cards, selected, onSelect, disabled }: CardPickerProps) {
  return (
    <div className="flex flex-wrap gap-3" role="group" aria-label="Vote card picker">
      {cards.map((card) => (
        <button
          key={card}
          type="button"
          role="radio"
          aria-checked={selected === card}
          aria-label={cardLabel(card)}
          onClick={() => !disabled && onSelect(card)}
          disabled={disabled}
          className={cn(
            "relative h-24 w-16 sm:h-28 sm:w-20 rounded-xl border-2 text-xl sm:text-2xl font-bold transition-all",
            "hover:scale-105 active:scale-95 hover:shadow-lg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            selected === card
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-lg scale-105"
              : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] hover:border-[hsl(var(--primary))]/50"
          )}
        >
          {card}
        </button>
      ))}
    </div>
  );
}
