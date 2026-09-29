from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from app.ml.telemetry.features import TemporalFeatureEngine


BASE_DIR = Path(__file__).resolve().parents[1]

DATASET_PATH = (
    BASE_DIR
    / "datasets"
    / "factory_timeseries.csv"
)

MODEL_DIR = (
    BASE_DIR
    / "models"
)

TELEMETRY_COLUMNS = [
    "Temperature",
    "Pressure",
    "Vibration",
    "Power",
]

TARGETS = {
    "30m": "failure_next_30m",
    "60m": "failure_next_60m",
    "120m": "failure_next_120m",
}


def main():

    print()
    print("==========================================")
    print("CarbonTwin Predictive Model Backtest")
    print("==========================================")

    # --------------------------------------------------
    # Load dataset
    # --------------------------------------------------

    df = pd.read_csv(
        DATASET_PATH,
        parse_dates=["Timestamp"],
    )

    print()
    print("Rows:", len(df))
    print("Machines:", df["Machine_ID"].nunique())

    # --------------------------------------------------
    # Build temporal features
    # --------------------------------------------------

    features = TemporalFeatureEngine.build(
        DATASET_PATH,
        machine_id_column="Machine_ID",
        timestamp_column="Timestamp",
        telemetry_columns=TELEMETRY_COLUMNS,
    )

    # --------------------------------------------------
    # Load models
    # --------------------------------------------------

    models = {}

    for horizon in TARGETS:

        path = (
            MODEL_DIR
            / f"failure_{horizon}.pkl"
        )

        models[horizon] = joblib.load(path)

    # --------------------------------------------------
    # Feature columns
    # --------------------------------------------------

    metadata_columns = [
        "Machine_ID",
        "Timestamp",
        "Machine_Type",
        "Department",
        "Location",
        "Failure_Event",
        "Failure_Episode",
        "Development_State",
    ]

    feature_columns = [
        column
        for column in features.columns
        if column not in metadata_columns
    ]

    print()
    print("Features:", len(feature_columns))

    X = features[feature_columns]

    # --------------------------------------------------
    # Generate probabilities
    # --------------------------------------------------

    for horizon, model in models.items():

        df[
            f"predicted_{horizon}"
        ] = model.predict_proba(X)[:, 1]

    # --------------------------------------------------
    # Backtest only rows where a future
    # prediction can actually be evaluated.
    # --------------------------------------------------

    results = []

    for machine_id, group in df.groupby(
        "Machine_ID",
        sort=False,
    ):

        group = group.sort_values(
            "Timestamp"
        ).reset_index(drop=True)

        for i, row in group.iterrows():

            result = {
                "Machine_ID": machine_id,
                "Timestamp": row["Timestamp"],
                "Failure_Event": int(
                    row["Failure_Event"]
                ),
            }

            valid = True

            for horizon, target in TARGETS.items():

                minutes = int(
                    horizon.replace("m", "")
                )

                future_end = i + minutes

                if future_end >= len(group):
                    valid = False
                    break

                actual = int(
                    group.iloc[
                        i + 1:future_end + 1
                    ]["Failure_Event"].max()
                )

                probability = float(
                    row[
                        f"predicted_{horizon}"
                    ]
                )

                result[
                    f"probability_{horizon}"
                ] = probability

                result[
                    f"actual_{horizon}"
                ] = actual

            if valid:
                results.append(result)

    results = pd.DataFrame(results)

    print()
    print(
        "Evaluated rows:",
        len(results),
    )

    # --------------------------------------------------
    # Evaluate thresholds
    # --------------------------------------------------

    thresholds = [
        0.10,
        0.20,
        0.30,
        0.50,
        0.70,
    ]

    print()
    print("==========================================")
    print("Prediction Backtest")
    print("==========================================")

    for horizon in TARGETS:

        probability_column = (
            f"probability_{horizon}"
        )

        actual_column = (
            f"actual_{horizon}"
        )

        print()
        print(
            f"========== {horizon} =========="
        )

        for threshold in thresholds:

            predicted = (
                results[
                    probability_column
                ] >= threshold
            )

            actual = (
                results[
                    actual_column
                ] == 1
            )

            tp = int(
                (predicted & actual).sum()
            )

            fp = int(
                (predicted & ~actual).sum()
            )

            fn = int(
                (~predicted & actual).sum()
            )

            tn = int(
                (~predicted & ~actual).sum()
            )

            precision = (
                tp / (tp + fp)
                if tp + fp > 0
                else 0
            )

            recall = (
                tp / (tp + fn)
                if tp + fn > 0
                else 0
            )

            print(
                f"threshold={threshold:.2f} "
                f"TP={tp:4d} "
                f"FP={fp:4d} "
                f"FN={fn:4d} "
                f"TN={tn:4d} "
                f"precision={precision:.3f} "
                f"recall={recall:.3f}"
            )

    # --------------------------------------------------
    # Failure-focused analysis
    # --------------------------------------------------

    print()
    print("==========================================")
    print("Actual Failure Analysis")
    print("==========================================")

    failures = results[
        results["Failure_Event"] == 1
    ]

    print(
        "Failure rows evaluated:",
        len(failures),
    )

    for horizon in TARGETS:

        column = f"probability_{horizon}"

        print()
        print(
            f"{horizon} probabilities "
            "at actual failure rows:"
        )

        print(
            failures[
                [
                    "Machine_ID",
                    "Timestamp",
                    column,
                ]
            ]
            .sort_values(column, ascending=False)
            .head(20)
            .to_string(index=False)
        )


if __name__ == "__main__":
    main()