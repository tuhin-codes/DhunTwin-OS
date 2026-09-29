from app.services.factory_loader import FactoryLoader


class MachineService:

    @staticmethod
    def get_all():
        return FactoryLoader.load()