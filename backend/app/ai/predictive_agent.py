from app.ml.inference.predictor import FailurePredictor


class PredictiveAgent:

    @staticmethod
    def analyze(machine):

        prediction = FailurePredictor.predict(
            {
                "Type": machine.machine_type,
                "air_temperature": machine.air_temperature,
                "process_temperature": machine.process_temperature,
                "rotational_speed": machine.rpm,
                "torque": machine.torque,
                "tool_wear": machine.tool_wear,
            }
        )

        return prediction