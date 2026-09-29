from pathlib import Path

import pandas as pd


class DatasetValidator:

    @staticmethod
    def validate(
        dataset_path: str | Path,
        machine_id_column: str | None = None,
        machine_type_column: str | None = None,
        target_column: str | None = None,
    ) -> dict:

        path = Path(dataset_path)

        if not path.exists():
            return {
                "valid": False,
                "errors": [f"Dataset not found: {path}"],
                "warnings": [],
                "statistics": {},
            }

        errors = []
        warnings = []

        try:
            df = pd.read_csv(path)
        except Exception as exc:
            return {
                "valid": False,
                "errors": [f"Unable to read dataset: {exc}"],
                "warnings": [],
                "statistics": {},
            }

        # --------------------------------------------------
        # Basic dataset checks
        # --------------------------------------------------

        if df.empty:
            errors.append("Dataset contains no rows.")

        if len(df.columns) == 0:
            errors.append("Dataset contains no columns.")

        # --------------------------------------------------
        # Duplicate columns
        # --------------------------------------------------

        duplicate_columns = df.columns[
            df.columns.duplicated()
        ].tolist()

        if duplicate_columns:
            errors.append(
                f"Duplicate columns detected: {duplicate_columns}"
            )

        # --------------------------------------------------
        # Machine ID validation
        # --------------------------------------------------

        if machine_id_column:

            if machine_id_column not in df.columns:

                errors.append(
                    f"Machine ID column '{machine_id_column}' "
                    "is missing."
                )

            else:

                missing_ids = int(
                    df[machine_id_column].isna().sum()
                )

                if missing_ids > 0:
                    errors.append(
                        f"{missing_ids} rows have missing "
                        "machine IDs."
                    )

                duplicate_ids = int(
                    df[machine_id_column].duplicated().sum()
                )

                if duplicate_ids > 0:
                    warnings.append(
                        f"{duplicate_ids} duplicate machine IDs "
                        "detected."
                    )

        # --------------------------------------------------
        # Machine type validation
        # --------------------------------------------------

        machine_types = []

        if machine_type_column:

            if machine_type_column not in df.columns:

                errors.append(
                    f"Machine type column '{machine_type_column}' "
                    "is missing."
                )

            else:

                missing_types = int(
                    df[machine_type_column].isna().sum()
                )

                if missing_types > 0:
                    warnings.append(
                        f"{missing_types} rows have missing "
                        "machine types."
                    )

                machine_types = sorted(
                    df[machine_type_column]
                    .dropna()
                    .astype(str)
                    .unique()
                    .tolist()
                )

        # --------------------------------------------------
        # Target validation
        # --------------------------------------------------

        if target_column:

            if target_column not in df.columns:

                errors.append(
                    f"Target column '{target_column}' "
                    "is missing."
                )

            else:

                missing_target = int(
                    df[target_column].isna().sum()
                )

                if missing_target > 0:
                    warnings.append(
                        f"{missing_target} rows have missing "
                        "target values."
                    )

        # --------------------------------------------------
        # Missing-value analysis
        # --------------------------------------------------

        missing_values = {
            column: int(count)
            for column, count in df.isna().sum().items()
            if count > 0
        }

        if missing_values:
            warnings.append(
                "Missing values detected in dataset."
            )

        # --------------------------------------------------
        # Infinite numeric values
        # --------------------------------------------------

        numeric_df = df.select_dtypes(
            include="number"
        )

        infinite_columns = []

        for column in numeric_df.columns:

            if not pd.Series(
                numeric_df[column]
            ).replace(
                [float("inf"), float("-inf")],
                pd.NA,
            ).notna().all():

                infinite_columns.append(column)

        if infinite_columns:
            errors.append(
                "Infinite numeric values detected in: "
                f"{infinite_columns}"
            )

        # --------------------------------------------------
        # Constant columns
        # --------------------------------------------------

        constant_columns = [
            column
            for column in df.columns
            if df[column].nunique(dropna=False) <= 1
        ]

        if constant_columns:
            warnings.append(
                f"Constant columns detected: "
                f"{constant_columns}"
            )

        # --------------------------------------------------
        # Dataset statistics
        # --------------------------------------------------

        statistics = {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "machine_count": (
                int(df[machine_id_column].nunique())
                if machine_id_column
                and machine_id_column in df.columns
                else None
            ),
            "machine_types": machine_types,
            "missing_values": missing_values,
            "numeric_columns": (
                numeric_df.columns.tolist()
            ),
        }

        # --------------------------------------------------
        # Final validation status
        # --------------------------------------------------

        valid = len(errors) == 0

        return {
            "valid": valid,
            "errors": errors,
            "warnings": warnings,
            "statistics": statistics,
        }