from dataclasses import dataclass


@dataclass(frozen=True)
class DatasetSchema:
    """
    Describes the structure of a factory dataset after
    separating identifiers, targets and predictive features.
    """

    schema_id: str
    dataset_name: str

    features: tuple[str, ...]

    numeric_features: tuple[str, ...]
    categorical_features: tuple[str, ...]

    identifier_columns: tuple[str, ...]
    target_column: str | None

    machine_id_column: str | None
    machine_type_column: str | None

    sample_count: int


class SchemaRegistry:

    _schemas: dict[str, DatasetSchema] = {}

    @classmethod
    def register(cls, schema: DatasetSchema):
        cls._schemas[schema.schema_id] = schema

    @classmethod
    def get(cls, schema_id: str):
        return cls._schemas.get(schema_id)

    @classmethod
    def all(cls):
        return list(cls._schemas.values())

    @classmethod
    def find_by_features(cls, features: list[str]):

        requested = set(features)

        return [
            schema
            for schema in cls._schemas.values()
            if set(schema.features) == requested
        ]

    @classmethod
    def clear(cls):
        cls._schemas.clear()