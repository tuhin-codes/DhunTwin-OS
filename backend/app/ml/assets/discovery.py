from pathlib import Path

import pandas as pd


class AssetDiscovery:

    @staticmethod
    def discover(
        dataset_path: str | Path,
        machine_id_column: str,
        machine_type_column: str | None = None,
        department_column: str | None = None,
        location_column: str | None = None,
    ) -> dict:

        path = Path(dataset_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {path}"
            )

        df = pd.read_csv(path)

        if machine_id_column not in df.columns:
            raise ValueError(
                f"Machine ID column '{machine_id_column}' "
                "does not exist."
            )

        if (
            machine_type_column
            and machine_type_column not in df.columns
        ):
            raise ValueError(
                f"Machine type column '{machine_type_column}' "
                "does not exist."
            )

        # --------------------------------------------------
        # Remove rows without an asset identifier
        # --------------------------------------------------

        asset_df = df.dropna(
            subset=[machine_id_column]
        ).copy()

        # --------------------------------------------------
        # Discover physical assets
        # --------------------------------------------------

        assets = []

        grouped = asset_df.groupby(
            machine_id_column,
            sort=False,
        )

        for machine_id, group in grouped:

            asset = {
                "machine_id": str(machine_id),
                "observation_count": int(len(group)),
            }

            # ----------------------------------------------
            # Machine type
            # ----------------------------------------------

            if machine_type_column:

                values = (
                    group[machine_type_column]
                    .dropna()
                    .astype(str)
                    .unique()
                    .tolist()
                )

                asset["machine_type"] = (
                    values[0]
                    if len(values) == 1
                    else values
                )

            # ----------------------------------------------
            # Department
            # ----------------------------------------------

            if department_column:

                if department_column in group.columns:

                    values = (
                        group[department_column]
                        .dropna()
                        .astype(str)
                        .unique()
                        .tolist()
                    )

                    asset["department"] = (
                        values[0]
                        if len(values) == 1
                        else values
                    )

            # ----------------------------------------------
            # Location
            # ----------------------------------------------

            if location_column:

                if location_column in group.columns:

                    values = (
                        group[location_column]
                        .dropna()
                        .astype(str)
                        .unique()
                        .tolist()
                    )

                    asset["location"] = (
                        values[0]
                        if len(values) == 1
                        else values
                    )

            # ----------------------------------------------
            # Available telemetry
            # ----------------------------------------------

            numeric_columns = group.select_dtypes(
                include="number"
            ).columns.tolist()

            asset["telemetry_features"] = [
                column
                for column in numeric_columns
                if column != machine_id_column
            ]

            assets.append(asset)

        # --------------------------------------------------
        # Machine type summary
        # --------------------------------------------------

        type_summary = {}

        if machine_type_column:

            type_series = (
                asset_df[machine_type_column]
                .dropna()
                .astype(str)
            )

            for machine_type in sorted(
                type_series.unique()
            ):

                machine_count = int(
                    asset_df.loc[
                        asset_df[machine_type_column]
                        .astype(str)
                        == machine_type,
                        machine_id_column,
                    ].nunique()
                )

                type_summary[machine_type] = {
                    "machine_count": machine_count,
                }

        # --------------------------------------------------
        # Result
        # --------------------------------------------------

        return {
            "dataset": path.name,
            "machine_id_column": machine_id_column,
            "machine_type_column": machine_type_column,
            "asset_count": len(assets),
            "machine_types": sorted(
                type_summary.keys()
            ),
            "count_by_type": {
                machine_type: data["machine_count"]
                for machine_type, data
                in type_summary.items()
            },
            "assets": assets,
        }