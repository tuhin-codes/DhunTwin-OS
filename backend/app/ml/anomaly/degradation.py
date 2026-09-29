from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.core.machine_types import normalize_machine_type
from app.ml.anomaly.baseline import LearnedBaseline


class DegradationEngine:

    def __init__(
        self,
        baseline: LearnedBaseline,
        window: int = 15,
    ):
        self.baseline = baseline
        self.window = window

    # ============================================================
    # DEVIATION THRESHOLDS
    # ============================================================

    # These thresholds operate on standardized deviation
    # from the learned dataset baseline.
    #
    # They are NOT machine-specific.
    #
    # This means the same logic works automatically for:
    #
    # Boiler
    # Pump
    # Compressor
    # Motor
    # CNC
    # Robot
    # etc.
    #
    # The dataset determines the baseline.
    # These thresholds determine the severity of deviation.

    ATTENTION_DEVIATION = 2.0
    DEGRADED_DEVIATION = 4.0
    CRITICAL_DEVIATION = 8.0

    # ============================================================
    # Calculate learned deviations
    # ============================================================

    def _deviations(
        self,
        row: pd.Series,
        machine_type_column: str,
        telemetry_columns: list[str],
    ) -> dict[str, dict[str, Any]]:

        machine_type = normalize_machine_type(
            row[machine_type_column]
        )

        deviations = {}

        for signal in telemetry_columns:

            if signal not in row:
                continue

            value = row[signal]

            if pd.isna(value):
                continue

            result = self.baseline.deviation(
                machine_type,
                signal,
                float(value),
            )

            if result["available"]:

                deviations[signal] = {
                    "deviation": float(
                        result["deviation"]
                    ),

                    "signed_deviation": float(
                        result.get(
                            "signed_deviation",
                            0.0,
                        )
                    ),

                    "position": result.get(
                        "position"
                    ),
                }

        return deviations

    # ============================================================
    # Aggregate deviation
    # ============================================================

    @staticmethod
    def _aggregate_deviation(
        deviations: dict[str, dict[str, Any]],
    ) -> float | None:

        if not deviations:
            return None

        values = np.asarray(
            [
                item["deviation"]
                for item in deviations.values()
            ],
            dtype=float,
        )

        return float(
            np.mean(values)
        )

    # ============================================================
    # Deviation trend
    # ============================================================

    @staticmethod
    def _trend(
        values: list[float],
    ) -> float | None:

        if len(values) < 3:
            return None

        y = np.asarray(
            values,
            dtype=float,
        )

        x = np.arange(
            len(y),
            dtype=float,
        )

        slope = np.polyfit(
            x,
            y,
            1,
        )[0]

        return float(slope)

    # ============================================================
    # Maximum signal deviation
    # ============================================================

    @staticmethod
    def _maximum_deviation(
        deviations: dict[str, dict[str, Any]],
    ) -> float | None:

        if not deviations:
            return None

        return max(
            float(
                item["deviation"]
            )
            for item in deviations.values()
        )

    # ============================================================
    # Count elevated signals
    # ============================================================

    @staticmethod
    def _elevated_signal_count(
        deviations: dict[str, dict[str, Any]],
        threshold: float,
    ) -> int:

        return sum(
            1
            for item in deviations.values()
            if float(
                item["deviation"]
            ) >= threshold
        )

    # ============================================================
    # Analyze machine history
    # ============================================================

    def analyze(
        self,
        dataframe: pd.DataFrame,
        index: int,
        machine_id_column: str,
        timestamp_column: str,
        machine_type_column: str,
        telemetry_columns: list[str],
    ) -> dict[str, Any]:

        if dataframe.empty:
            raise ValueError(
                "Cannot analyze degradation "
                "from an empty dataframe."
            )

        if index < 0 or index >= len(dataframe):
            raise IndexError(
                f"Invalid dataframe index: {index}"
            )

        row = dataframe.iloc[index]

        machine_id = str(
            row[machine_id_column]
        )

        machine_type = str(
            row[machine_type_column]
        )

        # --------------------------------------------------------
        # Machine-specific history
        # --------------------------------------------------------

        machine_rows = dataframe[
            dataframe[machine_id_column]
            .astype(str)
            == machine_id
        ].copy()

        machine_rows = machine_rows.sort_values(
            timestamp_column
        )

        history = machine_rows.tail(
            self.window
        ).copy()

        # --------------------------------------------------------
        # Deviation history
        # --------------------------------------------------------

        deviation_history = []

        for _, history_row in history.iterrows():

            deviations = self._deviations(
                history_row,
                machine_type_column,
                telemetry_columns,
            )

            aggregate = (
                self._aggregate_deviation(
                    deviations
                )
            )

            if aggregate is not None:
                deviation_history.append(
                    aggregate
                )

        # --------------------------------------------------------
        # Current deviations
        # --------------------------------------------------------

        current_deviations = (
            self._deviations(
                row,
                machine_type_column,
                telemetry_columns,
            )
        )

        current_deviation = (
            self._aggregate_deviation(
                current_deviations
            )
        )

        maximum_deviation = (
            self._maximum_deviation(
                current_deviations
            )
        )

        trend = self._trend(
            deviation_history
        )

        # --------------------------------------------------------
        # Baseline availability
        # --------------------------------------------------------

        baseline_available = bool(
            current_deviations
        )

        available_signal_count = len(
            current_deviations
        )

        total_signal_count = len(
            telemetry_columns
        )

        # --------------------------------------------------------
        # Elevated signal counts
        # --------------------------------------------------------

        attention_signal_count = (
            self._elevated_signal_count(
                current_deviations,
                self.ATTENTION_DEVIATION,
            )
        )

        degraded_signal_count = (
            self._elevated_signal_count(
                current_deviations,
                self.DEGRADED_DEVIATION,
            )
        )

        critical_signal_count = (
            self._elevated_signal_count(
                current_deviations,
                self.CRITICAL_DEVIATION,
            )
        )

        # --------------------------------------------------------
        # Anomaly persistence
        # --------------------------------------------------------

        persistence = 0

        anomaly_available = (
            "anomaly_prediction"
            in history.columns
        )

        if anomaly_available:

            values = (
                pd.to_numeric(
                    history[
                        "anomaly_prediction"
                    ],
                    errors="coerce",
                )
                .fillna(0)
                .astype(int)
                .tolist()
            )

            for value in reversed(values):

                if value == 1:
                    persistence += 1
                else:
                    break

        # --------------------------------------------------------
        # Learned condition
        # --------------------------------------------------------

        if not baseline_available:

            condition = (
                "INSUFFICIENT_EVIDENCE"
            )

        # --------------------------------------------------------
        # CRITICAL
        #
        # A single extremely abnormal signal is enough.
        # We do not require the trend to be increasing.
        # --------------------------------------------------------

        elif (
            maximum_deviation is not None
            and maximum_deviation
            >= self.CRITICAL_DEVIATION
        ):

            condition = "CRITICAL"

        # --------------------------------------------------------
        # DEGRADING
        #
        # Multiple strongly abnormal signals OR
        # persistent anomaly + meaningful deviation.
        # --------------------------------------------------------

        elif (
            degraded_signal_count >= 2
        ):

            condition = "DEGRADING"

        elif (
            persistence >= 2
            and current_deviation is not None
            and current_deviation
            >= self.DEGRADED_DEVIATION
        ):

            condition = "DEGRADING"

        # --------------------------------------------------------
        # PERSISTENT DEVIATION
        # --------------------------------------------------------

        elif persistence >= 2:

            condition = (
                "PERSISTENT_DEVIATION"
            )

        # --------------------------------------------------------
        # ATTENTION
        #
        # Current deviation matters even if the trend
        # is flat or decreasing.
        # --------------------------------------------------------

        elif (
            maximum_deviation is not None
            and maximum_deviation
            >= self.DEGRADED_DEVIATION
        ):

            condition = "DEGRADED"

        elif (
            current_deviation is not None
            and current_deviation
            >= self.ATTENTION_DEVIATION
        ):

            condition = "ATTENTION"

        # --------------------------------------------------------
        # EARLY DEVIATION
        # --------------------------------------------------------

        elif (
            trend is not None
            and trend > 0
        ):

            condition = "EARLY_DEVIATION"

        else:

            condition = "NORMAL"

        # --------------------------------------------------------
        # Dominant signals
        # --------------------------------------------------------

        dominant_signals = sorted(
            [
                {
                    "signal": signal,

                    "deviation": round(
                        values["deviation"],
                        4,
                    ),

                    "signed_deviation": round(
                        values[
                            "signed_deviation"
                        ],
                        4,
                    ),

                    "position": values[
                        "position"
                    ],
                }

                for signal, values
                in current_deviations.items()
            ],

            key=lambda item:
            item["deviation"],

            reverse=True,
        )

        # --------------------------------------------------------
        # Explanation
        # --------------------------------------------------------

        if not baseline_available:

            explanation = (
                "No learned baseline exists for "
                f"machine type '{machine_type}'. "
                "Degradation evidence is unavailable."
            )

        elif condition == "CRITICAL":

            explanation = (
                "At least one telemetry signal is "
                "far outside its learned baseline."
            )

        elif condition == "DEGRADING":

            explanation = (
                "Multiple telemetry signals show "
                "significant deviation from the learned "
                "baseline or persistent abnormal behavior."
            )

        elif condition == "PERSISTENT_DEVIATION":

            explanation = (
                "The machine has remained persistently "
                "outside its learned baseline."
            )

        elif condition == "DEGRADED":

            explanation = (
                "At least one telemetry signal shows "
                "significant deviation from its learned "
                "baseline."
            )

        elif condition == "ATTENTION":

            explanation = (
                "Current telemetry shows moderate "
                "deviation from the learned baseline."
            )

        elif condition == "EARLY_DEVIATION":

            explanation = (
                "The machine is beginning to move away "
                "from its learned baseline."
            )

        else:

            explanation = (
                "Current telemetry remains close to "
                "the learned baseline pattern."
            )

        # ========================================================
        # Return
        # ========================================================

        return {
            "machine_id": machine_id,

            "timestamp": str(
                row[timestamp_column]
            ),

            "machine_type": machine_type,

            "normalized_machine_type":
                normalize_machine_type(
                    machine_type
                ),

            "condition": condition,

            "baseline_available": (
                baseline_available
            ),

            "available_signal_count": (
                available_signal_count
            ),

            "total_signal_count": (
                total_signal_count
            ),

            "current_deviation": (
                round(
                    current_deviation,
                    4,
                )
                if current_deviation is not None
                else None
            ),

            "maximum_deviation": (
                round(
                    maximum_deviation,
                    4,
                )
                if maximum_deviation is not None
                else None
            ),

            "deviation_trend": (
                round(
                    trend,
                    6,
                )
                if trend is not None
                else None
            ),

            "attention_signal_count": (
                attention_signal_count
            ),

            "degraded_signal_count": (
                degraded_signal_count
            ),

            "critical_signal_count": (
                critical_signal_count
            ),

            "anomaly_available": (
                anomaly_available
            ),

            "anomaly_persistence": (
                persistence
                if anomaly_available
                else None
            ),

            "dominant_signals":
                dominant_signals,

            "history_points":
                len(deviation_history),

            "explanation":
                explanation,
        }

    # ============================================================
    # Analyze latest observation for one machine
    # ============================================================

    def analyze_latest_machine(
        self,
        dataframe: pd.DataFrame,
        machine_id: str,
        machine_id_column: str,
        timestamp_column: str,
        machine_type_column: str,
        telemetry_columns: list[str],
    ) -> dict[str, Any] | None:

        if dataframe.empty:
            return None

        machine_id = str(
            machine_id
        )

        machine_rows = dataframe[
            dataframe[
                machine_id_column
            ].astype(str)
            == machine_id
        ].copy()

        if machine_rows.empty:
            return None

        machine_rows = (
            machine_rows
            .sort_values(
                timestamp_column
            )
            .reset_index(
                drop=True
            )
        )

        return self.analyze(
            machine_rows,
            len(machine_rows) - 1,
            machine_id_column,
            timestamp_column,
            machine_type_column,
            telemetry_columns,
        )

    # ============================================================
    # Analyze latest observation for every machine
    # ============================================================

    def analyze_latest(
        self,
        dataframe: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        machine_type_column: str,
        telemetry_columns: list[str],
    ) -> list[dict[str, Any]]:

        results = []

        if dataframe.empty:
            return results

        for _, group in dataframe.groupby(
            machine_id_column,
            sort=False,
        ):

            group = (
                group
                .sort_values(
                    timestamp_column
                )
                .reset_index(
                    drop=True
                )
            )

            if group.empty:
                continue

            result = self.analyze(
                group,
                len(group) - 1,
                machine_id_column,
                timestamp_column,
                machine_type_column,
                telemetry_columns,
            )

            results.append(
                result
            )

        return results