/* ============================================================
   DHUN DIGITAL TWIN — LIVE FRAME CLOCK
   Two-second frames from the deterministic model, with a
   gateway overlay when one is configured. Pausing freezes the
   clock; the gateway keeps its socket so a resume is instant.
   ============================================================ */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  PhaseId,
} from "../types";

import type {
  FeedStatus,
  TelemetryPacket,
  TwinFrame,
} from "./types";

import { buildFrame } from "./buildFrame";
import {
  connectTelemetry,
  telemetryEndpoint,
} from "./source";
import { nowIST } from "../lib/clock";

const FRAME_MS = 2000;
const PACKET_TTL_MS = 30000;

export interface LiveTwin {
  frame: TwinFrame;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  feed: FeedStatus;
  endpoint: string | null;
  lastPacketAt: number | null;
}

function prune(
  packets: Record<string, TelemetryPacket>,
  wallNow: number
): void {
  for (const key of Object.keys(packets)) {
    if (
      wallNow - (packets[key].at ?? 0) >
      PACKET_TTL_MS
    ) {
      delete packets[key];
    }
  }
}

export function useLiveTwin(
  phase: PhaseId
): LiveTwin {
  const endpoint = useMemo(
    () => telemetryEndpoint(),
    []
  );

  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState<Date>(() =>
    nowIST()
  );

  const [feed, setFeed] = useState<FeedStatus>(
    endpoint ? "connecting" : "simulated"
  );

  const [lastPacketAt, setLastPacketAt] = useState<
    number | null
  >(null);

  const [readings, setReadings] = useState<
    Record<string, TelemetryPacket>
  >({});

  const packets = useRef<
    Record<string, TelemetryPacket>
  >({});

  useEffect(() => {
    const source = connectTelemetry({
      onStatus: setFeed,
      onPacket: (packet) => {
        const key = `${packet.nodeId}:${packet.metric}`;

        packets.current[key] = packet;
      },
    });

    return () => {
      source?.close();
    };
  }, []);

  useEffect(() => {
    if (paused) {
      return;
    }

    const tick = () => {
      const wallNow = Date.now();

      prune(packets.current, wallNow);

      setReadings({ ...packets.current });

      setLastPacketAt(() => {
        let latest = 0;

        for (const packet of Object.values(
          packets.current
        )) {
          const at = packet.at ?? 0;

          if (
            wallNow - at < PACKET_TTL_MS &&
            at > latest
          ) {
            latest = at;
          }
        }

        return latest === 0 ? null : latest;
      });

      setNow(nowIST());
    };

    const kick = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, FRAME_MS);

    return () => {
      window.clearTimeout(kick);
      window.clearInterval(id);
    };
  }, [paused]);

  const frame = useMemo(
    () => buildFrame(phase, now, readings),
    [phase, now, readings]
  );

  return {
    frame,
    paused,
    setPaused,
    feed,
    endpoint,
    lastPacketAt,
  };
}
