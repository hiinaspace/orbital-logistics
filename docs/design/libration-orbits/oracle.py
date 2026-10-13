"""Frozen-state full-horizon oracle and independent origin-acceleration check."""

import json
from itertools import pairwise
from pathlib import Path

import numpy as np
from dynamics import propagate, rhs
from scipy.integrate import solve_ivp

BASE = Path(__file__).parent
out = {}
for name in ["halo", "lissajous"]:
    d = json.loads(
        (
            BASE / ("orbit-solution.json" if name == "halo" else "lissajous-solution.json")
        ).read_text()
    )
    n = d["rate"]
    a = d["separation"]
    m = d["mu"]
    initial = d["rotatingState"]
    end = d["duration"] * n
    sol = propagate(initial, end, m, True)
    tight = solve_ivp(
        lambda t, y, m=m: rhs(t, y, m),
        [0, end],
        initial,
        method="DOP853",
        rtol=3e-14,
        atol=3e-15,
        max_step=0.01,
        dense_output=True,
    )
    ts = np.arange(0, d["duration"] + 0.125, 0.25)
    ys = sol.sol(ts * n)
    physical = []
    for t, y in zip(ts, ys.T, strict=True):
        x, yy, z, vx, vy, vz = y
        c = np.cos(n * t)
        s = np.sin(n * t)
        physical.append(
            [
                a * (c * x - s * yy),
                a * (s * x + c * yy),
                a * z,
                a * n * (c * (vx - yy) - s * (vy + x)),
                a * n * (s * (vx - yy) + c * (vy + x)),
                a * n * vz,
            ]
        )
    # A nonrotating primary-relative oracle with indirect origin acceleration.
    p0 = np.array(physical[0])
    p0[0] += a * m
    p0[4] += a * m * n

    def relative_rhs(t, y, a=a, n=n, m=m):
        b = np.array([a * np.cos(n * t), a * np.sin(n * t), 0])
        r = y[:3]
        q = b - r
        return np.r_[
            y[3:],
            -(1 - m) * r / np.linalg.norm(r) ** 3 + m * q / np.linalg.norm(q) ** 3 - m * b / a**3,
        ]

    rel = (
        solve_ivp(
            relative_rhs,
            [0, d["duration"]],
            p0,
            method="DOP853",
            rtol=2e-13,
            atol=2e-14,
            max_step=0.025,
            dense_output=True,
        )
        .sol(ts)
        .T
    )
    world = np.array(physical)
    for i, t in enumerate(ts):
        c = np.cos(n * t)
        s = np.sin(n * t)
        rel[i, :3] -= a * m * np.array([c, s, 0])
        rel[i, 3:] -= a * m * n * np.array([-s, c, 0])
    clearance = min(
        np.min(np.linalg.norm(ys[:3].T - np.array([-m, 0, 0]), axis=1)) * a - 0.65,
        np.min(np.linalg.norm(ys[:3].T - np.array([1 - m, 0, 0]), axis=1)) * a - 0.1,
    )
    out[name] = {
        "times": ts.tolist(),
        "states": physical,
        "tightening": float(np.max(np.abs(sol.sol(ts * n) - tight.sol(ts * n)))),
        "relativeAgreement": float(np.max(np.abs(rel - world))),
        "minSampleClearance": float(clearance),
    }
    print(
        name,
        {k: v for k, v in out[name].items() if k not in ["times", "states"]},
        flush=True,
    )
Path("docs/evidence/libration-orbit-oracle.json").write_text(
    json.dumps(out, separators=(",", ":")) + "\n"
)
# Insertion reference: independent inertial force sum, split exactly at controls.
fixture = json.loads(Path("fixtures/model-sets/sol-earth-observatory-insertion.json").read_text())
bundle = fixture["vessels"][0]["bundle"]
b = fixture["binary"]
m = b["mu"]
a = b["separation"]
n = b["rate"]


def world_rhs(t, y, force):
    c = np.cos(n * t)
    s = np.sin(n * t)
    first = np.array([-a * m * c, -a * m * s, 0])
    second = np.array([a * (1 - m) * c, a * (1 - m) * s, 0])
    r = y[:3] - first
    q = y[:3] - second
    return np.r_[
        y[3:],
        -(1 - m) * r / np.linalg.norm(r) ** 3 - m * q / np.linalg.norm(q) ** 3 + force,
    ]


arcs = bundle["program"]["thrustArcs"]
ends = sorted({0, 60, *[v for arc in arcs for v in [arc["start"], arc["end"]]]})


def insertion(tol):
    y = bundle["scenario"]["ship"]["state"]
    pieces = []
    for start, end in pairwise(ends):
        arc = next((arc for arc in arcs if arc["start"] <= start < arc["end"]), None)
        force = np.array(arc["direction"]) * 0.04 if arc else np.zeros(3)
        sol = solve_ivp(
            lambda t, y, force=force: world_rhs(t, y, force),
            [start, end],
            y,
            method="DOP853",
            rtol=tol,
            atol=tol / 10,
            max_step=0.025,
            dense_output=True,
        )
        y = sol.y[:, -1]
        pieces.append(sol)
    return pieces


ts = np.arange(0, 60.125, 0.25)
pieces = insertion(2e-13)
tight = insertion(3e-14)


def queries(pieces):
    return np.array([next(sol for sol in pieces if sol.t[0] <= t <= sol.t[-1]).sol(t) for t in ts])


ys = queries(pieces)
ty = queries(tight)
arrival = 14
target = json.loads((BASE / "insertion-solution.json").read_text())["targetState"]
actual = next(sol for sol in pieces if sol.t[-1] == arrival).y[:, -1]
out["observatory-insertion"] = {
    "times": ts.tolist(),
    "states": ys.tolist(),
    "tightening": float(np.max(np.abs(ys - ty))),
    "insertionResidual": float(np.max(np.abs(actual - target))),
}
Path("docs/evidence/libration-orbit-oracle.json").write_text(
    json.dumps(out, separators=(",", ":")) + "\n"
)
print(
    "insertion",
    out["observatory-insertion"]["tightening"],
    out["observatory-insertion"]["insertionResidual"],
)
