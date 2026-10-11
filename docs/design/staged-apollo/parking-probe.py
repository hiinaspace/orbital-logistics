"""Independent full-field passive parking feasibility, not production admission."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp

root = Path(__file__).resolve().parents[3]
d = json.loads((root / "fixtures/model-sets/aster-selene-expedition.json").read_text())
w = json.loads((root / "docs/design/apollo/witness.json").read_text())
s = d["scenario"]
rail = s["bodies"][1]["rail"]
n = rail["rate"]
phase = rail["phase"]
radius = rail["radius"]
initial = next(p for p in w["phases"] if p["name"] == "Lunar orbit")
t0 = initial["t"]
z = np.array(initial["state"][:4])


def moon(t):
    a = phase + n * t
    return radius * np.array([np.cos(a), np.sin(a)])


def rhs(t, y):
    p = y[:2]
    q = moon(t) - p
    return np.r_[y[2:], -p / np.linalg.norm(p) ** 3 + 0.03 * q / np.linalg.norm(q) ** 3]


def surface(t, y):
    return np.linalg.norm(y[:2] - moon(t)) - 0.2


surface_event: Any = surface
surface_event.terminal = True
surface_event.direction = -1
rows = []
for end in [41.5754510612778, 45.0, 48.0, 51.715850814408824, 60.0, 80.0]:
    sol = solve_ivp(
        rhs,
        (t0, end),
        z,
        method="DOP853",
        rtol=2e-12,
        atol=2e-13,
        max_step=0.025,
        dense_output=True,
        events=surface_event,
    )
    times = np.linspace(t0, sol.t[-1], 10001)
    ys = sol.sol(times)
    rr = np.linalg.norm(ys[:2] - moon(times), axis=0)
    rows.append(
        {
            "through": end,
            "actualEnd": float(sol.t[-1]),
            "minLunarRadius": float(rr.min()),
            "maxLunarRadius": float(rr.max()),
            "collision": bool(len(sol.t_events[0])),
            "endState": ys[:, -1].tolist(),
        }
    )
report = {
    "note": "Actual fixed-primary field, no softened gravity; offline witness LOI state. Sampled min radii are feasibility only, not canonical interval clearance admission.",
    "initial": initial,
    "results": rows,
}
(root / "docs/design/staged-apollo/parking-probe.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
