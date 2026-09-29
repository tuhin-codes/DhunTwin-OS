from pathlib import Path

import pandas as pd

from app.ml.telemetry.features import TemporalFeatureEngine
from app.ml.targets.future_failure import FutureFailureTarget


class PredictiveDatasetBuilder:

    TELEMETRY_COLUMNS = [
        "Temperature",
        "Pressure",
        "Vibration",
        "Power",
    ]

    TARGET_COLUMNS = [
        "failure_next_30m",
        "failure_next_60m",
        "failure_next_120m",
    ]

    LEAKAGE_COLUMNS = [
        "Failure_Event",
        "Failure_Episode",
        "Development_State",
    ]

    METADATA_COLUMNS = [
        "Machine_ID",
        "Timestamp",
        "Machine_Type",
        "Department",
        "Location",
    ]

    @classmethod
    def build(
        cls,
        dataset_path: str | Path,
    ) -> pd.DataFrame:

        features = TemporalFeatureEngine.build(
            dataset_path,
            machine_id_column="Machine_ID",
            timestamp_column="Timestamp",
            telemetry_columns=cls.TELEMETRY_COLUMNS,
        )

        targets = FutureFailureTarget.build(
            dataset_path,
            machine_id_column="Machine_ID",
            timestamp_column="Timestamp",
        )

        target_data = targets[
            [
                "Machine_ID",
                "Timestamp",
            ] + cls.TARGET_COLUMNS
        ]

        df = features.merge(
            target_data,
            on=[
                "Machine_ID",
                "Timestamp",
            ],
            how="inner",
        )

        # --------------------------------------------------
        # Remove leakage
        # --------------------------------------------------

        remove_columns = (
            cls.LEAKAGE_COLUMNS
            + cls.TARGET_COLUMNS
        )

        feature_columns = [
            column
            for column in df.columns
            if column not in (
                remove_columns
                + cls.METADATA_COLUMNS
            )
        ]

        # --------------------------------------------------
        # Keep useful columns only
        # --------------------------------------------------

        columns = (
            cls.METADATA_COLUMNS
            + feature_columns
            + cls.TARGET_COLUMNS
        )

        df = df[columns].copy()

        # --------------------------------------------------
        # Ensure chronological ordering per machine
        # --------------------------------------------------

        df = df.sort_values(
            [
                "Machine_ID",
                "Timestamp",
            ]
        ).reset_index(drop=True)

        return df

    @classmethod
    def feature_columns(
        cls,
        df: pd.DataFrame,
    ) -> list[str]:

        excluded = (
            cls.METADATA_COLUMNS
            + cls.TARGET_COLUMNS
        )

        return [
            column
            for column in df.columns
            if column not in excluded
        ]

    @classmethod
    def split_by_time(
        cls,
        df: pd.DataFrame,
        train_ratio: float = 0.70,
        validation_ratio: float = 0.15,
    ) -> dict:

        train_parts = []
        validation_parts = []
        test_parts = []

        for machine_id, group in df.groupby(
            "Machine_ID",
            sort=False,
        ):

            group = group.sort_values(
                "Timestamp"
            ).reset_index(drop=True)

            n = len(group)

            train_end = int(
                n * train_ratio
            )

            validation_end = int(
                n * (
                    train_ratio
                    + validation_ratio
                )
            )

            train_parts.append(
                group.iloc[:train_end]
            )

            validation_parts.append(
                group.iloc[
                    train_end:validation_end
                ]
            )

            test_parts.append(
                group.iloc[validation_end:]
            )

        train = pd.concat(
            train_parts,
            ignore_index=True,
        )

        validation = pd.concat(
            validation_parts,
            ignore_index=True,
        )

        test = pd.concat(
            test_parts,
            ignore_index=True,
        )

        return {
            "train": train,
            "validation": validation,
            "test": test,
        }

    @classmethod
    def summary(
        cls,
        splits: dict,
    ) -> dict:

        result = {}

        for name, data in splits.items():

            result[name] = {
                "rows": len(data),
                "machines": int(
                    data["Machine_ID"].nunique()
                ),
                "min_timestamp": str(
                    data["Timestamp"].min()
                ),
                "max_timestamp": str(
                    data["Timestamp"].max()
                ),
                "targets": {
                    target: int(
                        data[target].sum()
                    )
                    for target
                    in cls.TARGET_COLUMNS
                },
            }

        return result
