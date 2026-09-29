from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.machine_types import (
    normalize_machine_type,
)


class LearnedBaseline:

    def __init__(
        self,
        minimum_samples: int = 30,
    ):
        self.minimum_samples = minimum_samples
        self.baselines = {}

    # --------------------------------------------------
    # Fit
    # --------------------------------------------------

    def fit(
        self,
        dataframe: pd.DataFrame,
        machine_type_column: str,
        machine_id_column: str,
        telemetry_columns: list[str],
    ):

        self.baselines = {}

        # --------------------------------------------------
        # Learn machine-type baseline
        # --------------------------------------------------

        for machine_type, group in dataframe.groupby(
            machine_type_column
        ):

            normalized_type = (
                normalize_machine_type(
                    machine_type
                )
            )

            if not normalized_type:
                continue

            # --------------------------------------------------
            # Merge aliases into the same canonical type
            # --------------------------------------------------

            type_baseline = self.baselines.setdefault(
                normalized_type,
                {},
            )

            for signal in telemetry_columns:

                if signal not in group.columns:
                    continue

                values = pd.to_numeric(
                    group[signal],
                    errors="coerce",
                ).dropna()

                if len(values) < self.minimum_samples:
                    continue

                existing = type_baseline.get(
                    signal
                )

                # --------------------------------------------------
                # Store raw values temporarily so aliases can be
                # merged correctly.
                # --------------------------------------------------

                if existing is None:

                    type_baseline[signal] = {
                        "_values": values.tolist(),
                    }

                else:

                    existing["_values"].extend(
                        values.tolist()
                    )

        # --------------------------------------------------
        # Calculate statistics after all aliases are merged
        # --------------------------------------------------

        for machine_type, signals in self.baselines.items():

            for signal, data in list(
                signals.items()
            ):

                values = pd.Series(
                    data["_values"],
                    dtype=float,
                ).dropna()

                if len(values) < self.minimum_samples:
                    del signals[signal]
                    continue

                signals[signal] = {
                    "median": float(
                        values.median()
                    ),

                    "mean": float(
                        values.mean()
                    ),

                    "std": float(
                        values.std()
                    ),

                    "q01": float(
                        values.quantile(0.01)
                    ),

                    "q05": float(
                        values.quantile(0.05)
                    ),

                    "q25": float(
                        values.quantile(0.25)
                    ),

                    "q75": float(
                        values.quantile(0.75)
                    ),

                    "q95": float(
                        values.quantile(0.95)
                    ),

                    "q99": float(
                        values.quantile(0.99)
                    ),

                    "samples": int(
                        len(values)
                    ),
                }

        return self

    # --------------------------------------------------
    # Deviation from learned baseline
    # --------------------------------------------------

    def deviation(
        self,
        machine_type: str,
        signal: str,
        value: float,
    ) -> dict[str, Any]:

        normalized_type = (
            normalize_machine_type(
                machine_type
            )
        )

        baseline = self.baselines.get(
            normalized_type,
            {},
        )

        stats = baseline.get(signal)

        if stats is None:

            return {
                "available": False,
                "deviation": None,
                "position": None,
                "reason": (
                    "No training baseline exists "
                    f"for machine type '{machine_type}'."
                ),
            }

        median = stats["median"]

        scale = max(
            stats["std"],
            1e-9,
        )

        standardized = (
            float(value) - median
        ) / scale

        return {
            "available": True,

            "deviation": round(
                abs(standardized),
                6,
            ),

            "signed_deviation": round(
                standardized,
                6,
            ),

            "position": (
                "above"
                if standardized > 0
                else "below"
                if standardized < 0
                else "near_baseline"
            ),

            "baseline": {
                "median": round(
                    median,
                    6,
                ),

                "mean": round(
                    stats["mean"],
                    6,
                ),

                "std": round(
                    stats["std"],
                    6,
                ),
            },
        }

    # --------------------------------------------------
    # Explain observation
    # --------------------------------------------------

    def explain(
        self,
        row: pd.Series,
        machine_type_column: str,
        telemetry_columns: list[str],
    ) -> dict[str, Any]:

        machine_type = str(
            row[machine_type_column]
        )

        normalized_type = (
            normalize_machine_type(
                machine_type
            )
        )

        signals = {}

        for signal in telemetry_columns:

            if signal not in row:
                continue

            value = row[signal]

            if pd.isna(value):
                continue

            signals[signal] = self.deviation(
                machine_type,
                signal,
                float(value),
            )

        available_signal_count = sum(
            1
            for result in signals.values()
            if result.get("available", False)
        )

        return {
            "machine_type": machine_type,

            "normalized_machine_type":
                normalized_type,

            "signals": signals,

            "available":
                available_signal_count > 0,

            "available_signal_count":
                available_signal_count,

            "total_signal_count":
                len(signals),
        }

    # --------------------------------------------------
    # Summary
    # --------------------------------------------------

    def summary(self) -> dict[str, Any]:

        return {
            "machine_types": sorted(
                self.baselines.keys()
            ),

            "signals_by_type": {
                machine_type: sorted(
                    signals.keys()
                )
                for machine_type, signals
                in self.baselines.items()
            },
        }