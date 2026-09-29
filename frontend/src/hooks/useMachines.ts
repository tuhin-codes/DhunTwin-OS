import { useEffect, useState } from "react";
import {
  io,
  type Socket,
} from "socket.io-client";

import {
  getMachines,
  getAICondition,
} from "../services/api";

import type {
  Machine,
  AIConditionResult,
} from "../services/api";

export type { Machine } from "../services/api";

// ============================================================
// Configuration
// ============================================================

const SOCKET_URL =
  "http://127.0.0.1:8000";

const FALLBACK_REFRESH_MS =
  2_000;

const AI_REFRESH_MS =
  5_000;

// ============================================================
// Socket payload
// ============================================================

interface TelemetryUpdatePayload {

  timestamp: string;

  machines: Machine[];
}

// ============================================================
// Shared machine state
// ============================================================

let cachedMachines: Machine[] = [];

let cachedAIConditions:
  Record<
    string,
    AIConditionResult
  > = {};

let cachedError:
  string | null = null;

let isLoading = false;

let hasLoaded = false;

// ============================================================
// Subscribers
// ============================================================

type Listener = () => void;

const listeners =
  new Set<Listener>();

function notifyListeners() {

  listeners.forEach(
    (listener) => listener()
  );

}

// ============================================================
// REST request state
// ============================================================

let activeRequest:
  Promise<void> | null = null;

let activeAIRequest:
  Promise<void> | null = null;

// ============================================================
// Load machines
// ============================================================

async function refreshMachines(
  force = false
): Promise<void> {

  if (
    !force &&
    hasLoaded
  ) {

    return;
  }

  if (activeRequest) {

    return activeRequest;
  }

  isLoading = true;

  cachedError = null;

  notifyListeners();

  activeRequest =
    (async () => {

      try {

        const data =
          await getMachines(
            true
          );

        // ----------------------------------------------------
        // Determine which machines actually exist now.
        // ----------------------------------------------------

        const machineIds =
          new Set(
            data.map(
              (machine) =>
                machine.id
            )
          );

        // ----------------------------------------------------
        // Remove AI conditions for machines that no longer
        // exist in the current backend snapshot.
        // ----------------------------------------------------

        const nextAIConditions:
          Record<
            string,
            AIConditionResult
          > = {};

        for (
          const [
            machineId,
            condition,
          ]
          of Object.entries(
            cachedAIConditions
          )
        ) {

          if (
            machineIds.has(
              machineId
            )
          ) {

            nextAIConditions[
              machineId
            ] = condition;

          }

        }

        cachedAIConditions =
          nextAIConditions;

        // ----------------------------------------------------
        // Preserve the most recent AI prediction while the
        // fresh AI endpoint is being queried.
        // ----------------------------------------------------

        const previousById =
          new Map(
            cachedMachines.map(
              (machine) => [
                machine.id,
                machine,
              ]
            )
          );

        cachedMachines =
          data.map(
            (machine) => {

              const previous =
                previousById.get(
                  machine.id
                );

              return {

                ...machine,

                ai_prediction:
                  machine.ai_prediction ??
                  previous?.ai_prediction,

              };

            }
          );

        cachedError = null;

        hasLoaded = true;

      } catch (error) {

        console.error(
          "Failed to load machines:",
          error
        );

        cachedError =
          error instanceof Error
            ? error.message
            : "Failed to load machines";

      } finally {

        isLoading = false;

        notifyListeners();

      }

    })();

  try {

    await activeRequest;

  } finally {

    activeRequest = null;

  }

}

// ============================================================
// Load live AI condition
// ============================================================

