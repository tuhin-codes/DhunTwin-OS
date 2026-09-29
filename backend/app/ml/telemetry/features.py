from pathlib import Path
from typing import Any

import pandas as pd


class TemporalFeatureEngine:

    # ============================================================
    # BUILD FROM CSV
    # ============================================================

    @staticmethod
    def build(
        dataset_path: str | Path,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
        rolling_windows: tuple[int, ...] = (5, 15, 30),
    ) -> pd.DataFrame:

        path = Path(dataset_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {path}"
            )

        df = pd.read_csv(path)

        return TemporalFeatureEngine.build_from_dataframe(
            df=df,
            machine_id_column=machine_id_column,
            timestamp_column=timestamp_column,
            telemetry_columns=telemetry_columns,
            rolling_windows=rolling_windows,
        )

    # ============================================================
    # BUILD FROM LIVE DATAFRAME
    # ============================================================

    @staticmethod
    def build_from_dataframe(
        df: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
        rolling_windows: tuple[int, ...] = (5, 15, 30),
    ) -> pd.DataFrame:
        """
        Build temporal features from an existing DataFrame.

        This uses the same feature-generation logic as the
        historical CSV pipeline, but allows the live Digital Twin
        telemetry stream to be processed directly in memory.
        """

        if df.empty:
            raise ValueError(
                "Cannot build temporal features from "
                "an empty dataframe."
            )

        # --------------------------------------------------------
        # Work on a copy so the caller's dataframe is untouched.
        # --------------------------------------------------------

        df = df.copy()

        # --------------------------------------------------------
        # Validate required columns
        # --------------------------------------------------------

        required = [
            machine_id_column,
            timestamp_column,
            *telemetry_columns,
        ]

        missing = [
            column
            for column in required
            if column not in df.columns
        ]

        if missing:
            raise ValueError(
                f"Missing required columns: {missing}"
            )

        # --------------------------------------------------------
        # Prepare timestamps
        # --------------------------------------------------------

        df[timestamp_column] = pd.to_datetime(
            df[timestamp_column],
            errors="coerce",
            utc=True,
        )

        if df[timestamp_column].isna().any():
            raise ValueError(
                "Invalid timestamps detected."
            )

        # --------------------------------------------------------
        # Ensure telemetry values are numeric
        # --------------------------------------------------------

        for column in telemetry_columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce",
            )

        if df[telemetry_columns].isna().any().any():

            raise ValueError(
                "Invalid telemetry values detected."
            )

        # --------------------------------------------------------
        # Sort chronologically per machine
        # --------------------------------------------------------

        df = df.sort_values(
            [
                machine_id_column,
                timestamp_column,
            ]
        ).reset_index(drop=True)

        # --------------------------------------------------------
        # Generate temporal features independently
        # for every machine
        # --------------------------------------------------------

        result = []

        for machine_id, group in df.groupby(
            machine_id_column,
            sort=False,
        ):

            # machine_id is intentionally retained here so
            # static type checkers don't consider the grouped
            # value unused in future modifications.
            _ = machine_id

            group = group.copy()

            # ----------------------------------------------------
            # Time difference
            # ----------------------------------------------------

            time_delta = (
                group[timestamp_column]
                .diff()
                .dt.total_seconds()
            )

            # Prevent division by zero.
            time_delta = time_delta.replace(
                0,
                pd.NA,
            )

            # ----------------------------------------------------
            # Telemetry features
            # ----------------------------------------------------

            for column in telemetry_columns:

                # ----------------------------------------------
                # Current value
                # ----------------------------------------------

                group[
                    f"{column}__current"
                ] = group[column]

                # ----------------------------------------------
                # Delta
                # ----------------------------------------------

                group[
                    f"{column}__delta"
                ] = group[column].diff()

                # ----------------------------------------------
                # Rate per second
                # ----------------------------------------------

                group[
                    f"{column}__rate"
                ] = (
                    group[column].diff()
                    / time_delta
                )

                # ----------------------------------------------
                # Rolling statistics
                # ----------------------------------------------

                for window in rolling_windows:

                    rolling = (
                        group[column]
                        .rolling(
                            window=window,
                            min_periods=2,
                        )
                    )

                    group[
                        f"{column}__mean_{window}"
                    ] = rolling.mean()

                    group[
                        f"{column}__std_{window}"
                    ] = rolling.std()

                    group[
                        f"{column}__min_{window}"
                    ] = rolling.min()

                    group[
                        f"{column}__max_{window}"
                    ] = rolling.max()

            result.append(group)

        # --------------------------------------------------------
        # Safety check
        # --------------------------------------------------------

        if not result:

            raise ValueError(
                "Unable to generate temporal features."
            )

        features = pd.concat(
            result,
            ignore_index=True,
        )

        # --------------------------------------------------------
        # Numeric cleanup
        # --------------------------------------------------------

        numeric_columns = (
            features.select_dtypes(
                include="number"
            ).columns
        )

        features[numeric_columns] = (
            features[numeric_columns]
            .replace(
                [
                    float("inf"),
                    float("-inf"),
                ],
                pd.NA,
            )
        )

        return features

    # ============================================================
    # SUMMARY
    # ============================================================

    @staticmethod
    def summary(
        features: pd.DataFrame,
        machine_id_column: str,
    ) -> dict[str, Any]:

        feature_columns = [
            column
            for column in features.columns
            if column != machine_id_column
        ]

        return {
            "rows": int(
                len(features)
            ),

            "assets": int(
                features[
                    machine_id_column
                ].nunique()
            ),

            "feature_count": len(
                feature_columns
            ),

            "features": feature_columns,
        }