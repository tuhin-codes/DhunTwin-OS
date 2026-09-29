class OperationsAgent:

    @staticmethod
    def analyze(machine):

        score = machine.health_score

        if score >= 90:
            status = "Excellent"

        elif score >= 75:
            status = "Good"

        elif score >= 50:
            status = "Needs Attention"

        else:
            status = "Critical"

        return {
            "status": status,
            "health_score": score,
            "maintenance_status": machine.maintenance_status,
        }