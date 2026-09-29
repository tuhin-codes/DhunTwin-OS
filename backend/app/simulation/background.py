import asyncio
from datetime import datetime, timezone

from app.digital_twin.runtime import DigitalTwinRuntime
from app.digital_twin.telemetry_history import LiveTelemetryStore
from app.ml.prediction.predictor import (
    PredictiveFailurePredictor,
)
from app.ml.prediction.risk_engine import (
    PredictiveRiskEngine,
)
from app.simulation.simulator import Simulator
from app.websocket.socket_manager import broadcast


class BackgroundSimulation:
    """
    Run the Digital Twin simulation and publish live telemetry.

    Telemetry is generated every second.

    Predictive ML is evaluated every few seconds using the
    in-memory live telemetry history and the existing trained
    predictive models.
    """

    _task: asyncio.Task | None = None

    # ------------------------------------------------------------
    # ML evaluation interval
    # ------------------------------------------------------------

    AI_INTERVAL_SECONDS = 5

    # ------------------------------------------------------------
    # Shared predictor
    # ------------------------------------------------------------

    _predictor: PredictiveFailurePredictor | None = None

    # ------------------------------------------------------------
    # Latest AI results
    # ------------------------------------------------------------

    _ai_results: dict[str, dict] = {}

    # ============================================================
    # PREDICTOR
    # ============================================================

    @classmethod
    def _get_predictor(
        cls,
    ) -> PredictiveFailurePredictor:

        if cls._predictor is None:

            cls._predictor = (
                PredictiveFailurePredictor()
            )

        return cls._predictor

    # ============================================================
    # LIVE AI EVALUATION
    # ============================================================

    @classmethod
    def _evaluate_ai(
        cls,
        machines,
    ) -> dict[str, dict]:

        predictor = cls._get_predictor()

        live_dataframe = (
            LiveTelemetryStore.get_all()
        )

        if live_dataframe.empty:
            return {}

        results = {}

        # --------------------------------------------------------
        # Require enough history for temporal features.
        #
        # The largest model window is 30 observations.
        # --------------------------------------------------------

        for machine in machines:

            machine_id = str(
                machine.id
            )

            machine_history = (
                live_dataframe[
                    live_dataframe[
                        "Machine_ID"
                    ].astype(str)
                    == machine_id
                ]
            )

            if machine_history.empty:
                continue

            # Need enough observations for the
            # 30-point rolling feature window.
            if len(machine_history) < 30:
                continue

            try:

                prediction = (
                    predictor.predict_latest_live(
                        live_dataframe,
                        machine_id,
                    )
                )

                assessment = (
                    PredictiveRiskEngine
                    .assess_prediction(
                        prediction
                    )
                )

                results[machine_id] = {
                    "available": True,

                    "machine_id":
                        machine_id,

                    "timestamp":
                        prediction[
                            "timestamp"
                        ],

                    "machine_type":
                        prediction[
                            "machine_type"
                        ],

                    "probability":
                        prediction[
                            "risk"
                        ],

                    "risk_level":
                        assessment[
                            "risk_level"
                        ],

                    "risk_score":
                        assessment[
                            "risk_score"
                        ],

                    "reason":
                        assessment[
                            "reason"
                        ],

                    "recommended_action":
                        assessment[
                            "recommended_action"
                        ],
                }

            except Exception as exc:

                # Do not allow one machine's ML failure
                # to stop the Digital Twin simulation.

                results[machine_id] = {
                    "available": False,

                    "machine_id":
                        machine_id,

                    "risk_level":
                        "UNKNOWN",

                    "risk_score":
                        None,

                    "probability":
                        None,

                    "reason":
                        (
                            "Live predictive analysis "
                            "is temporarily unavailable."
                        ),

                    "recommended_action":
                        (
                            "Continue monitoring "
                            "and collect telemetry."
                        ),

                    "error":
                        str(exc),
                }

        cls._ai_results = results

        return results

    # ============================================================
    # GET LATEST AI RESULT
    # ============================================================

    @classmethod
    def get_ai_result(
        cls,
        machine_id: str,
    ):

        return cls._ai_results.get(
            str(machine_id)
        )

    # ============================================================
    # MAIN SIMULATION LOOP
    # ============================================================

    @classmethod
    async def run(cls):

        ai_counter = 0

        while True:

            try:

                # ------------------------------------------------
                # Update Digital Twin
                # ------------------------------------------------

                machines = (
                    Simulator.update()
                )

                # ------------------------------------------------
                # Timestamp this observation
                # ------------------------------------------------

                timestamp = datetime.now(
                    timezone.utc
                )

                # ------------------------------------------------
                # Store live telemetry
                # ------------------------------------------------

                LiveTelemetryStore.record_many(
                    machines,
                    timestamp,
                )

                # ------------------------------------------------
                # Count simulation cycles
                # ------------------------------------------------

                ai_counter += 1

                # ------------------------------------------------
                # Run predictive ML periodically
                # ------------------------------------------------

                if (
                    ai_counter
                    >= cls.AI_INTERVAL_SECONDS
                ):

                    cls._evaluate_ai(
                        machines
                    )

                    ai_counter = 0

                # ------------------------------------------------
                # Build machine payload
                # ------------------------------------------------

                machine_payload = []

                for machine in machines:

                    payload = (
                        machine.model_dump()
                    )

                    ai_result = (
                        cls._ai_results.get(
                            str(machine.id)
                        )
                    )

                    if ai_result is not None:

                        payload[
                            "ai_prediction"
                        ] = ai_result

                    machine_payload.append(
                        payload
                    )

                # ------------------------------------------------
                # Broadcast live telemetry
                # ------------------------------------------------

                await broadcast(
                    "telemetry_update",
                    {
                        "timestamp":
                            timestamp.isoformat(),

                        "machines":
                            machine_payload,
                    },
                )

                # ------------------------------------------------
                # One simulation cycle per second
                # ------------------------------------------------

                await asyncio.sleep(1)

            except asyncio.CancelledError:

                raise

            except Exception as exc:

                print(
                    "CarbonTwin simulation "
                    f"cycle failed: {exc}"
                )

                await asyncio.sleep(1)

    # ============================================================
    # START
    # ============================================================

    @classmethod
    def start(cls):

        if (
            cls._task is None
            or cls._task.done()
        ):

            cls._task = asyncio.create_task(
                cls.run()
            )

    # ============================================================
    # STOP
    # ============================================================

    @classmethod
    async def stop(cls):

        if cls._task is None:
            return

        cls._task.cancel()

        try:

            await cls._task

        except asyncio.CancelledError:

            pass

        finally:

            cls._task = None