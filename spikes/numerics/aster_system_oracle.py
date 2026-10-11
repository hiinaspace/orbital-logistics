"""Independent DOP853 check for the new inclined lunar observation satellite."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

path = Path("docs/design/aster-system")
d = json.loads((path / "solace-replay.json").read_text())


def derivative(t, y):
    force = np.zeros(3)
    for body in d["bodies"]:
        rail = body["rail"]
        if rail["kind"] == "fixed":
            center = np.array(rail["position"])
        else:
            angle = rail["phase"] + rail["rate"] * t
            center = np.array(rail["center"]) + rail["radius"] * (
                math.cos(angle) * np.array(rail["u"]) + math.sin(angle) * np.array(rail["v"])
            )
        r = center - y[:3]
        force += body["mu"] * r / np.linalg.norm(r) ** 3
    return np.r_[y[3:], force]


solution = solve_ivp(
    derivative,
    [0, 128],
    d["state"],
    method="DOP853",
    rtol=2e-12,
    atol=2e-13,
    dense_output=True,
    max_step=0.05,
)
assert solution.success
worst = max(float(np.max(np.abs(solution.sol(row["t"]) - row["y"]))) for row in d["rows"])
assert worst < 1e-6, worst
result = {
    "method": "DOP853",
    "through": 128,
    "samples": len(d["rows"]),
    "worst_six_state_residual": worst,
    "rtol": 2e-12,
    "atol": 2e-13,
}
(path / "solace-oracle.json").write_text(json.dumps(result, indent=2) + "\n")
print(result)
