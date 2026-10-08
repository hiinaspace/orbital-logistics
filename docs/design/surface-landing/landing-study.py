"""Bounded backward shooting of a physical forward finite-thrust descent.

Backward time is only an offline boundary-value technique. Mass grows backward;
all admitted programs run forward, consume fuel and use unchanged core dynamics.
"""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares, root

HERE = Path(__file__).resolve().parent
NONFUEL = 1.05
FINAL_FUEL = 0.08
VE, FORCE, CAP = 3.0, 5.0, 3.0
HEIGHT, SPIN, RADIUS = 1e-6, 0.003, 1.25
INITIAL = np.array([1 + HEIGHT, 0.0, 0.0, -SPIN * (1 + HEIGHT)])
MASS = NONFUEL + FINAL_FUEL
TRANSITION = VE / CAP * math.log(FORCE / CAP / MASS)


def mass(t):
    return (
        MASS * math.exp(CAP / VE * t)
        if t < TRANSITION
        else FORCE / CAP + FORCE / VE * (t - TRANSITION)
    )


def flight(x, tight=False):
    burn, coast = x[-2:]
    y = INITIAL.copy()
    minimum = 1 + HEIGHT
    arcs = []
    for index, heading in enumerate([0.0, *x[:-2]]):
        begin, end = burn * index / 8, burn * (index + 1) / 8
        direction = np.array([math.cos(heading), math.sin(heading)])

        def rhs(t, state):
            r = np.linalg.norm(state[:2])
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
        minimum = min(minimum, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
        arcs.append([begin, end, float(heading)])
    if coast:

        def rhs_coast(t, state):
            r = np.linalg.norm(state[:2])
            return np.concatenate((state[2:], -state[:2] / r**3))

        sol = solve_ivp(
            rhs_coast,
            [burn, burn + coast],
            y,
            method="DOP853",
            rtol=2e-12 if tight else 1e-8,
            atol=2e-13 if tight else 1e-10,
            max_step=0.05,
        )
        y = sol.y[:, -1]
        minimum = min(minimum, float(np.min(np.linalg.norm(sol.y[:2], axis=0))))
    return y, minimum, arcs


def endpoint(x, tight=False):
    y, minimum, _ = flight(x, tight)
    r = np.linalg.norm(y[:2])
    return np.array(
        [
            r - RADIUS,
            np.dot(y[:2], y[2:]) / r,
            (y[0] * y[3] - y[1] * y[2]) / r + 1 / math.sqrt(RADIUS),
        ]
    ), minimum


def residual(x):
    e, minimum = endpoint(x)
    return np.concatenate((1000 * e, [1000 * min(0.0, minimum - 1)], 0.0001 * np.diff(x[:-2])))


attempts = []
for burn in [0.65, 0.7, 0.75]:
    seed = np.array([*np.linspace(-0.15, -2.4, 7), burn, 0.3])
    fit = least_squares(
        residual,
        seed,
        bounds=([-3.5] * 7 + [0.25, 0.0], [0.3] * 7 + [0.77, 1.5]),
        max_nfev=160,
        xtol=1e-11,
        ftol=1e-11,
        gtol=1e-11,
    )
    chosen = [-4, -3, -2]

    def exact(values):
        x = fit.x.copy()
        x[chosen] = values
        return endpoint(x, True)[0]

    fine = root(exact, fit.x[chosen], tol=1e-10)
    fit.x[chosen] = fine.x
    y, minimum, arcs = flight(fit.x, True)
    errors, _ = endpoint(fit.x, True)
    duration = float(sum(fit.x[-2:]))
    initial_fuel = mass(fit.x[-2]) - NONFUEL
    result = {
        "seedBurn": burn,
        "evaluations": fit.nfev,
        "controls": fit.x.tolist(),
        "reverseState": y.tolist(),
        "errors": errors.tolist(),
        "minimumSampledRadius": minimum,
        "initialFuel": initial_fuel,
        "finalFuel": FINAL_FUEL,
        "duration": duration,
        "coast": float(fit.x[-1]),
        "reverseArcs": arcs,
    }
    attempts.append(result)
    print(json.dumps(result), flush=True)
    if max(abs(errors)) < 1e-7 and minimum >= 1 and initial_fuel < 1.166694511367:
        break
(HERE / "landing-study.json").write_text(json.dumps(attempts, indent=2) + "\n")
