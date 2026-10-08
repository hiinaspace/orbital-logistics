"""Independent spherical steering evaluation for the Python numerical oracle."""

import numpy as np


def direction_at(arc, epoch):
    if "steering" not in arc:
        return np.array(arc["direction"])
    keys = arc["steering"]["keys"]
    t = epoch - arc["start"]
    if t <= 0:
        return np.array(keys[0]["direction"]) / np.linalg.norm(keys[0]["direction"])
    if t >= keys[-1]["offset"]:
        return np.array(keys[-1]["direction"]) / np.linalg.norm(keys[-1]["direction"])
    index = next(i for i, k in enumerate(keys) if k["offset"] > t)
    left, right = keys[index - 1], keys[index]
    x = (t - left["offset"]) / (right["offset"] - left["offset"])
    fraction = x * x * (3 - 2 * x)
    a, b = np.array(left["direction"]), np.array(right["direction"])
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    dot = np.clip(a @ b, -1.0, 1.0)
    tangent = b - dot * a
    length = np.linalg.norm(tangent)
    if length < 1e-8:
        result = (1 - fraction) * a + fraction * b
    else:
        angle = np.arctan2(length, dot) * fraction
        result = a * np.cos(angle) + tangent / length * np.sin(angle)
    return result / np.linalg.norm(result)
