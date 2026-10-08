"""Independent seven-state forward check of the backward-authored candidate."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
candidate = json.loads((HERE / "landing-study.json").read_text())[-1]
probe = json.loads((HERE / "flight-probe.json").read_text())
ship = json.loads((ROOT / "fixtures/model-sets/selene-ascent.json").read_text())["vessels"][0][
    "bundle"
]["scenario"]["ship"]
rotation = probe["rotation"]
c, s = math.cos(rotation), math.sin(rotation)
x, y, vx, vy = candidate["reverseState"]
initial = np.array(
    [
        c * x - s * y,
        s * x + c * y,
        0,
        -c * vx + s * vy,
        -s * vx - c * vy,
        0,
        candidate["initialFuel"],
    ]
)
target = np.array(
    [(1 + 1e-6) * c, (1 + 1e-6) * s, 0, -0.003 * (1 + 1e-6) * s, 0.003 * (1 + 1e-6) * c, 0]
)
arcs = [
    (candidate["duration"] - end, candidate["duration"] - begin, heading + rotation)
    for begin, end, heading in reversed(candidate["reverseArcs"])
]


def forward(tight):
    state = initial.copy()
    time = 0.0
    for begin, end, heading in [(0.0, candidate["coast"], None), *arcs]:
        direction = (
            np.zeros(3)
            if heading is None
            else np.array([math.cos(heading), math.sin(heading), 0.0])
        )

        def rhs(t, value):
            radius = np.linalg.norm(value[:3])
            assert radius > 1
            mass = ship["dryMass"] + 0.05 + value[6]
            force = (
                0
                if heading is None
                else min(ship["engine"]["maxThrust"], ship["engine"]["maxAcceleration"] * mass)
            )
            return np.concatenate(
                (
                    value[3:6],
                    -value[:3] / radius**3 + force / mass * direction,
                    [-force / ship["exhaustVelocity"]],
                )
            )

        assert abs(begin - time) < 1e-14
        sol = solve_ivp(
            rhs,
            [begin, end],
            state,
            method="DOP853",
            rtol=2.3e-14 if tight else 2e-13,
            atol=2e-15,
            max_step=0.02,
        )
        assert sol.success
        state = sol.y[:, -1]
        time = end
    return state


fine, regular = forward(True), forward(False)
checks = []
for row in probe["rows"]:
    error = float(np.linalg.norm(np.array(row["state"]) - fine[:6]))
    assert error < 1e-10
    checks.append(
        {
            "step": row["step"],
            "stateError": error,
            "fuelError": abs(row["propellant"] - float(fine[6])),
        }
    )
report = {
    "positionResidual": float(np.linalg.norm(fine[:3] - target[:3])),
    "velocityResidual": float(np.linalg.norm(fine[3:6] - target[3:6])),
    "fuel": float(fine[6]),
    "refinement": float(np.linalg.norm(fine - regular)),
    "checks": checks,
}
assert max(report["positionResidual"], report["velocityResidual"]) + 1e-8 < 1e-7
assert abs(report["fuel"] - 0.08) < 1e-10
(HERE / "descent-oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
