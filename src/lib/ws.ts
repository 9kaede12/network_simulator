let socket: WebSocket | null = null;
const listeners = new Set<(msg: unknown) => void>();
const pendingMessages: string[] = [];
let reconnectTimer: number | null = null;
const WS_URL = "ws://localhost:8000/ws";

function setupSocket() {
  if (!socket) return;

  socket.onopen = () => {
    console.info("[WS] Connected to FastAPI");
    while (pendingMessages.length > 0) {
      const payload = pendingMessages.shift();
      if (payload) {
        socket?.send(payload);
      }
    }
  };

  socket.onclose = () => {
    console.warn("[WS] Disconnected");
    socket = null;
    if (reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectWS();
      }, 1500);
    }
  };

  socket.onmessage = (event) => {
    try {
      const msg: unknown = JSON.parse(event.data);
      listeners.forEach((fn) => fn(msg));
    } catch (err) {
      console.error("[WS] Invalid message", event.data, err);
    }
  };

  socket.onerror = (event) => {
    console.error("[WS] Error", event);
  };
}

export function connectWS() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return socket;
  }
  try {
    socket = new WebSocket(WS_URL);
    setupSocket();
  } catch (err) {
    console.error("[WS] Failed to connect:", err);
    if (reconnectTimer === null) {
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectWS();
      }, 2000);
    }
  }
  return socket;
}

export function onMessage(fn: (msg: unknown) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function sendCommand(cmd: string, nodeId?: string) {
  const payload = JSON.stringify({ command: cmd, node: nodeId });
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    pendingMessages.push(payload);
    connectWS();
    return;
  }
  socket.send(payload);
}
