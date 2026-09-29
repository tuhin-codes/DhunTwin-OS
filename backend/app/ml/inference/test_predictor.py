from predictor import FailurePredictor

machine = {
    "Type": "L",
    "air_temperature": 299,
    "process_temperature": 309,
    "rotational_speed": 1450,
    "torque": 50,
    "tool_wear": 20,
}

result = FailurePredictor.predict(machine)

print(result)