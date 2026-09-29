from typing import Any


class AssetRegistry:

    _assets: dict[str, dict[str, Any]] = {}

    # --------------------------------------------------
    # Clear registry
    # --------------------------------------------------

    @classmethod
    def clear(cls):
        cls._assets.clear()

    # --------------------------------------------------
    # Register one asset
    # --------------------------------------------------

    @classmethod
    def register(cls, asset: dict[str, Any]):

        machine_id = asset.get("machine_id")

        if not machine_id:
            raise ValueError(
                "Asset must contain a machine_id."
            )

        machine_id = str(machine_id)

        cls._assets[machine_id] = asset

    # --------------------------------------------------
    # Register many assets
    # --------------------------------------------------

    @classmethod
    def register_many(cls, assets: list[dict[str, Any]]):

        for asset in assets:
            cls.register(asset)

    # --------------------------------------------------
    # Get asset
    # --------------------------------------------------

    @classmethod
    def get(cls, machine_id: str):

        return cls._assets.get(
            str(machine_id)
        )

    # --------------------------------------------------
    # Get all assets
    # --------------------------------------------------

    @classmethod
    def all(cls):

        return list(
            cls._assets.values()
        )

    # --------------------------------------------------
    # Count
    # --------------------------------------------------

    @classmethod
    def count(cls):

        return len(cls._assets)

    # --------------------------------------------------
    # Machine types
    # --------------------------------------------------

    @classmethod
    def machine_types(cls):

        types = set()

        for asset in cls._assets.values():

            machine_type = asset.get(
                "machine_type"
            )

            if isinstance(machine_type, str):
                types.add(machine_type)

            elif isinstance(machine_type, list):
                types.update(
                    str(value)
                    for value in machine_type
                )

        return sorted(types)

    # --------------------------------------------------
    # Count by machine type
    # --------------------------------------------------

    @classmethod
    def count_by_type(cls):

        counts: dict[str, int] = {}

        for asset in cls._assets.values():

            machine_type = asset.get(
                "machine_type"
            )

            if isinstance(machine_type, str):

                counts[machine_type] = (
                    counts.get(machine_type, 0) + 1
                )

            elif isinstance(machine_type, list):

                for value in machine_type:

                    value = str(value)

                    counts[value] = (
                        counts.get(value, 0) + 1
                    )

        return counts

    # --------------------------------------------------
    # Summary
    # --------------------------------------------------

    @classmethod
    def summary(cls):

        return {
            "asset_count": cls.count(),
            "machine_types": cls.machine_types(),
            "count_by_type": cls.count_by_type(),
        }