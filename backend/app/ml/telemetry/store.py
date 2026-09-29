from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any


class TelemetryStore:

    # Keep recent observations in memory for now.
    # We will add persistent storage later.
    _data: dict[str, deque] = defaultdict(
        lambda: deque(maxlen=10000)
    )

    @classmethod
    def clear(cls):
        cls._data.clear()

    @classmethod
    def record(
        cls,
        machine_id: str,
        telemetry: dict[str, Any],
        timestamp: datetime | None = None,
    ):

        if not machine_id:
            raise ValueError(
                "machine_id is required."
            )

        if timestamp is None:
            timestamp = datetime.now(
                timezone.utc
            )

        observation = {
            "machine_id": str(machine_id),
            "timestamp": timestamp.isoformat(),
            "telemetry": telemetry,
        }

        cls._data[str(machine_id)].append(
            observation
        )

        return observation

    @classmethod
    def history(
        cls,
        machine_id: str,
        limit: int | None = None,
    ):

        observations = list(
            cls._data.get(
                str(machine_id),
                [],
            )
        )

        if limit is not None:
            observations = observations[-limit:]

        return observations

    @classmethod
    def latest(cls, machine_id: str):

        observations = cls._data.get(
            str(machine_id),
            [],
        )

        if not observations:
            return None

        return observations[-1]

    @classmethod
    def count(cls, machine_id: str):

        return len(
            cls._data.get(
                str(machine_id),
                [],
            )
        )

    @classmethod
    def machine_ids(cls):

        return sorted(cls._data.keys())

    @classmethod
    def summary(cls):

        return {
            "machine_count": len(cls._data),
            "observations": sum(
                len(values)
                for values in cls._data.values()
            ),
            "observations_by_machine": {
                machine_id: len(values)
                for machine_id, values
                in cls._data.items()
            },
        }