import type { ClientMessage, RoomView, ServerMessage } from "@planning-poker/api-types";
import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;
// Only show the "Reconnecting" banner after this many ms of being disconnected.
// Hides the brief dropout when intentionally switching to a room DO after CreateRoom.
const RECONNECT_BANNER_DELAY_MS = 2000;

export function usePokerSocket(url: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [visiblyDisconnected, setVisiblyDisconnected] = useState(false);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [jiraLinked, setJiraLinked] = useState<{ project_key: string; ticket_count: number } | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const queue = useRef<ClientMessage[]>([]);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  const connect = useCallback(() => {
    if (stopped.current) return;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current);
        disconnectTimer.current = null;
      }
      setVisiblyDisconnected(false);
      setError(null);
      for (const msg of queue.current) {
        socket.send(JSON.stringify(msg));
      }
      queue.current = [];
    };

    socket.onclose = () => {
      setConnected(false);
      disconnectTimer.current = setTimeout(
        () => setVisiblyDisconnected(true),
        RECONNECT_BANNER_DELAY_MS,
      );
      // Guard: only reconnect if this socket is still the active one.
      // When the URL changes, a new socket replaces ws.current before onclose fires on
      // the old socket. Without this check, the old socket's onclose would schedule a
      // reconnect with the stale URL, creating a second connection to the wrong DO.
      if (!stopped.current && ws.current === socket) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    socket.onmessage = (evt) => {
      try {
        const msg: ServerMessage = JSON.parse(evt.data as string);
        if (msg.type === "RoomState") {
          setRoom(msg.room);
        } else if (msg.type === "RoomCreated") {
          setCreatedRoomId(msg.room_id);
        } else if (msg.type === "CountdownTick") {
          setCountdown(msg.remaining_secs > 0 ? msg.remaining_secs : null);
        } else if (msg.type === "JiraLinked") {
          setJiraLinked({ project_key: msg.project_key, ticket_count: msg.ticket_count });
        } else if (msg.type === "Error") {
          setError(msg.message);
        }
      } catch (err) {
        console.error("WS parse error", err);
        setError("invalid message from server");
      }
    };
  }, [url]);

  useEffect(() => {
    stopped.current = false;
    connect();
    return () => {
      stopped.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    } else {
      queue.current.push(msg);
    }
  }, []);

  return { room, connected, visiblyDisconnected, error, createdRoomId, countdown, jiraLinked, send };
}
