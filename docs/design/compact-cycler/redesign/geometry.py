"""Encounter map for the accepted ballistic carrier, shifted into a ground-service cycle."""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from spikes.numerics import compact_cycler as m  # noqa: E402

CANDIDATE = json.loads(Path("docs/design/compact-cycler/pass-through/native.json").read_text())[
    "candidate"
]
PERIOD = CANDIDATE["period"]
OFFSET = 50.0
x, y, vx, vy = CANDIDATE["initial"]
y0 = np.array([x, y, vx - m.RATE * y, vy + m.RATE * x])


def rhs(t, y):
    return np.r_[y[2:], m.gravity(t, y[:2])]


q = solve_ivp(rhs, (0, OFFSET), y0, method="DOP853", rtol=2.3e-14, atol=2e-16, max_step=0.05)
INITIAL = m.rotate(q.y[:, -1], -m.RATE * OFFSET)
CARRIER = m.forward(0, 2 * PERIOD, INITIAL)
for t in range(0, 121, 4):
    y = CARRIER.sol(t)[:4]
    b = m.circular(t, 5)
    angle = np.arctan2(y[1], y[0])
    print(
        f"{t:5.1f} r={np.linalg.norm(y[:2]):.4f} "
        f"moon={np.linalg.norm(y[:2] - b[:2]):.4f} theta={angle:.4f} "
        f"v={np.linalg.norm(y[2:]):.4f}",
        flush=True,
    )
Path("docs/design/compact-cycler/redesign/carrier-seed.json").write_text(
    json.dumps(dict(period=PERIOD, offset=OFFSET, initial=m.state6(INITIAL)), indent=2) + "\n"
)
