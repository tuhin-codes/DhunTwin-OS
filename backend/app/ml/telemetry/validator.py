from pathlib import Path
from typing import Any

import pandas as pd


class TelemetryValidator:

    @staticmethod
    def validate(
        dataset_path: str | Path,
        machine_id_column: str,
        timestamp_column: str | None,
        telemetry_columns: list[str],
        minimum_observations_per_asset: int = 10,
    ) -> dict[str, Any]:

        path = Path(dataset_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {path}"
            )

        df = pd.read_csv(path)

        errors = []
        warnings = []

        # --------------------------------------------------
        # Required machine ID
        # --------------------------------------------------

        if machine_id_column not in df.columns:

            errors.append(
                f"Machine ID column '{machine_id_column}' "
                "does not exist."
            )

            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
            }

        # --------------------------------------------------
        # Timestamp
        # --------------------------------------------------

        if timestamp_column is None:

            errors.append(
                "A timestamp column is required "
                "for time-series predictive analytics."
            )

        elif timestamp_column not in df.columns:

            errors.append(
                f"Timestamp column '{timestamp_column}' "
                "does not exist."
            )

        else:

            timestamps = pd.to_datetime(
                df[timestamp_column],
                errors="coerce",
                utc=True,
            )

            invalid_timestamps = int(
                timestamps.isna().sum()
            )

            if invalid_timestamps:

                errors.append(
                    f"{invalid_timestamps} invalid "
                    "timestamp values found."
                )

            # --------------------------------------------------
            # Duplicate machine/timestamp observations
            # --------------------------------------------------

            duplicate_mask = df.duplicated(
                subset=[
                    machine_id_column,
                    timestamp_column,
                ],
                keep=False,
            )

            duplicate_count = int(
                duplicate_mask.sum()
            )

            if duplicate_count:

                warnings.append(
                    f"{duplicate_count} rows belong to "
                    "duplicate machine/timestamp pairs."
                )

            # --------------------------------------------------
            # Global ordering
            # --------------------------------------------------

            if timestamps.notna().all():

                unordered_assets = []

                time_data = df[
                    [
                        machine_id_column,
                        timestamp_column,
                    ]
                ].copy()

                time_data[timestamp_column] = timestamps

                for machine_id, group in time_data.groupby(
                    machine_id_column
                ):

                    machine_times = group[
                        timestamp_column
                    ]

                    if not machine_times.is_monotonic_increasing:
                        unordered_assets.append(
                            str(machine_id)
                        )

                if unordered_assets:

                    warnings.append(
                        "Timestamps are not ordered for assets: "
                        + ", ".join(unordered_assets)
                    )

        # --------------------------------------------------
        # Telemetry columns
        # --------------------------------------------------

        missing_telemetry_columns = [
            column
            for column in telemetry_columns
            if column not in df.columns
        ]

        if missing_telemetry_columns:

            errors.append(
                "Missing telemetry columns: "
                + ", ".join(
                    missing_telemetry_columns
                )
            )

        available_telemetry = [
            column
            for column in telemetry_columns
            if column in df.columns
        ]

        # --------------------------------------------------
        # Missing telemetry values
        # --------------------------------------------------

        missing_values = {}

        for column in available_telemetry:

            count = int(
                df[column].isna().sum()
            )

            if count:

                missing_values[column] = {
                    "count": count,
                    "rate": round(
                        float(
                            df[column].isna().mean()
                        ),
                        6,
                    ),
                }

        # --------------------------------------------------
        # Machine statistics
        # --------------------------------------------------

        machine_counts = (
            df.groupby(
                machine_id_column
            ).size()
        )

        insufficient_assets = {
            str(machine_id): int(count)
            for machine_id, count
            in machine_counts.items()
            if count < minimum_observations_per_asset
        }

        if insufficient_assets:

            warnings.append(
                f"{len(insufficient_assets)} assets have "
                f"fewer than "
                f"{minimum_observations_per_asset} "
                "observations."
            )

        # --------------------------------------------------
        # Sampling intervals
        # --------------------------------------------------

        sampling_statistics = {}

        if (
            timestamp_column
            and timestamp_column in df.columns
            and pd.to_datetime(
                df[timestamp_column],
                errors="coerce",
            ).notna().all()
        ):

            time_data = df[
                [
                    machine_id_column,
                    timestamp_column,
                ]
            ].copy()

            time_data[timestamp_column] = pd.to_datetime(
                time_data[timestamp_column],
                errors="coerce",
                utc=True,
            )

            for machine_id, group in time_data.groupby(
                machine_id_column
            ):

                timestamps = (
                    group[timestamp_column]
                    .sort_values()
                )

                if len(timestamps) > 1:

                    intervals = (
                        timestamps
                        .diff()
                        .dropna()
                        .dt.total_seconds()
                    )

                    if len(intervals):

                        sampling_statistics[
                            str(machine_id)
                        ] = {
                            "min_seconds":
                                float(intervals.min()),

                            "max_seconds":
                                float(intervals.max()),

                            "median_seconds":
                                float(
                                    intervals.median()
                                ),

                            "observations":
                                int(len(timestamps)),
                        }

        # --------------------------------------------------
        # Final result
        # --------------------------------------------------

        valid = len(errors) == 0

        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "statistics": {
                "rows": int(len(df)),

                "asset_count": int(
                    df[machine_id_column]
                    .nunique()
                ),

                "telemetry_columns":
                    available_telemetry,

                "missing_values":
                    missing_values,

                "observations_per_asset": {
                    str(machine_id): int(count)
                    for machine_id, count
                    in machine_counts.items()
                },

                "insufficient_history":
                    insufficient_assets,

                "sampling":
                    sampling_statistics,
            },
        }