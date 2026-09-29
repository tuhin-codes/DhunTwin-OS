from app.digital_twin.runtime import DigitalTwinRuntime


class HotspotService:

    @staticmethod
    def top_emitters(limit: int = 5):

        machines = sorted(
            DigitalTwinRuntime.machines(),
            key=lambda m: m.carbon,
            reverse=True,
        )

        total = sum(m.carbon for m in machines)

        hotspots = []

        for machine in machines[:limit]:

            share = (
                (machine.carbon / total) * 100
                if total > 0
                else 0
            )

            hotspots.append(
                {
                    "machine": machine.id,
                    "name": machine.name,
                    "department": machine.department,
                    "carbon": round(machine.carbon, 2),
                    "share": round(share, 2),
                }
            )

        return hotspots