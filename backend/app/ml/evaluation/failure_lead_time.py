from pathlib import Path

import joblib
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

HORIZONS = {
    "30m": 30,
    "60m": 60,
    "120m": 120,
}


def main():

    print()
    print("==========================================")
    print("CarbonTwin Failure Lead-Time Evaluation")
    print("==========================================")

    raw = pd.read_csv(
        DATASET_PATH,
        parse_dates=["Timestamp"],
    )

    features = TemporalFeatureEngine.build(
        DATASET_PATH,
        machine_id_column="Machine_ID",
        timestamp_column="Timestamp",
        telemetry_columns=TELEMETRY_COLUMNS,
    )

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

    X = features[feature_columns]

    # --------------------------------------------------
    # Generate model probabilities
    # --------------------------------------------------

    for horizon in HORIZONS:

        model_path = (
            MODEL_DIR
            / f"failure_{horizon}.pkl"
        )

        model = joblib.load(model_path)

        raw[
            f"probability_{horizon}"
        ] = model.predict_proba(X)[:, 1]

    # --------------------------------------------------
    # Evaluate every actual failure
    # --------------------------------------------------

    failure_rows = raw[
        raw["Failure_Event"] == 1
    ].copy()

    results = []

    for _, failure in failure_rows.iterrows():

        machine_id = failure["Machine_ID"]
        failure_time = failure["Timestamp"]

        machine_data = raw[
            raw["Machine_ID"] == machine_id
        ].copy()

        machine_data = machine_data[
            machine_data["Timestamp"]
            < failure_time
        ]

        result = {
            "Machine_ID": machine_id,
            "Machine_Type": failure["Machine_Type"],
            "Failure_Time": failure_time,
            "Failure_Episode": failure[
                "Failure_Episode"
            ],
        }

        for horizon, minutes in HORIZONS.items():

            probability_column = (
                f"probability_{horizon}"
            )

            # --------------------------------------------------
            # Only predictions that occurred within the
            # prediction horizon before the failure.
            # --------------------------------------------------

            window_start = (
                failure_time
                - pd.Timedelta(
                    minutes=minutes
                )
            )

            candidates = machine_data[
                machine_data["Timestamp"]
                >= window_start
            ].copy()

            candidates = candidates[
                candidates[
                    probability_column
                ] >= 0.50
            ]

            if len(candidates) == 0:

                result[
                    f"{horizon}_detected"
                ] = False

                result[
                    f"{horizon}_lead_minutes"
                ] = None

                result[
                    f"{horizon}_detection_probability"
                ] = None

            else:

                # Earliest detection
                detection = candidates.iloc[0]

                lead = (
                    failure_time
                    - detection["Timestamp"]
                ).total_seconds() / 60

                result[
                    f"{horizon}_detected"
                ] = True

                result[
                    f"{horizon}_lead_minutes"
                ] = lead

                result[
                    f"{horizon}_detection_probability"
                ] = detection[
                    probability_column
                ]

        results.append(result)

    results = pd.DataFrame(results)

    # --------------------------------------------------
    # Summary
    # --------------------------------------------------

    print()
    print("Failures evaluated:", len(results))

    for horizon in HORIZONS:

        detected_column = (
            f"{horizon}_detected"
        )

        lead_column = (
            f"{horizon}_lead_minutes"
        )

        detected = results[
            detected_column
        ].sum()

        total = len(results)

        detection_rate = (
            detected / total
            if total
            else 0
        )

        leads = results[
            results[detected_column]
        ][lead_column]

        print()
        print(
            f"========== {horizon} =========="
        )

        print(
            f"Detected       : "
            f"{detected}/{total}"
        )

        print(
            f"Detection rate : "
            f"{detection_rate:.3f}"
        )

        if len(leads):

            print(
                f"Mean lead time : "
                f"{leads.mean():.1f} min"
            )

            print(
                f"Median lead    : "
                f"{leads.median():.1f} min"
            )

            print(
                f"Minimum lead   : "
                f"{leads.min():.1f} min"
            )

            print(
                f"Maximum lead   : "
                f"{leads.max():.1f} min"
            )

    # --------------------------------------------------
    # Detailed results
    # --------------------------------------------------

    print()
    print("==========================================")
    print("Failure Detection Details")
    print("==========================================")

    columns = [
        "Machine_ID",
        "Machine_Type",
        "Failure_Time",
        "Failure_Episode",
        "30m_detected",
        "30m_lead_minutes",
        "60m_detected",
        "60m_lead_minutes",
        "120m_detected",
        "120m_lead_minutes",
    ]

    print(
        results[columns]
        .to_string(index=False)
    )


if __name__ == "__main__":
    main()