async function refreshAIConditions():
  Promise<void> {

  if (activeAIRequest) {

    return activeAIRequest;
  }

  if (
    cachedMachines.length === 0
  ) {

    return;
  }

  activeAIRequest =
    (async () => {

      try {

        // ----------------------------------------------------
        // Snapshot machine IDs so the result belongs to the
        // machine set that was actually requested.
        // ----------------------------------------------------

        const machinesSnapshot =
          [...cachedMachines];

        const results =
          await Promise.allSettled(

            machinesSnapshot.map(
              async (machine) => {

                const result =
                  await getAICondition(
                    machine.id,
                    true
                  );

                return {

                  machineId:
                    machine.id,

                  result,

                };

              }
            )

          );

        // ----------------------------------------------------
        // IMPORTANT:
        //
        // Start from an empty object rather than the previous
        // AI state. This prevents stale AI results from
        // surviving when the backend no longer returns them.
        // ----------------------------------------------------

        const nextConditions:
          Record<
            string,
            AIConditionResult
          > = {};

        for (
          const item of results
        ) {

          if (
            item.status !==
            "fulfilled"
          ) {

            continue;
          }

          const {
            machineId,
            result,
          } = item.value;

          if (
            result &&
            result.available !== false
          ) {

            nextConditions[
              machineId
            ] = result;

          }

        }

        cachedAIConditions =
          nextConditions;

        // ----------------------------------------------------
        // Synchronize legacy machine.ai_prediction.
        //
        // AIControlCenter and some older dashboard components
        // still consume machine.ai_prediction.
        // ----------------------------------------------------

        cachedMachines =
          cachedMachines.map(
            (machine) => {

              const condition =
                cachedAIConditions[
                  machine.id
                ];

              // ------------------------------------------------
              // No current AI condition:
              //
              // Remove stale prediction rather than showing
              // an old prediction that no longer represents
              // the backend state.
              // ------------------------------------------------

              if (
                !condition
              ) {

                return {

                  ...machine,

                  ai_prediction:
                    undefined,

                };

              }

              const predictive =
                condition
                  .predictive_failure;

              // ------------------------------------------------
              // Backend is still collecting telemetry or AI
              // prediction is unavailable.
              // ------------------------------------------------

              if (
                !predictive ||
                !predictive.available
              ) {

                return {

                  ...machine,

                  ai_prediction:
                    undefined,

                };

              }

              // ------------------------------------------------
              // Current live prediction is available.
              // ------------------------------------------------

              return {

                ...machine,

                ai_prediction: {

                  available:
                    true,

                  model:
                    "CarbonTwin Predictive Failure Model",

                  machine_id:
                    machine.id,

                  timestamp:
                    condition.timestamp,

                  machine_type:
                    condition.machine_type,

                  risk:
                    predictive.probability,

                  risk_level:
                    predictive.risk_level,

                  risk_score:
                    predictive.risk_score,

                  failure_probability:
                    predictive.probability,

                  ai_failure_probability:
                    predictive
                      .ai_failure_probability ??
                    predictive.risk_score,

                  reason:
                    predictive.reason,

                  recommended_action:
                    predictive
                      .recommended_action,

                  status:
                    "Live prediction available",

                },

              };

            }
          );

        notifyListeners();

      } catch (error) {

        console.warn(
          "Failed to refresh live AI conditions:",
          error
        );

      }

    })();

  try {

    await activeAIRequest;

  } finally {

    activeAIRequest = null;

  }

}

// ============================================================
// Socket.IO singleton
// ============================================================

let socket:
  Socket | null = null;

let socketUsers = 0;

let fallbackTimer:
  number | null = null;

let aiTimer:
  number | null = null;

// ============================================================
// Apply telemetry update
// ============================================================

function mergeTelemetryUpdate(
  update: TelemetryUpdatePayload
) {

  if (
    !Array.isArray(
      update.machines
    )
  ) {

    return;
  }

  // ----------------------------------------------------------
  // Preserve the current AI prediction while telemetry itself
  // is changing.
  //
  // The AI refresh independently replaces this value with a
  // fresh backend analysis.
  // ----------------------------------------------------------

  const previousById =
    new Map(
      cachedMachines.map(
        (machine) => [
          machine.id,
          machine,
        ]
      )
    );

  cachedMachines =
    update.machines.map(
      (machine) => {

        const previous =
          previousById.get(
            machine.id
          );

        return {

          ...machine,

          ai_prediction:
            machine.ai_prediction ??
            previous?.ai_prediction,

        };

      }
    );

  // ----------------------------------------------------------
  // Remove AI conditions for machines that disappeared.
  // ----------------------------------------------------------

  const currentMachineIds =
    new Set(
      update.machines.map(
        (machine) =>
          machine.id
      )
    );

  const nextAIConditions:
    Record<
      string,
      AIConditionResult
    > = {};

  for (
    const [
      machineId,
      condition,
    ]
      of Object.entries(
        cachedAIConditions
      )
  ) {

    if (
      currentMachineIds.has(
        machineId
      )
    ) {

      nextAIConditions[
        machineId
      ] = condition;

    }

  }

  cachedAIConditions =
    nextAIConditions;

  cachedError = null;

  hasLoaded = true;

  notifyListeners();

}

// ============================================================
// Create Socket.IO connection
// ============================================================

