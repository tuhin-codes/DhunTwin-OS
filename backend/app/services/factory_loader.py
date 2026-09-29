import json
from pathlib import Path

from app.models import Machine


class FactoryLoader:
    """
    Loads the CarbonTwin factory definition.

    factory.json is the source of truth for:
    - Factory identity
    - Departments
    - Machines
    - Machine types
    - Machine location
    - Initial telemetry
    - Initial digital-twin state
    - Maintenance assignment
    """

    @staticmethod
    def _get_path() -> Path:
        """
        Return the absolute path to factory.json.
        """

        return (
            Path(__file__).resolve().parent.parent
            / "data"
            / "factory.json"
        )

    @classmethod
    def load_config(cls) -> dict:
        """
        Load and validate the complete factory configuration.
        """

        path = cls._get_path()

        if not path.exists():
            raise FileNotFoundError(
                f"Factory configuration not found: {path}"
            )

        try:
            with path.open(
                "r",
                encoding="utf-8",
            ) as file:
                data = json.load(file)

        except json.JSONDecodeError as error:
            raise ValueError(
                f"Invalid factory.json: {error}"
            ) from error

        if not isinstance(data, dict):
            raise ValueError(
                "factory.json must contain a JSON object."
            )

        factory = data.get("factory")

        if not isinstance(factory, dict):
            raise ValueError(
                "factory.json is missing the 'factory' object."
            )

        departments = factory.get("departments")

        if not isinstance(departments, list):
            raise ValueError(
                "Factory configuration must contain "
                "a 'departments' list."
            )

        return data

    @classmethod
    def load(cls) -> list[Machine]:
        """
        Flatten all machines from all factory departments.

        Every Machine is constructed directly from factory.json,
        making the dataset the single source of truth.
        """

        data = cls.load_config()

        factory = data["factory"]

        machines: list[Machine] = []

        seen_machine_ids: set[str] = set()

        for department in factory["departments"]:

            if not isinstance(department, dict):
                raise ValueError(
                    "Every factory department must be an object."
                )

            department_id = department.get("id")
            department_name = department.get("name")

            if not department_id:
                raise ValueError(
                    "Factory department is missing an 'id'."
                )

            if not department_name:
                raise ValueError(
                    f"Department '{department_id}' "
                    "is missing a 'name'."
                )

            department_machines = department.get(
                "machines",
                [],
            )

            if not isinstance(
                department_machines,
                list,
            ):
                raise ValueError(
                    f"Machines for department "
                    f"'{department_id}' must be a list."
                )

            for machine_data in department_machines:

                if not isinstance(
                    machine_data,
                    dict,
                ):
                    raise ValueError(
                        f"Invalid machine entry in "
                        f"department '{department_id}'."
                    )

                machine_id = machine_data.get("id")

                if not machine_id:
                    raise ValueError(
                        f"Machine in department "
                        f"'{department_id}' is missing an 'id'."
                    )

                machine_id = str(machine_id)

                if machine_id in seen_machine_ids:
                    raise ValueError(
                        f"Duplicate machine id detected: "
                        f"{machine_id}"
                    )

                machine_department = machine_data.get(
                    "department"
                )

                if not machine_department:
                    machine_data = {
                        **machine_data,
                        "department": str(
                            department_name
                        ),
                    }

                machine = Machine(
                    **machine_data
                )

                machines.append(machine)

                seen_machine_ids.add(machine_id)

        if not machines:
            raise ValueError(
                "Factory configuration contains no machines."
            )

        return machines