"""Bounded steering feasibility study; not an admitted production launch program."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
MASS = 2.5
VE = 3.0
FORCE = 5.0
CAP = 3.0
HEIGHT = 1e-6
SPIN = 0.003
DEPARTURE = 0.3
RADIUS = 1.25
ANGLE = SPIN * DEPARTURE
INITIAL = np.array(
    [
        (1 + HEIGHT) * math.cos(ANGLE),
        (1 + HEIGHT) * math.sin(ANGLE),
        -SPIN * (1 + HEIGHT) * math.sin(ANGLE),
        SPIN * (1 + HEIGHT) * math.cos(ANGLE),
    ]
)


def mass(t):
    transition = (MASS - FORCE / CAP) * VE / FORCE
    return (
        MASS - FORCE / VE * t
        if t <= transition
        else FORCE / CAP * math.exp(-CAP / VE * (t - transition))
    )


def flight(x, tight=False):
    burn, coast = x[-2:]
    y = INITIAL.copy()
    lowest = 1 + HEIGHT
    histories = []
    for index, heading in enumerate([ANGLE, *x[:-2]]):
        begin, end = burn * index / 8, burn * (index + 1) / 8
        direction = np.array([math.cos(heading), math.sin(heading)])

        def rhs(t, state):
            r = math.hypot(state[0], state[1])
            acceleration = -state[:2] / r**3 + min(FORCE / mass(t), CAP) * direction
            return np.concatenate((state[2:], acceleration))

        sol = solve_ivp(
            rhs,
            [begin, end],
            y,
            method="DOP853",
            rtol=2e-12 if tight else 1e-8,
            atol=2e-13 if tight else 1e-10,
            max_step=(end - begin) / 4,
        )
        y = sol.y[:, -1]
        lowest = min(lowest, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
        histories.append([begin, end, float(heading)])
    if coast:

        def coast_rhs(t, state):
            r = math.hypot(state[0], state[1])
            return np.concatenate((state[2:], -state[:2] / r**3))

        sol = solve_ivp(
            coast_rhs,
            [burn, burn + coast],
            y,
            method="DOP853",
            rtol=2e-12 if tight else 1e-8,
            atol=2e-13 if tight else 1e-10,
            max_step=0.03,
        )
        y = sol.y[:, -1]
        lowest = min(lowest, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
    return y, lowest, histories


def residual(x):
    y, lowest, _ = flight(x)
    r = np.linalg.norm(y[:2])
    radial = np.dot(y[:2], y[2:]) / r
    tangent = (y[0] * y[3] - y[1] * y[2]) / r
    return np.concatenate(
        (
            [
                1000 * (r - RADIUS),
                1000 * radial,
                1000 * (tangent - 1 / math.sqrt(RADIUS)),
                1000 * min(0, lowest - 1),
            ],
            0.0001 * np.diff(x[:-2]),
        )
    )


attempts = []
for burn in [0.65, 0.75, 0.8]:
    seed = np.array([*np.linspace(0.15, 2.3, 7), burn, 0.15])
    fit = least_squares(
        residual,
        seed,
        bounds=([-0.3] * 7 + [0.3, 0], [3.4] * 7 + [0.82, 0.8]),
        max_nfev=160,
        xtol=1e-11,
        ftol=1e-11,
        gtol=1e-11,
    )
    # Remove the smoothness regularizer before retaining a flight witness.
    selected = [-4, -3, -2]

    def exact_controls(values):
        candidate = fit.x.copy()
        candidate[selected] = values
        state, _, _ = flight(candidate, True)
        radius = np.linalg.norm(state[:2])
        return [
            radius - RADIUS,
            np.dot(state[:2], state[2:]) / radius,
            (state[0] * state[3] - state[1] * state[2]) / radius - 1 / math.sqrt(RADIUS),
        ]

    refined = root(exact_controls, fit.x[selected], tol=1e-10)
    fit.x[selected] = refined.x
    y, lowest, arcs = flight(fit.x, True)
    r = float(np.linalg.norm(y[:2]))
    vr = float(np.dot(y[:2], y[2:]) / r)
    vt = float((y[0] * y[3] - y[1] * y[2]) / r)
    result = dict(
        seedBurn=burn,
        evaluations=fit.nfev,
        controls=fit.x.tolist(),
        state=y.tolist(),
        minimumSampledRadius=lowest,
        radiusError=r - RADIUS,
        radialSpeed=vr,
        tangentError=vt - 1 / math.sqrt(RADIUS),
        propellant=mass(fit.x[-2]) - 1.1,
        departure=DEPARTURE,
        arrival=DEPARTURE + float(sum(fit.x[-2:])),
        arcs=arcs,
    )
    attempts.append(result)
    print(json.dumps(result), flush=True)
    if (
        max(abs(r - RADIUS), abs(vr), abs(vt - 1 / math.sqrt(RADIUS))) < 1e-7
        and lowest >= 1
        and result["propellant"] > 0.05
    ):
        break
(HERE / "ascent-study.json").write_text(json.dumps(attempts, indent=2) + "\n")
