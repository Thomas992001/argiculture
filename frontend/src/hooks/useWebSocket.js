import { useEffect, useRef, useState, useCallback } from "react";

export function useWebSocket(url = null) {
  const [lastMessage, setLastMessage] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const wsUrl =
    url ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: "ping" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type !== "pong") {
            setLastMessage(data);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, [wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { lastMessage, connected, sendMessage };
}
