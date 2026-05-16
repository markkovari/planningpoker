import type { Meta, StoryObj } from "@storybook/react";
import { Timer } from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { cn } from "./utils";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Card>;

type DeckType = "Fibonacci" | "TShirt";

export const CreateRoom: Story = {
  render: () => {
    const [name, setName] = useState("");
    const [deck, setDeck] = useState<DeckType>("Fibonacci");
    const [countdownSecs, setCountdownSecs] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Create a new room</CardTitle>
          <CardDescription>Set up a new planning poker session</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="room-name">Room name</Label>
              <Input
                id="room-name"
                placeholder="Sprint 42 Planning"
                required
                minLength={2}
                value={name}
                onChange={(e) => { setName(e.target.value); setSubmitted(false); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Deck type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["Fibonacci", "TShirt"] as DeckType[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDeck(d)}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                      deck === d
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                    )}
                  >
                    {d === "Fibonacci" ? "Fibonacci" : "T-Shirt"}
                    <span className="block text-xs font-normal text-[hsl(var(--muted-foreground))]">
                      {d === "Fibonacci" ? "1, 2, 3, 5, 8…" : "XS, S, M, L…"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" />
                Countdown timer
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[0, 30, 60, 90].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCountdownSecs(s)}
                    className={cn(
                      "rounded-md border py-2 text-sm font-medium transition-colors",
                      countdownSecs === s
                        ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                        : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
                    )}
                  >
                    {s === 0 ? "Off" : `${s}s`}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={!name.trim()}>
              Create Room
            </Button>
            {submitted && (
              <p className="text-xs text-emerald-600 text-center">Room created!</p>
            )}
          </form>
        </CardContent>
      </Card>
    );
  },
};

export const JoinRoom: Story = {
  render: () => {
    const [roomId, setRoomId] = useState("");
    const [name, setName] = useState("");

    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Join a room</CardTitle>
          <CardDescription>Enter a room ID to join the session</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="room-id">Room ID</Label>
              <Input
                id="room-id"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-name">Your name</Label>
              <Input
                id="display-name"
                placeholder="Alice"
                required
                minLength={1}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!roomId.trim() || !name.trim()}
            >
              Join Room
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  },
};