function ensureSocket() {

  if (socket) {

    return socket;
  }

  socket =
    io(
      SOCKET_URL,
      {

        transports: [
          "websocket",
          "polling",
        ],

        autoConnect:
          true,

        reconnection:
          true,

        reconnectionAttempts:
          Infinity,

        reconnectionDelay:
          500,

        reconnectionDelayMax:
          5_000,

      }
    );

  // ==========================================================
  // LIVE TELEMETRY
  // ==========================================================

  socket.on(
    "telemetry_update",
    (
      payload:
        TelemetryUpdatePayload
    ) => {

      mergeTelemetryUpdate(
        payload
      );

    }
  );

  // ==========================================================
  // MACHINE CONTROL
  // ==========================================================

  socket.on(
    "machine_control_update",
    (
      payload:
        TelemetryUpdatePayload
    ) => {

      mergeTelemetryUpdate(
        payload
      );

      // ------------------------------------------------------
      // Machine control can materially change machine state.
      // Request fresh AI analysis immediately instead of
      // waiting for the next 5-second interval.
      // ------------------------------------------------------

      void refreshAIConditions();

    }
  );

  // ==========================================================
  // CONNECTED
  // ==========================================================

  socket.on(
    "connect",
    () => {

      cachedError = null;

      notifyListeners();

      // ------------------------------------------------------
      // Fresh machine snapshot after reconnect.
      // ------------------------------------------------------

      void refreshMachines(
        true
      )
        .then(
          () =>
            refreshAIConditions()
        );

    }
  );

  // ==========================================================
  // CONNECTION ERROR
  // ==========================================================

  socket.on(
    "connect_error",
    (error) => {

      console.warn(
        "CarbonTwin live telemetry connection unavailable:",
        error.message
      );

      notifyListeners();

    }
  );

  // ==========================================================
  // DISCONNECTED
  // ==========================================================

  socket.on(
    "disconnect",
    () => {

      notifyListeners();

    }
  );

  return socket;

}

// ============================================================
// REST fallback
// ============================================================

function startFallbackRefresh() {

  if (
    fallbackTimer !== null
  ) {

    return;
  }

  fallbackTimer =
    window.setInterval(
      () => {

        // ----------------------------------------------------
        // Socket.IO remains primary.
        // REST only takes over if the socket is unavailable.
        // ----------------------------------------------------

        if (
          !socket?.connected
        ) {

          void refreshMachines(
            true
          )
            .then(
              () =>
                refreshAIConditions()
            );

        }

      },
      FALLBACK_REFRESH_MS
    );

}

// ============================================================
// AI refresh timer
// ============================================================

function startAIRefresh() {

  if (
    aiTimer !== null
  ) {

    return;
  }

  aiTimer =
    window.setInterval(
      () => {

        if (
          cachedMachines.length === 0
        ) {

          return;
        }

        void refreshAIConditions();

      },
      AI_REFRESH_MS
    );

}

// ============================================================
// Stop REST fallback
// ============================================================

function stopFallbackRefresh() {

  if (
    fallbackTimer === null
  ) {

    return;
  }

  window.clearInterval(
    fallbackTimer
  );

  fallbackTimer = null;

}

// ============================================================
// Stop AI refresh
// ============================================================

function stopAIRefresh() {

  if (
    aiTimer === null
  ) {

    return;
  }

  window.clearInterval(
    aiTimer
  );

  aiTimer = null;

}

// ============================================================
// Subscription
// ============================================================

function subscribe() {

  socketUsers += 1;

  ensureSocket();

  startFallbackRefresh();

  startAIRefresh();

  return () => {

    socketUsers -= 1;

    if (
      socketUsers <= 0
    ) {

      socketUsers = 0;

      stopFallbackRefresh();

      stopAIRefresh();

    }

  };

}

// ============================================================
// React Hook
// ============================================================

export function useMachines() {

  const [
    ,
    forceRender,
  ] = useState(0);

  useEffect(
    () => {

      const listener =
        () => {

          forceRender(
            (value) =>
              value + 1
          );

        };

      listeners.add(
        listener
      );

      const unsubscribe =
        subscribe();

      // ------------------------------------------------------
      // Initial machine snapshot.
      //
      // Once machines are available, immediately request their
      // current AI condition.
      // ------------------------------------------------------

      void refreshMachines()
        .then(
          () =>
            refreshAIConditions()
        );

      return () => {

        listeners.delete(
          listener
        );

        unsubscribe();

      };

    },
    []
  );

  return {

    // --------------------------------------------------------
    // Live machine state
    // --------------------------------------------------------

    machines:
      cachedMachines,

    // --------------------------------------------------------
    // Live AI condition state
    // --------------------------------------------------------

    aiConditions:
      cachedAIConditions,

    // --------------------------------------------------------
    // Convenience accessor
    // --------------------------------------------------------

    getAICondition:
      (
        machineId: string
      ) =>
        cachedAIConditions[
          machineId
        ] ?? null,

    // --------------------------------------------------------
    // Loading
    // --------------------------------------------------------

    loading:
      isLoading &&
      cachedMachines.length === 0,

    // --------------------------------------------------------
    // Error
    // --------------------------------------------------------

    error:
      cachedError,

    // --------------------------------------------------------
    // Socket status
    // --------------------------------------------------------

    live:
      socket?.connected ??
      false,

    // --------------------------------------------------------
    // Manual refresh
    // --------------------------------------------------------

    refresh:
      async () => {

        await refreshMachines(
          true
        );

        await refreshAIConditions();

      },

  };

}