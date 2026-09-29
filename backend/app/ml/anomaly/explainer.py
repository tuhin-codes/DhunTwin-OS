from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


class AnomalyExplainer:

    def __init__(
        self,
        history_window: int = 30,
        persistence_window: int = 5,
    ):
        self.history_window = history_window
        self.persistence_window = persistence_window

    # --------------------------------------------------
    # Signal deviation
    # --------------------------------------------------

    @staticmethod
    def _robust_deviation(
        current: float,
        history: pd.Series,
    ) -> float:

        history = history.dropna()

        if len(history) < 5:
            return 0.0

        median = float(history.median())

        mad = float(
            np.median(
                np.abs(
                    history - median
                )
            )
        )

        # Avoid artificial instability when MAD is tiny.
        scale = max(
            1.4826 * mad,
            float(history.std()),
            1e-9,
        )

        return abs(
            current - median
        ) / scale

    # --------------------------------------------------
    # Signal contributions
    # --------------------------------------------------

    def _signal_contributions(
        self,
        dataframe: pd.DataFrame,
        index: int,
        telemetry_columns: list[str],
        machine_id_column: str,
    ) -> list[dict[str, Any]]:

        row = dataframe.iloc[index]

        machine_id = row[
            machine_id_column
        ]

        history_start = max(
            0,
            index - self.history_window,
        )

        # Restrict history to the same machine.
        history = dataframe.iloc[
            history_start:index
        ]

        history = history[
            history[machine_id_column]
            == machine_id
        ]

        contributions = []

        for signal in telemetry_columns:

            if signal not in dataframe.columns:
                continue

            current = row[signal]

            if pd.isna(current):
                continue

            deviation = self._robust_deviation(
                float(current),
                history[signal],
            )

            contributions.append(
                {
                    "signal": signal,
                    "deviation_score": round(
                        deviation,
                        4,
                    ),
                }
            )

        contributions.sort(
            key=lambda x:
            x["deviation_score"],
            reverse=True,
        )

        total = sum(
            item["deviation_score"]
            for item in contributions
        )

        for item in contributions:

            item["contribution_percent"] = round(
                (
                    item["deviation_score"]
                    / total
                    * 100
                )
                if total > 0
                else 0,
                2,
            )

        return contributions

    # --------------------------------------------------
    # Persistence
    # --------------------------------------------------

    def _persistence(
        self,
        dataframe: pd.DataFrame,
        index: int,
        machine_id_column: str,
    ) -> dict[str, Any]:

        row = dataframe.iloc[index]

        machine_id = row[
            machine_id_column
        ]

        start = max(
            0,
            index - self.persistence_window + 1,
        )

        window = dataframe.iloc[
            start:index + 1
        ]

        window = window[
            window[machine_id_column]
            == machine_id
        ]

        if "anomaly_prediction" not in window:
            return {
                "consecutive_anomalies": 0,
                "persistent": False,
            }

        flags = (
            window[
                "anomaly_prediction"
            ]
            .astype(int)
            .tolist()
        )

        consecutive = 0

        for flag in reversed(flags):

            if flag == 1:
                consecutive += 1
            else:
                break

        return {
            "consecutive_anomalies": consecutive,
            "persistent": consecutive >= 2,
        }

    # --------------------------------------------------
    # Trend
    # --------------------------------------------------

    @staticmethod
    def _trend(
        values: pd.Series,
    ) -> str:

        values = values.dropna()

        if len(values) < 5:
            return "insufficient_history"

        y = values.to_numpy(
            dtype=float
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

        scale = max(
            float(np.std(y)),
            1e-9,
        )

        normalized_slope = (
            slope / scale
        )

        if normalized_slope > 0.05:
            return "increasing"

        if normalized_slope < -0.05:
            return "decreasing"

        return "stable"

    # --------------------------------------------------
    # Cross-signal relationship
    # --------------------------------------------------

    @staticmethod
    def _cross_signal_relationship(
        dataframe: pd.DataFrame,
        index: int,
        telemetry_columns: list[str],
        machine_id_column: str,
    ) -> list[dict[str, Any]]:

        row = dataframe.iloc[index]

        machine_id = row[
            machine_id_column
        ]

        start = max(
            0,
            index - 15,
        )

        history = dataframe.iloc[
            start:index + 1
        ]

        history = history[
            history[machine_id_column]
            == machine_id
        ]

        available = [
            column
            for column in telemetry_columns
            if column in history.columns
        ]

        if len(available) < 2:
            return []

        correlation = history[
            available
        ].corr()

        relationships = []

        for i, signal_a in enumerate(
            available
        ):

            for signal_b in available[
                i + 1:
            ]:

                value = correlation.loc[
                    signal_a,
                    signal_b,
                ]

                if pd.isna(value):
                    continue

                relationships.append(
                    {
                        "signals": [
                            signal_a,
                            signal_b,
                        ],
                        "correlation": round(
                            float(value),
                            4,
                        ),
                    }
                )

        relationships.sort(
            key=lambda x:
            abs(x["correlation"]),
            reverse=True,
        )

        return relationships[:5]

    # --------------------------------------------------
    # Explain one observation
    # --------------------------------------------------

    def explain(
        self,
        dataframe: pd.DataFrame,
        index: int,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
    ) -> dict[str, Any]:

        row = dataframe.iloc[index]

        contributions = (
            self._signal_contributions(
                dataframe,
                index,
                telemetry_columns,
                machine_id_column,
            )
        )

        persistence = self._persistence(
            dataframe,
            index,
            machine_id_column,
        )

        machine_id = row[
            machine_id_column
        ]

        start = max(
            0,
            index - self.history_window,
        )

        history = dataframe.iloc[
            start:index + 1
        ]

        history = history[
            history[machine_id_column]
            == machine_id
        ]

        trends = {}

        for signal in telemetry_columns:

            if signal in history.columns:

                trends[signal] = (
                    self._trend(
                        history[signal]
                    )
                )

        relationships = (
            self._cross_signal_relationship(
                dataframe,
                index,
                telemetry_columns,
                machine_id_column,
            )
        )

        if contributions:

            strongest_signal = (
                contributions[0]["signal"]
            )

        else:

            strongest_signal = None

        anomaly_score = row.get(
            "anomaly_score",
            None,
        )

        return {
            "machine_id": str(
                machine_id
            ),

            "timestamp": str(
                row[timestamp_column]
            ),

            "anomaly": bool(
                row.get(
                    "anomaly_prediction",
                    0,
                )
            ),

            "anomaly_score": (
                round(
                    float(anomaly_score),
                    6,
                )
                if anomaly_score is not None
                else None
            ),

            "strongest_signal": (
                strongest_signal
            ),

            "signal_contributions": (
                contributions
            ),

            "persistence": persistence,

            "signal_trends": trends,

            "cross_signal_relationships": (
                relationships
            ),
        }

    # --------------------------------------------------
    # Explain all anomalies
    # --------------------------------------------------

    def explain_anomalies(
        self,
        dataframe: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
    ) -> list[dict[str, Any]]:

        results = []

        anomaly_indices = dataframe.index[
            dataframe[
                "anomaly_prediction"
            ] == 1
        ]

        for index in anomaly_indices:

            results.append(
                self.explain(
                    dataframe,
                    dataframe.index.get_loc(
                        index
                    ),
                    machine_id_column,
                    timestamp_column,
                    telemetry_columns,
                )
            )

        return results