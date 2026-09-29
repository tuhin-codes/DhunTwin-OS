from pathlib import Path

from app.ml.assets.discovery import AssetDiscovery
from app.ml.assets.registry import AssetRegistry


class AssetOnboarding:

    @staticmethod
    def load_dataset(
        dataset_path: str | Path,
        machine_id_column: str,
        machine_type_column: str | None = None,
        department_column: str | None = None,
        location_column: str | None = None,
    ):

        # ----------------------------------------------
        # Discover assets
        # ----------------------------------------------

        result = AssetDiscovery.discover(
            dataset_path=dataset_path,
            machine_id_column=machine_id_column,
            machine_type_column=machine_type_column,
            department_column=department_column,
            location_column=location_column,
        )

        # ----------------------------------------------
        # Replace current asset registry
        # ----------------------------------------------

        AssetRegistry.clear()

        AssetRegistry.register_many(
            result["assets"]
        )

        return {
            "dataset": result["dataset"],
            "asset_count": AssetRegistry.count(),
            "machine_types": AssetRegistry.machine_types(),
            "count_by_type": AssetRegistry.count_by_type(),
        }