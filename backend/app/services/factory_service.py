from app.models import Factory, Department

from app.digital_twin.runtime import DigitalTwinRuntime
from app.services.factory_loader import FactoryLoader


class FactoryService:

    @staticmethod
    def get_factory():

        data = FactoryLoader.load_config()

        live_machines = DigitalTwinRuntime.machines()

        machines_by_id = {
            machine.id: machine
            for machine in live_machines
        }

        departments = []

        for department_data in data["factory"].get("departments", []):

            department_machines = []

            for machine_data in department_data.get("machines", []):

                machine_id = machine_data["id"]

                machine = machines_by_id.get(machine_id)

                if machine is not None:
                    department_machines.append(machine)

            departments.append(
                Department(
                    id=department_data["id"],
                    name=department_data["name"],
                    machines=department_machines,
                )
            )

        return Factory(
            id=data["factory"]["id"],
            name=data["factory"]["name"],
            departments=departments,
        )