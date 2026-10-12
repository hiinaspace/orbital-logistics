"""Local connections on a closer ballistic carrier branch; finite design gate."""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import root

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from spikes.numerics import compact_cycler as old  # noqa: E402

rows = json.loads(Path("docs/design/compact-cycler/refinement/coasts.json").read_text())
seed = next(q for q in rows if q["duration"] == 64.0 and q["peri"] < 2.5)
start = old.rotate(seed["initial"], old.RATE * 5.0)
goal = old.rotate(seed["final"], old.RATE * 5.0)
z = root(
    lambda v: old.forward(5.0, 69.0, np.r_[start[:2], v]).y[:2, -1] - goal[:2],
    start[2:],
    tol=1e-10,
)
start[2:] = z.x
carrier = [old.burn("Beacon departure", 1.0, 5.0, old.port("Beacon", 1.0), start, 0.6)]
coast = old.forward(5.0, 69.0, carrier[0]["end"])
carrier.append(
    dict(
        t0=5.0,
        t1=69.0,
        initial=carrier[0]["end"],
        end=coast.y[:4, -1],
        result=coast,
        dv=0.0,
    )
)
carrier.append(
    old.burn("Beacon arrival", 69.0, 73.0, coast.y[:4, -1], old.port("Beacon", 73.0), 0.6)
)
Path("docs/design/compact-cycler/refinement/closer-carrier.json").write_text(
    json.dumps(
        [
            dict(
                start=q["t0"],
                end=q["t1"],
                initial=old.state6(q["initial"]),
                endpoint=old.state6(q["end"]),
                oracle=old.oracle(q),
                id=q.get("arc", {}).get("id", "Carrier coast"),
                **({"control": q["arc"]} if "arc" in q else {}),
            )
            for q in carrier
        ],
        separators=(",", ":"),
    )
    + "\n"
)
for t in [6, 8, 10, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 66]:
    y = coast.sol(t)[:4]
    r = np.linalg.norm(y[:2])
    moon = old.circular(t, 5)
    print(
        "pose",
        t,
        r,
        np.linalg.norm(y[:2] - moon[:2]),
        np.arctan2(y[1], y[0]) - old.RATE * t,
        flush=True,
    )
