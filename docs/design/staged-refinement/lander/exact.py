"""Unsoftened endpoint polish of the best prograde branch; retain shape terms."""

import json
import sys
from pathlib import Path

import numpy as np
import polish
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
seed_id = int(sys.argv[1]) if len(sys.argv) > 1 else 4
seed = next(p for p in polish.results if p["fromSeed"] == seed_id)
x0 = np.r_[seed["lift"], seed["dock"], seed["parameters"]]


def residual(x):
    try:
        out, ascent, brake = polish.evaluate(x, tight=True)
        return np.r_[
            1e7 * np.array(out["residual"]),
            5 * max(0.0, out["radialOvershoot"] - 0.08),
            5 * max(0.0, 0.005 - out["coastAngularMomentumMin"]),
            5 * max(0.0, max(out["totalTurnRadians"]) - 2.3),
            5 * max(0.0, -out["finalFuel"]),
            5 * max(0.0, 0.000005 - out["clearance"]),
        ]
    except (ValueError, RuntimeError):
        return np.ones(9) * 100


fit = least_squares(
    residual,
    x0,
    bounds=(polish.lo, polish.hi),
    max_nfev=60,
    diff_step=2e-6,
    ftol=1e-12,
    xtol=1e-12,
    gtol=1e-10,
)
out, ascent, brake = polish.evaluate(fit.x, tight=True, trace=True)
out.update(
    {
        "lift": fit.x[0],
        "dock": fit.x[1],
        "parameters": fit.x[2:].tolist(),
        "ascentHeadings": ascent.tolist(),
        "brakeHeadings": brake.tolist(),
        "nfev": fit.nfev,
        "cost": fit.cost,
        "fromSeed": seed_id,
    }
)
print(
    "exact",
    fit.nfev,
    "residual",
    out["residual"],
    "overshoot",
    out["radialOvershoot"],
    "h",
    out["coastAngularMomentumMin"],
    "turn",
    out["totalTurnRadians"],
    flush=True,
)
(HERE / ("exact-candidate.json" if seed_id == 4 else f"exact-candidate-{seed_id}.json")).write_text(
    json.dumps(out, indent=2) + "\n"
)
