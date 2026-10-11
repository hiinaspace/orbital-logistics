import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, root

d = json.loads(Path("fixtures/model-sets/aster-selene-crossings.json").read_text())
s = d["source"]["source"]["scenario"]
a, b = s["bodies"]
mu, ms = a["mu"], b["mu"]
R, n, phase = (b["rail"][q] for q in ["radius", "rate", "phase"])


def force(x):
    return n * n * x - mu * x / abs(x) ** 3 - ms * (x - R) / abs(x - R) ** 3


eq = [
    brentq(force, -20, -0.001),
    brentq(force, 0.001, R - 0.001),
    brentq(force, R + 0.001, 20),
]
xL = eq[1]


def rhs(t, y):
    x, yy, vx, vy = y
    r = np.hypot(x, yy)
    dr = np.hypot(x - R, yy)
    return [
        vx,
        vy,
        2 * n * vy + n * n * x - mu * x / r**3 - ms * (x - R) / dr**3,
        -2 * n * vx + n * n * yy - mu * yy / r**3 - ms * yy / dr**3,
    ]


A = n * n + 2 * mu / xL**3 + 2 * ms / (R - xL) ** 3
B = n * n - mu / xL**3 - ms / (R - xL) ** 3
M = np.array([[0, 0, 1, 0], [0, 0, 0, 1], [A, 0, 0, 2 * n], [0, B, -2 * n, 0]])
eigs = np.linalg.eigvals(M)
omega = max(z.imag for z in eigs)
print("equilibria", eq, "eigs", eigs, "linearPeriod", 2 * np.pi / omega, flush=True)
out = []
for amp in [0.03, 0.08, 0.15, 0.25]:
    x = xL - amp
    vy = (omega**2 + A) * amp / (2 * n)

    def integrate(vy, h, x=x):
        return solve_ivp(
            rhs,
            [0, h],
            [x, 0, 0, vy],
            method="DOP853",
            rtol=2e-13,
            atol=2e-14,
            max_step=0.04,
            dense_output=True,
        )

    def objective(u):
        v, h = u
        if h <= 0:
            return [100 - h, 100 - h]
        sol = integrate(v, h)
        return sol.y[[1, 2], -1]

    result = root(objective, [vy, np.pi / omega], tol=1e-10)
    v, h = result.x
    sol = integrate(v, 2 * h)
    ys = sol.sol(np.linspace(0, 2 * h, 10001))
    initial = np.array([x, 0, 0, v])
    closure = sol.y[:, -1] - initial
    c, ss = np.cos(phase), np.sin(phase)
    inertial = [c * x, ss * x, 0, -ss * (v + n * x), c * (v + n * x), 0]
    row = {
        "amplitude": amp,
        "success": bool(result.success),
        "rotatingState": initial.tolist(),
        "inertialState": inertial,
        "period": 2 * h,
        "closure": closure.tolist(),
        "maxClosure": float(max(abs(closure))),
        "xRange": [float(min(ys[0])), float(max(ys[0]))],
        "yRange": [float(min(ys[1])), float(max(ys[1]))],
        "minMoonClearance": float(min(np.hypot(ys[0] - R, ys[1])) - b["radius"]),
        "minAtmosphereClearance": float(min(np.hypot(ys[0], ys[1])) - 1.2),
    }
    out.append(row)
    print(json.dumps(row), flush=True)
Path("docs/design/libration-service/probe.json").write_text(
    json.dumps(
        {
            "field": {"mu": mu, "muMoon": ms, "radius": R, "rate": n, "phase": phase},
            "equilibria": eq,
            "orbits": out,
        },
        indent=2,
    )
    + "\n"
)
