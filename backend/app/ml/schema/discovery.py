from pathlib import Path

import pandas as pd

from app.ml.schema.schema_registry import (
    DatasetSchema,
    SchemaRegistry,
)


class DatasetSchemaDiscovery:

    @staticmethod
    def inspect(
        dataset_path: str | Path,
        target_column: str | None = None,
        machine_id_column: str | None = None,
        machine_type_column: str | None = None,
        identifier_columns: list[str] | None = None,
    ) -> DatasetSchema:

        path = Path(dataset_path)

        df = pd.read_csv(path)

        identifier_columns = identifier_columns or []

        # ---------------------------------------------
        # Validate supplied columns
        # ---------------------------------------------

        available_columns = set(df.columns)

        for column in (
            identifier_columns
            + ([target_column] if target_column else [])
            + ([machine_id_column] if machine_id_column else [])
            + ([machine_type_column] if machine_type_column else [])
        ):
            if column and column not in available_columns:
                raise ValueError(
                    f"Column '{column}' does not exist in dataset."
                )

        # ---------------------------------------------
        # Columns that must NOT become model features
        # ---------------------------------------------

        excluded = set(identifier_columns)

        if target_column:
            excluded.add(target_column)

        # Machine ID is metadata, not a predictive feature.
        if machine_id_column:
            excluded.add(machine_id_column)

        # Machine type can be a predictive feature if the
        # model explicitly uses it, so don't automatically
        # exclude it here.
        #
        # Example:
        # AI4I uses Type as a model feature.

        feature_columns = [
            column
            for column in df.columns
            if column not in excluded
        ]

        # ---------------------------------------------
        # Feature type detection
        # ---------------------------------------------

        feature_df = df[feature_columns]

        numeric_features = tuple(
            feature_df.select_dtypes(
                include="number"
            ).columns
        )

        categorical_features = tuple(
            feature_df.select_dtypes(
                exclude="number"
            ).columns
        )

        # ---------------------------------------------
        # Build schema
        # ---------------------------------------------

        schema = DatasetSchema(
            schema_id=path.stem,
            dataset_name=path.name,

            features=tuple(feature_columns),

            numeric_features=numeric_features,
            categorical_features=categorical_features,

            identifier_columns=tuple(identifier_columns),

            target_column=target_column,

            machine_id_column=machine_id_column,
            machine_type_column=machine_type_column,

            sample_count=len(df),
        )

        SchemaRegistry.register(schema)

        return schema