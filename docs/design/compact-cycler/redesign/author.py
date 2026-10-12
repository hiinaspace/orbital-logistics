"""Bounded offline authoring of one ballistic-carrier parcel round trip.

All middle/parking intervals propagate forward, and endpoint corrections use the
same prescribed gravity field. No inverse positions or preview data become physics.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import CubicHermiteSpline
from scipy.optimize import brentq, root

sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from spikes.numerics import compact_cycler as m  # noqa: E402

HERE = Path(__file__).parent
SEED = json.loads((HERE / "carrier-seed.json").read_text())
PERIOD = SEED["period"]
INITIAL = np.array(SEED["initial"])[[0, 1, 3, 4]]
CARRIER = m.forward(0, 2 * PERIOD, INITIAL)
R = 1.4
OMEGA = np.sqrt(1 / R**3)
PHASES = {"Cairn": 0.0, "Haven": 0.0}
CAP = 4.0
SEGMENTS = []


def wrap(a):
    return (a + np.pi) % (2 * np.pi) - np.pi


def port(id, t):
    r = 1.00001 if id == "Cairn" else 0.20001
    local = m.rotate([r, 0, 0, m.RATE * r], m.RATE * t + PHASES[id])
    return local + (m.circular(t, 5) if id == "Haven" else 0)


def normal(id, t):
    return m.rotate([1, 0, 0, 0], m.RATE * t + PHASES[id])[:2]


setattr(m, "port", port)
setattr(m, "normal", normal)


def parking(t, r, angle, body="Aster", direction=1):
    mu = 1 if body == "Aster" else 0.03
    y = m.rotate([r, 0, 0, direction * np.sqrt(mu / r)], angle)
    return y + (m.circular(t, 5) if body == "Selene" else 0)


def check(q):
    ts = np.linspace(q["t0"], q["t1"], 1025)
    ys = q["result"].sol(ts).T
    clears = [
        min(np.linalg.norm(y[:2]) - 1 for y in ys),
        min(np.linalg.norm(y[:2] - m.circular(t, 5)[:2]) - 0.2 for t, y in zip(ts, ys)),
    ]
    if min(clears) < -1e-8:
        raise RuntimeError("Sampled collision " + q.get("id", "flight"))
    print(
        "SEGMENT",
        q.get("id", "flight"),
        q["t0"],
        q["t1"],
        "dv",
        q["dv"],
        "clear",
        clears,
        flush=True,
    )
    SEGMENTS.append(q)
    return q["end"].copy()


def coast(id, a, b, initial):
    q = m.forward(a, b, initial)
    return check(dict(id=id, t0=a, t1=b, initial=initial.copy(), end=q.y[:4, -1], result=q, dv=0.0))


def burn(id, a, b, initial, target, launch=None, landing=None):
    q = m.burn(id, a, b, initial, target, CAP, launch=launch, landing=landing)
    q["id"] = id
    return check(q)


def pulse(id, a, b, initial, target, first=0.75, last=0.75, guess=None):
    """Two C1 finite thrust pulses with a literal ballistic middle."""
    keys = np.unique(np.r_[np.linspace(a, a + first, 129), np.linspace(b - last, b, 129)])
    values, derivatives = [], []
    for t in keys:
        vs, ds = [], []
        for left, length in [(a, first), (b - last, last)]:
            u = (t - left) / length
            vs.append(2 * np.sin(np.pi * u) ** 2 / length if 0 < u < 1 else 0.0)
            ds.append(2 * np.pi * np.sin(2 * np.pi * u) / length**2 if 0 < u < 1 else 0.0)
        values.append(vs)
        derivatives.append(ds)
    values, derivatives = np.array(values), np.array(derivatives)
    bases = [CubicHermiteSpline(keys, values[:, i], derivatives[:, i]) for i in [0, 1]]
    cached, answer, calls = None, None, 0
    anchor = np.zeros(4) if guess is None else np.array(guess)

    def trial(increment):
        nonlocal cached, answer, calls
        if cached is not None and np.array_equal(cached, increment):
            return answer
        calls += 1
        if calls > 36:
            raise RuntimeError("Pulse solve budget")
        z = anchor + increment
        sp = CubicHermiteSpline(
            keys,
            values[:, 0, None] * z[:2] + values[:, 1, None] * z[2:],
            derivatives[:, 0, None] * z[:2] + derivatives[:, 1, None] * z[2:],
        )
        q = m.forward(a, b, initial, sp, True, bases)
        cached, answer = increment.copy(), (q, sp)
        return answer

    scale = np.array([b - a, b - a, 1, 1])

    def residual(z):
        return (trial(z)[0].y[:4, -1] - target) / scale

    def jac(z):
        return trial(z)[0].y[5:, -1].reshape(4, 4) / scale[:, None]

    z = root(residual, np.zeros(4), jac=jac, tol=1e-10, options={"maxfev": 36, "factor": 0.3})
    q, sp = trial(z.x)
    if np.max(np.abs(q.y[:4, -1] - target)) > 1e-8:
        raise RuntimeError("Pulse residual " + id)
    actual = initial.copy()
    for left, right, iscoast in [
        (a, a + first, False),
        (a + first, b - last, True),
        (b - last, b, False),
    ]:
        if iscoast:
            actual = coast(id + " coast", left, right, actual)
            continue
        ts = np.linspace(left, right, 129)
        spline = CubicHermiteSpline(ts, sp(ts), sp(ts, 1))
        result = m.forward(left, right, actual, spline)
        coef = np.zeros((128, 4, 3))
        coef[:, :, :2] = spline.c.transpose(1, 0, 2)
        h = np.diff(ts)[:, None]
        c = spline.c
        bound = np.linalg.norm(
            np.array(
                [
                    c[3],
                    c[3] + c[2] * h / 3,
                    c[3] + 2 * c[2] * h / 3 + c[1] * h * h / 3,
                    c[3] + c[2] * h + c[1] * h * h + c[0] * h**3,
                ]
            ),
            axis=2,
        ).max()
        if bound > CAP:
            raise RuntimeError("Pulse cap " + id)
        arc = dict(
            id=id + (" departure" if left == a else " arrival"),
            start=left,
            end=right,
            keys=[[float(t), *map(float, spline(t)), 0.0] for t in ts],
            coefficients=coef.tolist(),
            accelerationBound=float(bound),
        )
        actual = check(
            dict(
                id=arc["id"],
                t0=left,
                t1=right,
                initial=actual.copy(),
                end=result.y[:4, -1],
                result=result,
                dv=float(result.y[4, -1]),
                arc=arc,
            )
        )
    m.capture(actual, target)
    return actual


def save():
    parts = []
    for q in SEGMENTS:
        parts.append(
            dict(
                id=q["id"],
                start=q["t0"],
                end=q["t1"],
                initial=m.state6(q["initial"]),
                endpoint=m.state6(q["end"]),
                **({"control": q["arc"]} if "arc" in q else {}),
            )
        )
    (HERE / "controls.json").write_text(
        json.dumps(
            dict(
                schemaVersion=1,
                period=PERIOD,
                carrierInitial=m.state6(INITIAL),
                padPhases=PHASES,
                segments=parts,
            ),
            separators=(",", ":"),
        )
        + "\n"
    )


if __name__ == "__main__":
    board, transfer = 56.0, 49.0
    target = CARRIER.sol(board)[:4]
    angle = np.arctan2(target[1], target[0]) - np.pi
    start_angle = wrap(angle - OMEGA * (transfer - 3))
    PHASES["Cairn"] = float(wrap(start_angle - 0.7 - m.RATE))
    actual = burn(
        "Cairn ascent", 1.0, 3.0, port("Cairn", 1), parking(3, R, start_angle), launch="Cairn"
    )
    actual = coast("Aster parking", 3, transfer, actual)
    tangent = np.array([-actual[1], actual[0]]) / np.linalg.norm(actual[:2])
    rv = np.linalg.norm(target[:2])
    dv = np.sqrt(2 / R - 2 / (R + rv)) - np.sqrt(1 / R)
    actual = pulse(
        "Wayfarer connection",
        transfer,
        board,
        actual,
        target,
        guess=np.r_[dv * tangent, 0.18 * np.array([-target[1], target[0]]) / rv],
    )
    save()
    release, insertion = 66.0, 69.0
    approach = CARRIER.sol(insertion)[:4] - m.circular(insertion, 5)
    angle = np.arctan2(approach[1], approach[0])
    actual = pulse(
        "Lunar orbital braking",
        release,
        insertion,
        CARRIER.sol(release)[:4],
        parking(insertion, 0.32, angle, "Selene", -1),
        first=0.5,
        last=0.5,
    )
    actual = coast("Selene coast", insertion, 71.0, actual)
    rel = actual - m.circular(71, 5)
    PHASES["Haven"] = float(wrap(np.arctan2(rel[1], rel[0]) - 0.65 - m.RATE * 73.5))
    actual = burn("Haven descent", 71, 73.5, actual, port("Haven", 73.5), landing="Haven")
    save()
    actual = burn(
        "Haven ascent",
        74.5,
        75.75,
        port("Haven", 74.5),
        parking(75.75, 0.32, m.RATE * 75.75 + PHASES["Haven"] - 0.55, "Selene", -1),
        launch="Haven",
    )
    actual = pulse(
        "Wayfarer lunar connection", 75.75, 79.5, actual, CARRIER.sol(79.5)[:4], first=0.5, last=0.5
    )
    save()
    release, insertion = 83.5, 86.5
    y = CARRIER.sol(insertion)[:4]
    angle = np.arctan2(y[1], y[0])
    actual = pulse(
        "Aster orbital braking",
        release,
        insertion,
        CARRIER.sol(release)[:4],
        parking(insertion, R, angle),
        first=0.5,
        last=0.5,
    )
    free = m.forward(insertion, 113, actual)

    def phase(t):
        y = free.sol(t)[:4]
        return wrap(np.arctan2(y[1], y[0]) - (m.RATE * (t + 1.5) + PHASES["Cairn"]) + 0.55)

    land_start = None
    ts = np.linspace(98, 108, 81)
    for a, b in zip(ts[:-1], ts[1:]):
        if phase(a) < 0 < phase(b) and abs(phase(b) - phase(a)) < 1:
            land_start = float(brentq(phase, a, b, xtol=1e-12))
            break
    if land_start is None:
        raise RuntimeError("No descent phase")
    actual = coast("Aster return parking", insertion, land_start, actual)
    actual = burn(
        "Cairn descent",
        land_start,
        land_start + 1.5,
        actual,
        port("Cairn", land_start + 1.5),
        landing="Cairn",
    )
    save()
    print(
        "COMPLETE",
        PHASES,
        "land",
        land_start + 1.5,
        "total dv",
        sum(q["dv"] for q in SEGMENTS),
        flush=True,
    )
