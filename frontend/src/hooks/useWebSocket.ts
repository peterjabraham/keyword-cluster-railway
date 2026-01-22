import { useEffect, useRef, useState } from "react";

type MessageHandler = (payload: {
  type: string;
  status?: Record<string, string>;
  outputType?: string;
  payload?: unknown;
}) => void;

export function useWebSocket(
  projectId: string | null,
  onMessage?: MessageHandler
) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const source = new EventSource(`/api/projects/${projectId}/stream`);
    sourceRef.current = source;

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      if (!onMessage) {
        return;
      }
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage({ type: "unknown" });
      }
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [projectId, onMessage]);

  return { connected, source: sourceRef.current };
}
