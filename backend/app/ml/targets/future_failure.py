from pathlib import Path

import pandas as pd


class FutureFailureTarget:

    # ============================================================
    # BUILD FUTURE FAILURE TARGETS
    # ============================================================

    @staticmethod
    def build(
        dataset_path: str | Path,
        machine_id_column: str,
        timestamp_column: str,
        failure_column: str = "Failure_Event",
        horizons_minutes: tuple[int, ...] = (30, 60, 120),
    ) -> pd.DataFrame:

        path = Path(dataset_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Dataset not found: {path}"
            )

        df = pd.read_csv(path)

        # --------------------------------------------------------
        # Validate required columns
        # --------------------------------------------------------

        required = [
            machine_id_column,
            timestamp_column,
            failure_column,
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
        # Validate horizons
        # --------------------------------------------------------

        if not horizons_minutes:
            raise ValueError(
                "At least one prediction horizon is required."
            )

        horizons = tuple(
            int(horizon)
            for horizon in horizons_minutes
        )

        if any(
            horizon <= 0
            for horizon in horizons
        ):
            raise ValueError(
                "Prediction horizons must be positive."
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
        # Normalize failure column
        # --------------------------------------------------------

        failure_values = pd.to_numeric(
            df[failure_column],
            errors="coerce",
        )

        if failure_values.isna().any():
            raise ValueError(
                f"Invalid values detected in "
                f"failure column: {failure_column}"
            )

        df[failure_column] = (
            failure_values
            .astype(int)
        )

        # --------------------------------------------------------
        # Validate failure values
        # --------------------------------------------------------

        invalid_failure_values = (
            ~df[failure_column].isin([0, 1])
        )

        if invalid_failure_values.any():
            raise ValueError(
                f"Failure column '{failure_column}' "
                "must contain only 0 or 1."
            )

        # --------------------------------------------------------
        # Sort chronologically per machine
        # --------------------------------------------------------

        df = (
            df.sort_values(
                [
                    machine_id_column,
                    timestamp_column,
                ]
            )
            .reset_index(drop=True)
        )

        # ========================================================
        # FIND NEXT FUTURE FAILURE
        # ========================================================

        #
        # For every machine we determine the timestamp of the
        # first failure strictly AFTER the current timestamp.
        #
        # Example:
        #
        # current time = 10:00
        # next failure = 10:23
        #
        # Then:
        #
        # 30m  -> 1
        # 60m  -> 1
        # 120m -> 1
        #
        # If next failure = 10:47:
        #
        # 30m  -> 0
        # 60m  -> 1
        # 120m -> 1
        #
        # If next failure = 11:35:
        #
        # 30m  -> 0
        # 60m  -> 0
        # 120m -> 1
        #
        # This creates proper cumulative future-failure targets.
        #

        next_failure_timestamp = pd.Series(
            pd.NaT,
            index=df.index,
            dtype="datetime64[ns, UTC]",
        )

        for machine_id, group in df.groupby(
            machine_id_column,
            sort=False,
        ):

            failure_times = (
                group.loc[
                    group[failure_column] == 1,
                    timestamp_column,
                ]
                .sort_values()
                .reset_index(drop=True)
            )

            if failure_times.empty:
                continue

            current_times = (
                group[timestamp_column]
                .to_numpy()
            )

            future_failures = (
                failure_times
                .to_numpy()
            )

            # ----------------------------------------------------
            # Search for the first failure strictly after each
            # current timestamp.
            # ----------------------------------------------------

            positions = (
                future_failures.searchsorted(
                    current_times,
                    side="right",
                )
            )

            valid = (
                positions
                < len(future_failures)
            )

            next_values = pd.Series(
                pd.NaT,
                index=group.index,
                dtype="datetime64[ns, UTC]",
            )

            if valid.any():

                valid_positions = (
                    positions[valid]
                )

                next_values.loc[
                    group.index[valid]
                ] = (
                    pd.to_datetime(
                        future_failures[
                            valid_positions
                        ],
                        utc=True,
                    )
                )

            next_failure_timestamp.loc[
                group.index
            ] = next_values

        # --------------------------------------------------------
        # Keep the intermediate next-failure timestamp internal.
        # --------------------------------------------------------

        # ========================================================
        # CREATE HORIZON TARGETS
        # ========================================================

        for horizon in horizons:

            target_column = (
                f"failure_next_{horizon}m"
            )

            future_limit = (
                df[timestamp_column]
                + pd.Timedelta(
                    minutes=horizon
                )
            )

            has_future_failure = (
                next_failure_timestamp.notna()
                & (
                    next_failure_timestamp
                    <= future_limit
                )
            )

            df[target_column] = (
                has_future_failure
                .astype(int)
            )

        # ========================================================
        # ENFORCE CUMULATIVE TARGET CONSISTENCY
        # ========================================================

        #
        # The construction above already guarantees this
        # mathematically, but this explicit check protects the
        # training pipeline from future modifications.
        #

        target_columns = [
            f"failure_next_{horizon}m"
            for horizon in horizons
        ]

        ordered_targets = sorted(
            target_columns,
            key=lambda column: int(
                column
                .split("_")[-1]
                .replace("m", "")
            ),
        )

        for previous, current in zip(
            ordered_targets,
            ordered_targets[1:],
        ):

            invalid = (
                df[current]
                < df[previous]
            )

            if invalid.any():

                raise ValueError(
                    "Future failure targets are not "
                    "cumulative. "
                    f"'{current}' contains values "
                    f"lower than '{previous}'."
                )

        return df

    # ============================================================
    # SUMMARY
    # ============================================================

    @staticmethod
    def summary(
        df: pd.DataFrame,
        horizons_minutes: tuple[int, ...] = (
            30,
            60,
            120,
        ),
    ) -> dict:

        result = {
            "rows": int(len(df)),
            "targets": {},
        }

        if df.empty:
            return result

        for horizon in horizons_minutes:

            column = (
                f"failure_next_{horizon}m"
            )

            if column not in df.columns:
                continue

            positives = int(
                df[column].sum()
            )

            negatives = int(
                len(df) - positives
            )

            result["targets"][column] = {
                "positive": positives,
                "negative": negatives,
                "positive_rate": round(
                    positives / len(df),
                    6,
                ),
            }

        # --------------------------------------------------------
        # Verify cumulative target relationship in summary.
        # --------------------------------------------------------

        ordered_columns = [
            f"failure_next_{horizon}m"
            for horizon in sorted(
                horizons_minutes
            )
            if (
                f"failure_next_{horizon}m"
                in df.columns
            )
        ]

        cumulative = True

        for previous, current in zip(
            ordered_columns,
            ordered_columns[1:],
        ):

            if (
                df[current]
                < df[previous]
            ).any():

                cumulative = False
                break

        result["cumulative_targets"] = cumulative

        return result