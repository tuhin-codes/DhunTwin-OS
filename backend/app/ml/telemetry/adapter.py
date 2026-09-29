from typing import Any

from app.ml.assets.registry import AssetRegistry
from app.ml.telemetry.store import TelemetryStore


class TelemetryAdapter:

    @staticmethod
    def ingest(
        machine_id: str,
        telemetry: dict[str, Any],
    ):

        # --------------------------------------------------
        # Verify that the physical asset exists
        # --------------------------------------------------

        asset = AssetRegistry.get(machine_id)

        if asset is None:
            raise ValueError(
                f"Unknown machine/asset: {machine_id}"
            )

        # --------------------------------------------------
        # Store telemetry history
        # --------------------------------------------------

        observation = TelemetryStore.record(
            machine_id=machine_id,
            telemetry=telemetry,
        )

        return {
            "machine_id": machine_id,
            "machine_type": asset.get(
                "machine_type"
            ),
            "observation": observation,
        }