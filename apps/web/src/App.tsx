import type { DeckType } from "@planning-poker/api-types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardPicker,
  Input,
  Label,
  ParticipantList,
  Separator,
  SessionHeader,
  TicketQueue,
  VoteReveal,
  cn,
} from "@planning-poker/ui";
import { Check, Link, Monitor, Moon, Sun, Timer, Users, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import React, { useCallback, useEffect, useRef, useState } from "react";

const SESSION_KEY = "pp_last_session";
import { usePokerSocket } from "./usePokerSocket";

const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

const FIBONACCI_CARDS = ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?", "☕"];
const TSHIRT_CARDS = ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"];

type Theme = "system" | "light" | "dark";
const THEME_CYCLE: Theme[] = ["system", "light", "dark"];
const THEME_ICONS: Record<Theme, React.ReactNode> = {
  system: <Monitor className="h-4 w-4" />,
  light:  <Sun className="h-4 w-4" />,
  dark:   <Moon className="h-4 w-4" />,
};
const THEME_LABELS: Record<Theme, string> = {
  system: "System",
  light:  "Light",
  dark:   "Dark",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current = (THEME_CYCLE.includes(theme as Theme) ? theme : "system") as Theme;
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${THEME_LABELS[current]}`}
    >
      {THEME_ICONS[current]}
    </Button>
  );
}

function useCopyToClipboard(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
    });
  }, [timeoutMs]);
  return { copied, copy };
}

function inviteUrl(roomId: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("room", roomId);
  return url.toString();
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      {children}
    </div>
  );
}

function loadLastSession(): { roomId: string; displayName: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { roomId: string; displayName: string }) : null;
  } catch {
    return null;
  }
}

export function App() {
  const { room, connected, error, createdRoomId, countdown, jiraLinked, send } = usePokerSocket(WS_URL);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [roomId, setRoomId] = useState(() => new URLSearchParams(window.location.search).get("room") ?? "");
  const [joined, setJoined] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [deckType, setDeckType] = useState<DeckType>("Fibonacci");
  const [countdownSecs, setCountdownSecs] = useState<number>(0);
  const participantId = useRef(crypto.randomUUID());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { copied: linkCopied, copy: copyLink } = useCopyToClipboard();

  const lastSession = loadLastSession();
  const [showResumePrompt, setShowResumePrompt] = useState(
    () => !!(lastSession && !new URLSearchParams(window.location.search).get("room"))
  );

  // Jira form state
  const [showJiraForm, setShowJiraForm] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");

  useEffect(() => {
    if (!createdRoomId) return;
    setRoomId(createdRoomId);
    if (displayName.trim()) {
      // Name already filled — auto-join immediately
      send({
        type: "JoinRoom",
        room_id: createdRoomId,
        participant_id: participantId.current,
        display_name: displayName.trim(),
      });
      setJoined(true);
    } else {
      // Focus name field so user can type name and hit Enter/Join
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [createdRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ?room= in URL so sharing/refreshing works
  useEffect(() => {
    if (!roomId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    window.history.replaceState(null, "", url.toString());
  }, [roomId]);

  // Persist session for reconnect-on-refresh
  useEffect(() => {
    if (joined && roomId && displayName) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, displayName }));
    }
  }, [joined, roomId, displayName]);

  const createRoom = () => {
    const name = roomName.trim();
    if (!name) return;
    send({ type: "CreateRoom", name, deck_type: deckType });
  };

  const join = () => {
    if (!roomId || !displayName) return;
    send({
      type: "JoinRoom",
      room_id: roomId,
      participant_id: participantId.current,
      display_name: displayName,
    });
    setJoined(true);
  };

  const startSession = () => {
    if (room) send({ type: "StartSession", room_id: room.id, countdown_secs: countdownSecs > 0 ? countdownSecs : undefined });
  };
  const reveal = () => { if (room?.active_session) send({ type: "RevealVotes", room_id: room.id, session_id: room.active_session.id }); };
  const reset = () => {
    if (!room?.active_session) return;
    setSelectedCard(null);
    send({ type: "ResetSession", room_id: room.id, session_id: room.active_session.id });
  };
  const castVote = (card: string) => {
    if (!room?.active_session) return;
    if (selectedCard === card) {
      // Deselect: retract vote
      setSelectedCard(null);
      send({ type: "RetractVote", room_id: room.id, session_id: room.active_session.id });
    } else {
      setSelectedCard(card);
      send({ type: "CastVote", room_id: room.id, session_id: room.active_session.id, card });
    }
  };
  const addTicket = (title: string, description?: string) => {
    if (room) send({ type: "AddTicket", room_id: room.id, title, description });
  };

  const linkJira = () => {
    if (!room || !jiraBaseUrl || !jiraProjectKey || !jiraEmail || !jiraApiToken) return;
    send({
      type: "LinkJiraProject",
      room_id: room.id,
      jira_base_url: jiraBaseUrl.replace(/\/$/, ""),
      jira_project_key: jiraProjectKey.toUpperCase(),
      jira_email: jiraEmail,
      jira_api_token: jiraApiToken,
    });
    setShowJiraForm(false);
  };

  const resumeSession = () => {
    if (!lastSession) return;
    setRoomId(lastSession.roomId);
    setDisplayName(lastSession.displayName);
    setShowResumePrompt(false);
    send({
      type: "JoinRoom",
      room_id: lastSession.roomId,
      participant_id: participantId.current,
      display_name: lastSession.displayName,
    });
    setJoined(true);
  };

  const cards = room?.deck_type === "TShirt" ? TSHIRT_CARDS : FIBONACCI_CARDS;

  if (!joined) {
    return (
      <PageShell>
        <header className="border-b border-[hsl(var(--border))] px-4 h-14 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
            <span className="font-semibold text-base sm:text-lg">Planning Poker</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              data-testid="connection-status"
              className={cn("flex items-center gap-1 text-xs font-medium", connected ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}
            >
              {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span className="hidden sm:inline">{connected ? "Connected" : "Disconnected"}</span>
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-md space-y-6 py-4">
            {showResumePrompt && lastSession && (
              <Card className="border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5">
                <CardContent className="pt-4 pb-4 space-y-3">
                  <p className="text-sm font-medium">Resume previous session?</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Room <span className="font-mono">{lastSession.roomId.slice(0, 8)}…</span> as <strong>{lastSession.displayName}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={resumeSession}>Rejoin</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowResumePrompt(false)}>Dismiss</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Create a new room</CardTitle>
                <CardDescription>Set up a new planning poker session</CardDescription>
              </CardHeader>
              <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); createRoom(); }} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room name</Label>
                  <Input
                    id="room-name"
                    data-testid="room-name-input"
                    placeholder="Sprint 42 Planning"
                    required
                    minLength={2}
                    value={roomName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deck type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Fibonacci", "TShirt"] as DeckType[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDeckType(d)}
                        className={cn(
                          "rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                          deckType === d
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                            : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] active:bg-[hsl(var(--accent))]"
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
                <Button
                  data-testid="create-room-btn"
                  type="submit"
                  className="w-full"
                  disabled={!roomName.trim()}
                >
                  Create Room
                </Button>
              </form>
                {createdRoomId && (
                  <div className="space-y-2">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">
                      Room created! ID copied to field below.
                    </p>
                    <Button
                      data-testid="copy-invite-btn"
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => copyLink(inviteUrl(createdRoomId))}
                    >
                      {linkCopied ? <Check className="h-3 w-3" /> : <Link className="h-3 w-3" />}
                      {linkCopied ? "Link copied!" : "Copy invite link"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-[hsl(var(--muted-foreground))]">or join existing</span>
              <Separator className="flex-1" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Join a room</CardTitle>
                <CardDescription>Enter a room ID to join the session</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => { e.preventDefault(); join(); }}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label htmlFor="room-id">Room ID</Label>
                    <Input
                      id="room-id"
                      data-testid="room-id-input"
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={roomId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRoomId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Your name</Label>
                    <Input
                      id="display-name"
                      data-testid="name-input"
                      ref={nameInputRef}
                      placeholder="Alice"
                      value={displayName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="join-btn"
                    type="submit"
                    className="w-full"
                    disabled={!roomId.trim() || !displayName.trim()}
                  >
                    Join Room
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="border-b border-[hsl(var(--border))] px-3 sm:px-4 h-14 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-5 w-5 text-[hsl(var(--primary))] shrink-0" />
          <h1
            data-testid="room-heading"
            className="font-semibold text-base sm:text-lg truncate"
            style={{ maxWidth: "min(60vw, 20rem)" }}
          >
            {room?.name ?? roomId}
          </h1>
          {room && (
            <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">
              {room.deck_type}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!connected && (
            <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Reconnecting…</span>
            </span>
          )}
          {error && connected && (
            <span data-testid="error-msg" className="text-xs text-red-500 hidden sm:inline">{error}</span>
          )}
          <Button
            data-testid="invite-btn"
            variant="outline"
            size="sm"
            onClick={() => copyLink(inviteUrl(room?.id ?? roomId))}
            className="gap-1.5 text-xs h-8 px-2 sm:px-3"
          >
            {linkCopied ? <Check className="h-3 w-3" /> : <Link className="h-3 w-3" />}
            <span className="hidden sm:inline">{linkCopied ? "Copied!" : "Invite"}</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full overflow-y-auto">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Left / main column */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-5">
                {room && !room.active_session && (
                  <Button data-testid="start-session-btn" onClick={startSession} className="w-full">
                    Start Session
                  </Button>
                )}
                <SessionHeader session={room?.active_session ?? null} onReveal={reveal} onReset={reset} />
              </CardContent>
            </Card>

            {countdown !== null && room?.active_session && !room.active_session.revealed && (
              <div className="flex items-center justify-center gap-3 py-2">
                <Timer className="h-5 w-5 text-[hsl(var(--primary))]" />
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums transition-colors",
                    countdown <= 5 ? "text-red-500" : "text-[hsl(var(--primary))]"
                  )}
                >
                  {countdown}
                </span>
                <span className="text-sm text-[hsl(var(--muted-foreground))]">seconds left</span>
              </div>
            )}

            {room?.active_session && !room.active_session.revealed && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Your vote</CardTitle>
                </CardHeader>
                <CardContent className="pb-6" data-testid="card-picker">
                  <CardPicker cards={cards} selected={selectedCard} onSelect={castVote} />
                </CardContent>
              </Card>
            )}

            {room?.active_session?.revealed && (
              <Card data-testid="vote-reveal">
                <CardContent className="pt-6">
                  <VoteReveal
                    votes={room.active_session.votes}
                    onStartNew={startSession}
                    onReset={reset}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right / sidebar column */}
          <div className="space-y-4">
            {room && room.participants.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Participants
                    <Badge variant="secondary">{room.participants.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ParticipantList
                    participants={room.participants}
                    votes={room.active_session?.votes ?? []}
                    revealed={room.active_session?.revealed ?? false}
                  />
                </CardContent>
              </Card>
            )}

            {room && (
              <Card>
                <CardContent className="pt-6">
                  <TicketQueue
                    tickets={room.ticket_queue}
                    onAdd={addTicket}
                    activeTicketId={room.active_session?.ticket_id ?? undefined}
                    activeTicketTitle={
                      room.active_session?.ticket_id
                        ? (room.ticket_queue.find((t) => t.id === room.active_session!.ticket_id)?.title
                            ?? room.active_session.ticket_id)
                        : undefined
                    }
                  />
                </CardContent>
              </Card>
            )}

            {room && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Jira</span>
                    {jiraLinked && (
                      <Badge variant="secondary" className="text-xs">{jiraLinked.project_key} · {jiraLinked.ticket_count} tickets</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!showJiraForm ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setShowJiraForm(true)}>
                      {jiraLinked ? "Reconfigure Jira" : "Link Jira Project"}
                    </Button>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); linkJira(); }} className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="jira-url" className="text-xs">Base URL</Label>
                        <Input id="jira-url" placeholder="https://myteam.atlassian.net" value={jiraBaseUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJiraBaseUrl(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jira-key" className="text-xs">Project key</Label>
                        <Input id="jira-key" placeholder="PROJ" value={jiraProjectKey} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJiraProjectKey(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jira-email" className="text-xs">Email</Label>
                        <Input id="jira-email" type="email" placeholder="you@company.com" value={jiraEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJiraEmail(e.target.value)} required />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="jira-token" className="text-xs">API token</Label>
                        <Input id="jira-token" type="password" placeholder="••••••••" value={jiraApiToken} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJiraApiToken(e.target.value)} required />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="flex-1">Connect</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setShowJiraForm(false)}>Cancel</Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </PageShell>
  );
}
