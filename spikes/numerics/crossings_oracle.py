"""Independent full-field spatial replay of the local orbital craft."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

report = json.loads(Path("docs/evidence/crossings.json").read_text())
d = report["definition"]
scenario = d["source"]["source"]["scenario"]
bodies = scenario["bodies"]
rail = bodies[1]["rail"]
initial = d["orbiter"]["state"]


def rate(t, y):
    phase = rail["phase"] + rail["rate"] * t
    moon = rail["radius"] * np.array([math.cos(phase), math.sin(phase), 0])
    position = y[:3]
    relative = moon - position
    acceleration = (
        -bodies[0]["mu"] * position / np.linalg.norm(position) ** 3
        + bodies[1]["mu"] * relative / np.linalg.norm(relative) ** 3
    )
    return np.r_[y[3:], acceleration]


times = [q["t"] for q in report["samples"]]
sol = solve_ivp(
    rate,
    (0, max(times)),
    initial,
    method="DOP853",
    rtol=2e-13,
    atol=2e-14,
    max_step=0.02,
    dense_output=True,
)
assert sol.success, sol.message
errors = [float(np.max(np.abs(sol.sol(q["t"]) - q["y"]))) for q in report["samples"]]
observations = sol.sol(np.linspace(0, max(times), 20001))
radii = np.linalg.norm(observations[:3], axis=0)
air_top = bodies[0]["radius"] + d["source"]["source"]["entry"]["atmosphere"]["topHeight"]
result = dict(
    through=max(times),
    maxStateError=max(errors),
    minAtmosphereClearance=float(min(radii) - air_top),
    radiusRange=[float(min(radii)), float(max(radii))],
)
Path("docs/evidence/crossings-oracle.json").write_text(json.dumps(result, indent=2) + "\n")
print(result)
assert max(errors) < 1e-6
assert float(min(radii) - air_top) > 0
