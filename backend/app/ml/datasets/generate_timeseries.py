from pathlib import Path

import numpy as np
import pandas as pd


# ============================================================
# Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

SOURCE_DATASET = BASE_DIR / "test_factory.csv"
OUTPUT_DATASET = BASE_DIR / "factory_timeseries.csv"

OBSERVATIONS_PER_MACHINE = 1000
RANDOM_SEED = 42

rng = np.random.default_rng(RANDOM_SEED)


# ============================================================
# Load factory assets
# ============================================================

assets = pd.read_csv(SOURCE_DATASET)

required_columns = [
    "Machine_ID",
    "Machine_Type",
    "Department",
    "Location",
    "Temperature",
    "Pressure",
    "Vibration",
    "Power",
]

missing = [
    column
    for column in required_columns
    if column not in assets.columns
]

if missing:
    raise ValueError(
        f"Missing required columns: {missing}"
    )


# ============================================================
# Generate telemetry
# ============================================================

rows = []

start_time = pd.Timestamp(
    "2026-01-01 00:00:00",
    tz="UTC",
)


for _, asset in assets.iterrows():

    machine_id = str(asset["Machine_ID"])
    machine_type = str(asset["Machine_Type"])
    department = str(asset["Department"])
    location = str(asset["Location"])

    base_temperature = float(asset["Temperature"])
    base_pressure = float(asset["Pressure"])
    base_vibration = float(asset["Vibration"])
    base_power = float(asset["Power"])

    # Machine-specific characteristics
    temp_offset = rng.normal(0, 1.5)
    pressure_offset = rng.normal(0, 0.08)
    vibration_offset = rng.normal(0, 0.05)
    power_offset = rng.normal(0, 3.0)

    # --------------------------------------------------------
    # Multiple degradation windows
    #
    # This is important:
    # failures are distributed throughout the dataset rather
    # than being concentrated only in the final test period.
    # --------------------------------------------------------

    degradation_windows = [
        (
            int(
                rng.integers(
                    180,
                    300,
                )
            ),
            int(
                rng.integers(
                    320,
                    430,
                )
            ),
        ),
        (
            int(
                rng.integers(
                    520,
                    620,
                )
            ),
            int(
                rng.integers(
                    680,
                    780,
                )
            ),
        ),
        (
            int(
                rng.integers(
                    800,
                    850,
                )
            ),
            int(
                rng.integers(
                    900,
                    950,
                )
            ),
        ),
    ]

    failure_episode = 0

    for step in range(OBSERVATIONS_PER_MACHINE):

        timestamp = (
            start_time
            + pd.Timedelta(minutes=step)
        )

        # ----------------------------------------------------
        # Normal telemetry
        # ----------------------------------------------------

        temperature = (
            base_temperature
            + temp_offset
            + 1.5 * np.sin(step / 40)
            + rng.normal(0, 0.6)
        )

        pressure = (
            base_pressure
            + pressure_offset
            + 0.08 * np.sin(step / 35)
            + rng.normal(0, 0.04)
        )

        vibration = (
            base_vibration
            + vibration_offset
            + rng.normal(0, 0.035)
        )

        power = (
            base_power
            + power_offset
            + 3.0 * np.sin(step / 30)
            + rng.normal(0, 1.5)
        )

        development_state = "NORMAL"
        failure_event = 0
        degradation = 0.0

        # ----------------------------------------------------
        # Determine degradation
        # ----------------------------------------------------

        active_window = None

        for window_start, window_end in degradation_windows:

            if window_start <= step <= window_end:
                active_window = (
                    window_start,
                    window_end,
                )
                break

        if active_window is not None:

            window_start, window_end = active_window

            progress = (
                step - window_start
            ) / (
                window_end - window_start
            )

            degradation = min(
                max(progress, 0.0),
                1.0,
            )

            development_state = "DEGRADING"

            temperature += (
                5.0 * degradation
            )

            pressure += (
                0.35 * degradation
            )

            vibration += (
                0.65 * degradation
            )

            power += (
                18.0 * degradation
            )

            # ------------------------------------------------
            # Pre-failure region
            # ------------------------------------------------

            if degradation >= 0.70:

                development_state = "PRE_FAILURE"

        # ----------------------------------------------------
        # Failure event
        #
        # More likely near the end of degradation.
        # ----------------------------------------------------

        failure_probability = 0.0

        if degradation >= 0.85:
            failure_probability = 0.10
        elif degradation >= 0.70:
            failure_probability = 0.025

        if (
            failure_probability > 0
            and rng.random() < failure_probability
        ):

            failure_event = 1
            failure_episode += 1
            development_state = "FAILURE"

            temperature += rng.uniform(
                3,
                8,
            )

            pressure += rng.uniform(
                0.2,
                0.6,
            )

            vibration += rng.uniform(
                0.2,
                0.6,
            )

            power += rng.uniform(
                8,
                25,
            )

        # ----------------------------------------------------
        # Store observation
        # ----------------------------------------------------

        rows.append(
            {
                "Machine_ID": machine_id,
                "Timestamp": timestamp,
                "Machine_Type": machine_type,
                "Department": department,
                "Location": location,

                "Temperature": round(
                    temperature,
                    3,
                ),

                "Pressure": round(
                    pressure,
                    3,
                ),

                "Vibration": round(
                    max(vibration, 0),
                    3,
                ),

                "Power": round(
                    max(power, 0),
                    3,
                ),

                # Development-only ground truth
                "Failure_Event": failure_event,

                # Development-only state
                "Development_State": (
                    development_state
                ),

                # Development-only event identifier
                "Failure_Episode": (
                    failure_episode
                    if failure_event
                    else None
                ),
            }
        )


# ============================================================
# Save dataset
# ============================================================

df = pd.DataFrame(rows)

df = df.sort_values(
    [
        "Machine_ID",
        "Timestamp",
    ]
).reset_index(drop=True)

df.to_csv(
    OUTPUT_DATASET,
    index=False,
)


# ============================================================
# Summary
# ============================================================

print()
print("==========================================")
print("CarbonTwin Time-Series Dataset")
print("==========================================")
print()

print(
    f"Dataset      : {OUTPUT_DATASET.name}"
)

print(
    f"Machines     : "
    f"{df['Machine_ID'].nunique()}"
)

print(
    f"Observations : {len(df)}"
)

print(
    f"Per machine  : "
    f"{OBSERVATIONS_PER_MACHINE}"
)

print()

print("Machine types:")

print(
    df.groupby(
        "Machine_Type"
    )["Machine_ID"]
    .nunique()
    .to_dict()
)

print()

print("Development states:")

print(
    df["Development_State"]
    .value_counts()
    .to_dict()
)

print()

print("Failure events:")

print(
    int(
        df["Failure_Event"].sum()
    )
)

print()

print("Failure episodes:")

print(
    int(
        df["Failure_Episode"]
        .dropna()
        .nunique()
    )
)

print()

print(
    f"Saved to: {OUTPUT_DATASET}"
)