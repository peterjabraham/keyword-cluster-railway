import { useEffect, useRef, useState } from "react";

type MessageHandler = (event: MessageEvent) => void;

export function useWebSocket(
  projectId: string | null,
  onMessage?: MessageHandler
) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const socket = new WebSocket(`/api/projects/${projectId}/stream`);
    socketRef.current = socket;

    socket.addEventListener("open", () => setConnected(true));
    socket.addEventListener("close", () => setConnected(false));
    if (onMessage) {
      socket.addEventListener("message", onMessage);
    }

    return () => {
      if (onMessage) {
        socket.removeEventListener("message", onMessage);
      }
      socket.close();
      socketRef.current = null;
    };
  }, [projectId, onMessage]);

  return { connected, socket: socketRef.current };
}
