from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler


class AnomalyDetector:

    def __init__(
        self,
        contamination: float = 0.02,
        random_state: int = 42,
        minimum_samples: int = 100,
    ):
        self.contamination = contamination
        self.random_state = random_state
        self.minimum_samples = minimum_samples

        self.models = {}

        self.global_model = None

        self.feature_columns = []

        self.fitted = False

    # --------------------------------------------------
    # Feature selection
    # --------------------------------------------------

    @staticmethod
    def select_features(
        dataframe: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
    ) -> list[str]:

        excluded = {
            machine_id_column,
            timestamp_column,
            "Failure_Event",
            *telemetry_columns,
        }

        features = []

        for column in dataframe.columns:

            if column in excluded:
                continue

            if pd.api.types.is_numeric_dtype(
                dataframe[column]
            ):
                features.append(column)

        return features

    # --------------------------------------------------
    # Create model
    # --------------------------------------------------

    def _create_model(self):

        return {
            "imputer": SimpleImputer(
                strategy="median"
            ),

            "scaler": StandardScaler(),

            "model": IsolationForest(
                n_estimators=300,
                contamination=self.contamination,
                random_state=self.random_state,
                n_jobs=-1,
            ),
        }

    # --------------------------------------------------
    # Fit
    # --------------------------------------------------

    def fit(
        self,
        dataframe: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
        machine_type_column: str = "Machine_Type",
    ):

        self.feature_columns = (
            self.select_features(
                dataframe,
                machine_id_column,
                timestamp_column,
                telemetry_columns,
            )
        )

        if not self.feature_columns:

            raise ValueError(
                "No numerical temporal features "
                "available for anomaly detection."
            )

        # --------------------------------------------------
        # Global model
        # --------------------------------------------------

        self.global_model = self._create_model()

        X_global = dataframe[
            self.feature_columns
        ].copy()

        X_global = self.global_model[
            "imputer"
        ].fit_transform(X_global)

        X_global = self.global_model[
            "scaler"
        ].fit_transform(X_global)

        self.global_model[
            "model"
        ].fit(X_global)

        # --------------------------------------------------
        # Type-specific models
        # --------------------------------------------------

        if machine_type_column in dataframe.columns:

            for machine_type, group in dataframe.groupby(
                machine_type_column
            ):

                if len(group) < self.minimum_samples:
                    continue

                model_bundle = self._create_model()

                X = group[
                    self.feature_columns
                ].copy()

                X = model_bundle[
                    "imputer"
                ].fit_transform(X)

                X = model_bundle[
                    "scaler"
                ].fit_transform(X)

                model_bundle[
                    "model"
                ].fit(X)

                self.models[
                    str(machine_type)
                ] = model_bundle

        self.fitted = True

        return self

    # --------------------------------------------------
    # Predict
    # --------------------------------------------------

    def predict(
        self,
        dataframe: pd.DataFrame,
        machine_type_column: str = "Machine_Type",
    ):

        if not self.fitted:

            raise RuntimeError(
                "AnomalyDetector must be fitted "
                "before prediction."
            )

        result = dataframe.copy()

        anomaly_predictions = []
        anomaly_scores = []
        model_sources = []

        for index, row in result.iterrows():

            machine_type = str(
                row.get(
                    machine_type_column,
                    "",
                )
            )

            model_bundle = self.models.get(
                machine_type
            )

            if model_bundle is None:

                model_bundle = self.global_model

                source = "global"

            else:

                source = "machine_type"

            X = pd.DataFrame(
                [[
                    row[column]
                    for column
                    in self.feature_columns
                ]],
                columns=self.feature_columns,
            )

            X = model_bundle[
                "imputer"
            ].transform(X)

            X = model_bundle[
                "scaler"
            ].transform(X)

            prediction = int(
                model_bundle[
                    "model"
                ].predict(X)[0]
            )

            score = float(
                model_bundle[
                    "model"
                ].score_samples(X)[0]
            )

            anomaly_predictions.append(
                1 if prediction == -1 else 0
            )

            anomaly_scores.append(
                -score
            )

            model_sources.append(
                source
            )

        result[
            "anomaly_prediction"
        ] = anomaly_predictions

        result[
            "anomaly_score"
        ] = anomaly_scores

        result[
            "anomaly_model"
        ] = model_sources

        return result

    # --------------------------------------------------
    # Fit + predict
    # --------------------------------------------------

    def fit_predict(
        self,
        dataframe: pd.DataFrame,
        machine_id_column: str,
        timestamp_column: str,
        telemetry_columns: list[str],
        machine_type_column: str = "Machine_Type",
    ):

        self.fit(
            dataframe,
            machine_id_column,
            timestamp_column,
            telemetry_columns,
            machine_type_column,
        )

        return self.predict(
            dataframe,
            machine_type_column,
        )

    # --------------------------------------------------
    # Summary
    # --------------------------------------------------

    @staticmethod
    def summary(
        dataframe: pd.DataFrame,
        machine_id_column: str,
        machine_type_column: str = "Machine_Type",
    ):

        anomalies = dataframe[
            dataframe[
                "anomaly_prediction"
            ] == 1
        ]

        result = {
            "observations": int(
                len(dataframe)
            ),

            "anomalies": int(
                len(anomalies)
            ),

            "anomaly_rate": round(
                len(anomalies)
                / len(dataframe)
                if len(dataframe)
                else 0,
                6,
            ),

            "assets": int(
                dataframe[
                    machine_id_column
                ].nunique()
            ),

            "anomalies_by_machine": {
                str(machine_id): int(count)
                for machine_id, count
                in anomalies.groupby(
                    machine_id_column
                )
                .size()
                .items()
            },

            "anomalies_by_type": {
                str(machine_type): int(count)
                for machine_type, count
                in anomalies.groupby(
                    machine_type_column
                )
                .size()
                .items()
            },

            "models": sorted(
                dataframe[
                    "anomaly_model"
                ]
                .unique()
                .tolist()
            ),
        }

        return result

    # --------------------------------------------------
    # Save
    # --------------------------------------------------

    def save(self, path: str | Path):

        if not self.fitted:

            raise RuntimeError(
                "Cannot save an unfitted detector."
            )

        joblib.dump(
            self,
            path,
        )

    # --------------------------------------------------
    # Load
    # --------------------------------------------------

    @staticmethod
    def load(path: str | Path):

        return joblib.load(path)