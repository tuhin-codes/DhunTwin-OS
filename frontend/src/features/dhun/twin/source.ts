/* ============================================================
   DHUN DIGITAL TWIN — TELEMETRY SOURCE
   The demo runs on the deterministic model. This module is the
   seam for real hardware: set VITE_TELEMETRY_WS to a gateway
   websocket and valid packets override the model until they go
   stale. Nothing here invents a reading.
   ============================================================ */

import type {
  FeedStatus,
  TelemetryPacket,
} from "./types";

export interface TelemetryHandlers {
  onPacket: (packet: TelemetryPacket) => void;
  onStatus: (status: FeedStatus) => void;
}

export interface TelemetrySource {
  close: () => void;
}

export function telemetryEndpoint(): string | null {
  const raw = import.meta.env.VITE_TELEMETRY_WS;

  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();

  return trimmed === "" ? null : trimmed;
}

function toPacket(
  value: unknown
): TelemetryPacket | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  /* Gateway envelope: { type: "telemetry", packets: [...] } */
  if (Array.isArray(record.packets)) {
    return null;
  }

  const nodeId = record.nodeId;
  const metric = record.metric;
  const reading = record.value;

  if (
    typeof nodeId !== "string" ||
    nodeId === "" ||
    typeof metric !== "string" ||
    metric === "" ||
    typeof reading !== "number" ||
    !Number.isFinite(reading)
  ) {
    return null;
  }

  return {
    nodeId,
    metric,
    value: reading,
    at:
      typeof record.at === "number" &&
      Number.isFinite(record.at)
        ? record.at
        : Date.now(),
  };
}

export function parsePacket(
  raw: string
): TelemetryPacket[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map(toPacket)
      .filter(
        (packet): packet is TelemetryPacket =>
          packet !== null
      );
  }

  const record = parsed as Record<string, unknown>;

  if (Array.isArray(record.packets)) {
    return record.packets
      .map(toPacket)
      .filter(
        (packet): packet is TelemetryPacket =>
          packet !== null
      );
  }

  const single = toPacket(parsed);

  return single ? [single] : [];
}

export function connectTelemetry(
  handlers: TelemetryHandlers
): TelemetrySource | null {
  const url = telemetryEndpoint();

  if (!url || typeof WebSocket === "undefined") {
    return null;
  }

  let socket: WebSocket | null = null;
  let retry = 0;
  let timer = 0;
  let closed = false;

  const open = () => {
    if (closed) {
      return;
    }

    handlers.onStatus("connecting");

    try {
      socket = new WebSocket(url);
    } catch {
      handlers.onStatus("offline");
      return;
    }

    socket.onopen = () => {
      retry = 0;
      handlers.onStatus("live");
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      for (const packet of parsePacket(event.data)) {
        handlers.onPacket(packet);
      }
    };

    socket.onerror = () => {
      /* onclose owns the retry path */
    };

    socket.onclose = () => {
      socket = null;

      if (closed) {
        return;
      }

      handlers.onStatus("offline");

      const delay = Math.min(
        15000,
        1000 * 2 ** retry
      );

      retry += 1;
      timer = window.setTimeout(open, delay);
    };
  };

  open();

  return {
    close() {
      closed = true;
      window.clearTimeout(timer);
      socket?.close();
      socket = null;
    },
  };
}
