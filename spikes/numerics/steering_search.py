"""Offline inclined finite-burn shooting; independent seven-state integration."""

from __future__ import annotations

import json
from math import atan2, cos, pi, sin, sqrt
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

OUT = Path(__file__).resolve().parents[2] / "docs/design/smooth-steering"
R1, R2, NODE, TILT = 2.0, 3.0, 0.5, 35 * pi / 180
DEPARTURE, ARRIVAL = 1.0, 15.0
DRY, CARGO, FUEL, VE, FORCE, CAP = 1.0, 0.05, 0.9, 3.0, 0.25, 0.14
U = np.array([cos(NODE), sin(NODE), 0])
V0 = np.array([-sin(NODE), cos(NODE), 0])
V1 = np.array([-sin(NODE) * cos(TILT), cos(NODE) * cos(TILT), sin(TILT)])
INITIAL = np.concatenate((R1 * U, V0 / sqrt(R1), [FUEL]))
GOAL = np.concatenate((-R2 * U, -V1 / sqrt(R2)))


def heading(angles):
    a, e = angles
    return np.array([cos(a) * cos(e), sin(a) * cos(e), sin(e)])


def angles(v):
    v = v / np.linalg.norm(v)
    return [atan2(v[1], v[0]), atan2(v[2], np.hypot(v[0], v[1]))]


def direction(keys, x):
    x = np.clip(x, 0, 1)
    i = 0 if x <= 0.5 else 1
    u = (x - i * 0.5) * 2
    u = u * u * (3 - 2 * u)
    a, b = keys[i], keys[i + 1]
    theta = np.arccos(np.clip(np.dot(a, b), -1, 1))
    if theta < 1e-6:
        d = (1 - u) * a + u * b
    else:
        d = (sin((1 - u) * theta) * a + sin(u * theta) * b) / sin(theta)
    return d / np.linalg.norm(d)


def propagate(p, tight=False):
    d1, d2 = p[-2:]
    if d1 + d2 >= ARRIVAL - DEPARTURE:
        return None
    state = INITIAL.copy()
    pieces = []
    for start, end, keys in [
        (DEPARTURE, DEPARTURE + d1, p[:6].reshape(3, 2)),
        (DEPARTURE + d1, ARRIVAL - d2, None),
        (ARRIVAL - d2, ARRIVAL, p[6:12].reshape(3, 2)),
    ]:
        vectors = None if keys is None else np.array([heading(k) for k in keys])

        def rhs(t, y):
            gravity = -y[:3] / np.linalg.norm(y[:3]) ** 3
            force = 0 if vectors is None else min(FORCE, CAP * (DRY + CARGO + y[6]))
            steer = (
                np.zeros(3) if vectors is None else direction(vectors, (t - start) / (end - start))
            )
            return np.concatenate(
                (y[3:6], gravity + force / (DRY + CARGO + y[6]) * steer, [-force / VE])
            )

        # Split at the direction knot independently of the production event grid.
        knots = [start, end] if keys is None else [start, (start + end) / 2, end]
        for a, b in zip(knots, knots[1:], strict=False):
            result = solve_ivp(
                rhs,
                (a, b),
                state,
                method="DOP853",
                rtol=2.3e-14 if tight else 2e-9,
                atol=2e-15 if tight else 2e-11,
                dense_output=tight,
            )
            if (
                not result.success
                or result.y[6, -1] < 0
                or np.min(np.linalg.norm(result.y[:3], axis=0)) < 1.1
            ):
                return None
            state = result.y[:, -1]
            if tight:
                pieces.append(result)
    return state, pieces


def main():
    intermediate = np.array(
        [-sin(NODE) * cos(TILT * 0.4), cos(NODE) * cos(TILT * 0.4), sin(TILT * 0.4)]
    )
    a = (R1 + R2) / 2
    dv1 = sqrt(2 / R1 - 1 / a) * intermediate - V0 / sqrt(R1)
    dv2 = -V1 / sqrt(R2) + sqrt(2 / R2 - 1 / a) * intermediate
    seed = np.array([*angles(dv1) * 3, *angles(dv2) * 3, 1.8, 2.1])
    lower = np.array([-10, -1.55] * 6 + [0.2, 0.2])
    upper = np.array([10, 1.55] * 6 + [4.5, 4.5])
    evaluations = 0

    def residual(p):
        nonlocal evaluations
        evaluations += 1
        result = propagate(p)
        return np.ones(6) * 100 if result is None else result[0][:6] - GOAL

    fit = least_squares(
        residual, seed, bounds=(lower, upper), max_nfev=150, xtol=1e-12, ftol=1e-12, gtol=1e-12
    )

    # Correct using the tight independent integrator before freezing the program.
    def tight_residual(p):
        result = propagate(p, True)
        return np.ones(6) * 100 if result is None else result[0][:6] - GOAL

    fit = least_squares(
        tight_residual,
        fit.x,
        bounds=(lower, upper),
        max_nfev=80,
        xtol=2e-14,
        ftol=2e-14,
        gtol=2e-14,
    )
    state, pieces = propagate(fit.x, True)
    report = dict(
        parameters=fit.x.tolist(),
        evaluations=evaluations,
        residual=float(np.linalg.norm(state[:6] - GOAL)),
        fuel=float(state[6]),
        departure=DEPARTURE,
        arrival=ARRIVAL,
        constants=dict(
            r1=R1,
            r2=R2,
            node=NODE,
            tilt=TILT,
            dry=DRY,
            cargo=CARGO,
            fuel=FUEL,
            ve=VE,
            force=FORCE,
            cap=CAP,
        ),
        minimumSampledRadius=min(float(np.min(np.linalg.norm(r.y[:3], axis=0))) for r in pieces),
    )
    assert np.linalg.norm(state[:6] - GOAL) < 1e-9 and state[6] > 0.2
    dirs = [
        [heading(k) for k in fit.x[:6].reshape(3, 2)],
        [heading(k) for k in fit.x[6:12].reshape(3, 2)],
    ]
    report["directions"] = [[v.tolist() for v in ks] for ks in dirs]
    assert all(np.dot(a, b) > -0.5 for ks in dirs for a, b in zip(ks, ks[1:]))
    (OUT / "search-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2), flush=True)


if __name__ == "__main__":
    main()
