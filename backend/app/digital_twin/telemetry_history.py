from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from threading import RLock

import pandas as pd

from app.models import Machine


class LiveTelemetryStore:
    """
    Keeps a bounded history of live Digital Twin telemetry.

    The store is intentionally independent of the ML models.
    It provides recent machine observations that can later be
    converted into the same temporal features used during training.
    """

    MAX_HISTORY_PER_MACHINE = 120

    _history: dict[str, deque[dict]] = defaultdict(
        lambda: deque(
            maxlen=LiveTelemetryStore.MAX_HISTORY_PER_MACHINE
        )
    )

    _lock = RLock()

    TELEMETRY_COLUMNS = [
        "Temperature",
        "Pressure",
        "Vibration",
        "Power",
    ]

    @classmethod
    def record(
        cls,
        machine: Machine,
        timestamp: datetime | None = None,
    ) -> None:
        """
        Record the current Digital Twin state for one machine.
        """

        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        observation = {
            "Machine_ID": str(machine.id),
            "Timestamp": timestamp,
            "Machine_Type": str(machine.type),

            "Temperature": float(
                machine.temperature
            ),

            "Pressure": float(
                machine.pressure
            ),

            "Vibration": float(
                machine.vibration
            ),

            "Power": float(
                machine.power
            ),
        }

        with cls._lock:
            cls._history[
                str(machine.id)
            ].append(observation)

    @classmethod
    def record_many(
        cls,
        machines: list[Machine],
        timestamp: datetime | None = None,
    ) -> None:
        """
        Record the current state of all machines.
        """

        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        with cls._lock:
            for machine in machines:
                cls.record(
                    machine,
                    timestamp,
                )

    @classmethod
    def get(
        cls,
        machine_id: str,
    ) -> pd.DataFrame:
        """
        Return recent telemetry history for one machine.
        """

        machine_id = str(machine_id)

        with cls._lock:
            rows = list(
                cls._history.get(
                    machine_id,
                    [],
                )
            )

        if not rows:
            return pd.DataFrame(
                columns=[
                    "Machine_ID",
                    "Timestamp",
                    "Machine_Type",
                    *cls.TELEMETRY_COLUMNS,
                ]
            )

        dataframe = pd.DataFrame(rows)

        dataframe["Timestamp"] = pd.to_datetime(
            dataframe["Timestamp"],
            utc=True,
        )

        return dataframe.sort_values(
            "Timestamp"
        ).reset_index(drop=True)

    @classmethod
    def get_all(cls) -> pd.DataFrame:
        """
        Return recent telemetry for all machines.
        """

        with cls._lock:
            rows = []

            for history in cls._history.values():
                rows.extend(
                    list(history)
                )

        if not rows:
            return pd.DataFrame(
                columns=[
                    "Machine_ID",
                    "Timestamp",
                    "Machine_Type",
                    *cls.TELEMETRY_COLUMNS,
                ]
            )

        dataframe = pd.DataFrame(rows)

        dataframe["Timestamp"] = pd.to_datetime(
            dataframe["Timestamp"],
            utc=True,
        )

        return dataframe.sort_values(
            [
                "Machine_ID",
                "Timestamp",
            ]
        ).reset_index(drop=True)

    @classmethod
    def count(
        cls,
        machine_id: str,
    ) -> int:
        """
        Return the number of stored observations
        for one machine.
        """

        with cls._lock:
            return len(
                cls._history.get(
                    str(machine_id),
                    [],
                )
            )

    @classmethod
    def clear(cls) -> None:
        """
        Clear all live telemetry history.

        Useful when restarting/reinitializing the
        Digital Twin.
        """

        with cls._lock:
            cls._history.clear()