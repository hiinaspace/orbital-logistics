"""Six targeted dwell/dock seeds after the initial fixed-liftoff family."""

import json
from pathlib import Path

import numpy as np
import search

HERE = Path(__file__).resolve().parent
seed = np.array([0.07, 0.49, 2.36, 0.0, 0.28, 0.54, 0.22])
schedule = [
    (search.LIFT, 43.0),
    (41.0, 44.0),
    (41.4, 44.5),
    (41.8, 45.0),
    (42.2, 45.5),
    (42.6, 46.0),
]
results = []
for lift, dock in schedule:
    try:
        result = search.optimize(lift, dock, 1, seed, max_nfev=90)
        results.append(result)
        print(
            "candidate",
            lift,
            dock,
            "res",
            result["positionError"],
            result["velocityError"],
            "overshoot",
            result["radialOvershoot"],
            "h",
            result["coastAngularMomentumMin"],
            "fuel",
            result["finalFuel"],
            flush=True,
        )
        (HERE / "phase-candidates.json").write_text(
            json.dumps([search.compact(r) for r in results], indent=2) + "\n"
        )
    except Exception as exc:
        print("failed", lift, dock, repr(exc), flush=True)
