import type { ClientMessage, RoomView, ServerMessage } from "@planning-poker/api-types";
import { useCallback, useEffect, useRef, useState } from "react";

const RECONNECT_DELAY_MS = 2000;

export function usePokerSocket(url: string) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
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
      setError(null);
      for (const msg of queue.current) {
        socket.send(JSON.stringify(msg));
      }
      queue.current = [];
    };

    socket.onclose = () => {
      setConnected(false);
      if (!stopped.current) {
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    socket.onerror = () => {
      // onerror always fires before onclose; onclose handles reconnect
    };

    socket.onmessage = (evt) => {
      try {
        const msg: ServerMessage = JSON.parse(evt.data as string);
        if (msg.type === "RoomState") {
          setRoom(msg.room);
        } else if (msg.type === "RoomCreated") {
          setCreatedRoomId(msg.room_id);
        } else if (msg.type === "Error") {
          setError(msg.message);
        }
      } catch {
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

  return { room, connected, error, createdRoomId, send };
}
