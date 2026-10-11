"""One bounded lower-force, longer-final-burn branch near the admitted candidate."""

import json
import math
from pathlib import Path

import numpy as np
import search
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
prior = json.loads((HERE / "exact-candidate.json").read_text())
x0 = np.r_[prior["lift"], prior["dock"], prior["parameters"], 0.5]
x0[-2] = 0.32
lo = np.array([search.LIFT, 44.0, 0, 0, -8, -math.pi / 3, -math.pi / 3, 0.25, 0.30, 0.25])
hi = np.array([42.664405, 46.65, 1.8, 2.2, 8, math.pi / 3, math.pi / 3, 0.9, 0.8, 0.55])


def evaluate(x, tight=False, trace=False):
    lift, dock = x[:2]
    p = x[2:9]
    a, b = search.family(p, lift, dock, 1)
    out = search.run(lift, dock, p[5], p[6], a, b, tight=tight, trace=trace, force2=x[9])
    return out, a, b


def residual(x):
    try:
        out, a, b = evaluate(x, tight=True)
        turn_rate = max(abs(np.diff(b))) * 3 / x[8] * 1.5
        return np.r_[
            1e5 * np.array(out["residual"]),
            10 * max(0, out["radialOvershoot"] - 0.08),
            10 * max(0, 0.005 - out["coastAngularMomentumMin"]),
            10 * max(0, max(out["totalTurnRadians"]) - 2.3),
            0.001 * turn_rate,
            10 * max(0, -out["finalFuel"]),
        ]
    except (ValueError, RuntimeError):
        return np.ones(9) * 100


fit = least_squares(
    residual,
    np.clip(x0, lo + 1e-7, hi - 1e-7),
    bounds=(lo, hi),
    max_nfev=80,
    diff_step=2e-5,
    ftol=1e-9,
    xtol=1e-9,
    gtol=1e-9,
)
out, a, b = evaluate(fit.x, tight=True, trace=True)
out.update(
    {
        "lift": fit.x[0],
        "dock": fit.x[1],
        "parameters": fit.x[2:9].tolist(),
        "ascentHeadings": a.tolist(),
        "brakeHeadings": b.tolist(),
        "brakeForce": fit.x[9],
        "nfev": fit.nfev,
        "cost": fit.cost,
    }
)
print(
    "soft",
    fit.nfev,
    "res",
    out["positionError"],
    out["velocityError"],
    "overshoot",
    out["radialOvershoot"],
    "h",
    out["coastAngularMomentumMin"],
    "turn",
    out["totalTurnRadians"],
    "force",
    fit.x[9],
    "dur",
    fit.x[8],
    flush=True,
)
(HERE / "soft-brake-candidate.json").write_text(json.dumps(out, indent=2) + "\n")
