from pathlib import Path
from typing import Any

import pandas as pd


class TelemetrySchemaDiscovery:

    @staticmethod
    def inspect(
        dataset_path: str | Path,
        machine_id_column: str,
        machine_type_column: str | None = None,
        department_column: str | None = None,
        location_column: str | None = None,
        timestamp_column: str | None = None,
        identifier_columns: list[str] | None = None,
    ) -> dict[str, Any]:

        path = Path(dataset_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {path}"
            )

        df = pd.read_csv(path)

        excluded = set(
            identifier_columns or []
        )

        # ----------------------------------------------
        # Machine identity / metadata
        # ----------------------------------------------

        excluded.add(machine_id_column)

        if machine_type_column:
            excluded.add(machine_type_column)

        if department_column:
            excluded.add(department_column)

        if location_column:
            excluded.add(location_column)

        if timestamp_column:
            excluded.add(timestamp_column)

        # ----------------------------------------------
        # Discover telemetry signals
        # ----------------------------------------------

        signals = []

        for column in df.columns:

            if column in excluded:
                continue

            series = df[column]

            signal = {
                "name": column,
                "dtype": str(series.dtype),
                "missing_count": int(
                    series.isna().sum()
                ),
                "missing_rate": round(
                    float(series.isna().mean()),
                    6,
                ),
                "unique_values": int(
                    series.nunique(
                        dropna=True
                    )
                ),
            }

            if pd.api.types.is_numeric_dtype(
                series
            ):

                signal["kind"] = "numeric"

                non_null = series.dropna()

                if len(non_null):

                    signal["min"] = float(
                        non_null.min()
                    )

                    signal["max"] = float(
                        non_null.max()
                    )

                    signal["mean"] = float(
                        non_null.mean()
                    )

                    signal["std"] = float(
                        non_null.std()
                    )

            else:

                signal["kind"] = "categorical"

            signals.append(signal)

        # ----------------------------------------------
        # Metadata
        # ----------------------------------------------

        metadata_columns = []

        for column in [
            machine_id_column,
            machine_type_column,
            department_column,
            location_column,
            timestamp_column,
        ]:

            if column and column in df.columns:
                metadata_columns.append(column)

        # ----------------------------------------------
        # Observation statistics
        # ----------------------------------------------

        observations_per_asset = (
            df.groupby(
                machine_id_column
            ).size()
        )

        return {
            "dataset": path.name,

            "machine_id_column":
                machine_id_column,

            "machine_type_column":
                machine_type_column,

            "department_column":
                department_column,

            "location_column":
                location_column,

            "timestamp_column":
                timestamp_column,

            "metadata_columns":
                metadata_columns,

            "signal_count":
                len(signals),

            "signals":
                signals,

            "asset_count":
                int(
                    df[machine_id_column]
                    .nunique()
                ),

            "observations":
                int(len(df)),

            "observations_per_asset": {
                str(machine_id): int(count)
                for machine_id, count
                in observations_per_asset.items()
            },
        }