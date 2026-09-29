from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ModelMetadata:
    model_id: str
    model_name: str
    model_version: str
    machine_type: str
    dataset: str
    model_framework: str
    model_path: str
    features: tuple[str, ...]
    roc_auc: float
    precision: float
    recall: float
    f1_score: float
    status: str


class ModelRegistry:

    _models: dict[str, ModelMetadata] = {}

    @classmethod
    def register(cls, metadata: ModelMetadata):
        cls._models[metadata.model_id] = metadata

    @classmethod
    def get(cls, model_id: str):
        return cls._models.get(model_id)

    @classmethod
    def all(cls):
        return list(cls._models.values())

    @classmethod
    def for_machine_type(cls, machine_type: str):

        return [
            model
            for model in cls._models.values()
            if model.machine_type.lower() == machine_type.lower()
        ]

    @classmethod
    def compatible_models(
        cls,
        machine_type: str,
        features: list[str],
    ):

        requested_features = set(features)

        return [
            model
            for model in cls.for_machine_type(machine_type)
            if set(model.features) == requested_features
            and model.status == "validated"
        ]

    @classmethod
    def clear(cls):
        cls._models.clear()