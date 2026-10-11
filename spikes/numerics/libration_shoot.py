"""Offline finite-thrust witnesses in the exhibit's unchanged two-body field."""

from __future__ import annotations

import json
from math import atan2, cos, pi, sin
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq, least_squares

ROOT = Path(__file__).resolve().parents[2]
base = json.loads((ROOT / "fixtures/model-sets/aster-selene-crossings.json").read_text())
world = base["source"]["source"]["scenario"]
moon = world["bodies"][1]
n = moon["rail"]["rate"]
r = moon["rail"]["radius"]
mu = moon["mu"]
radius = moon["radius"]
a = 1.2
l2 = brentq(lambda x: n * n * x - 1 / x**2 - mu / (x - r) ** 2, r + 0.01, r + 3, xtol=1e-14)
print("L2", l2, flush=True)


def rotate(y, angle):
    c, s = cos(angle), sin(angle)
    z = np.array(y, dtype=float)
    for i in [0, 3]:
        z[i], z[i + 1] = c * y[i] - s * y[i + 1], s * y[i] + c * y[i + 1]
    return z


def support(t, station=False):
    x = l2 if station else r + radius + 1e-5
    return rotate([x, 0, 0, 0, n * x, 0], n * t)


def dirs(q, start, end, landing):
    angles = [q[0], q[1], q[2]]
    final = [q[3], q[4], q[5]]
    if not landing:
        angles[0] = n * start
    else:
        final[-1] = n * end
    return angles, final


def evaluate(q, start, end, landing, tight=False, dense=False):
    first, last = dirs(q, start, end, landing)
    d0, d1 = q[6:8]
    cuts = [start, start + d0 / 2, start + d0, end - d1, end - d1 / 2, end]
    y = support(start, landing)
    sampled = [y.copy()]
    solutions = []

    # Segment-local mode, so endpoint evaluations do not switch to the next arc.
    for lo, hi in zip(cuts[:-1], cuts[1:]):
        mid = (lo + hi) / 2
        mode = 0 if mid < start + d0 else 1 if mid > end - d1 else -1

        def seg(t, z):
            p = z[:3]
            c = rotate([r, 0, 0, 0, 0, 0], n * t)[:3]
            d = c - p
            g = -p / np.linalg.norm(p) ** 3 + mu * d / np.linalg.norm(d) ** 3
            if mode >= 0:
                keys = first if mode == 0 else last
                burnstart = start if mode == 0 else end - d1
                duration = d0 if mode == 0 else d1
                u = min(2.0, max(0.0, (t - burnstart) / duration * 2))
                i = min(1, int(u))
                u = min(1.0, max(0.0, u - i))
                theta = keys[i] + (keys[i + 1] - keys[i]) * u * u * (3 - 2 * u)
                g += a * np.array([cos(theta), sin(theta), 0])
            return np.r_[z[3:], g]

        sol = solve_ivp(
            seg,
            (lo, hi),
            y,
            method="DOP853",
            rtol=2e-13 if tight else 1e-9,
            atol=2e-14 if tight else 1e-10,
            max_step=0.08 if tight else 0.25,
            dense_output=True,
        )
        if not sol.success:
            raise RuntimeError("Trial propagation failed")
        y = sol.y[:, -1]
        sampled.extend(sol.y.T)
        solutions.append(sol)
    target = support(end, not landing)
    # Include fine path points in final reports, never as restart states.
    if dense:
        sampled = np.concatenate([s.sol(np.linspace(s.t[0], s.t[-1], 100)).T for s in solutions])
        times = np.concatenate([np.linspace(s.t[0], s.t[-1], 100) for s in solutions])
    else:
        times = np.concatenate([[start], *[s.t for s in solutions]])
    minimum = min(
        np.linalg.norm(z[:3] - rotate([r, 0, 0, 0, 0, 0], n * t)[:3])
        for z, t in zip(sampled, times)
    )
    return y - target, minimum, solutions


def shoot(start, end, landing, guess):
    def residual(q):
        error, minimum, _ = evaluate(q, start, end, landing)
        return np.r_[error[[0, 1, 3, 4]], 20 * min(0.0, minimum - radius - 5e-6)]

    q = np.array(guess, dtype=float)
    lo = q.copy()
    hi = q.copy()
    lo[:6] -= 1.5
    hi[:6] += 1.5
    lo[6:] = 0.06
    hi[6:] = 1.3
    result = least_squares(
        residual, q, bounds=(lo, hi), max_nfev=220, xtol=1e-12, ftol=1e-12, gtol=1e-12
    )
    q = result.x

    # Tight polish preserves the controls' broad shape.
    def fine(q):
        error, minimum, _ = evaluate(q, start, end, landing, True)
        return np.r_[error[[0, 1, 3, 4]], 20 * min(0.0, minimum - radius - 5e-6)]

    result = least_squares(
        fine, q, bounds=(lo, hi), max_nfev=60, xtol=1e-13, ftol=1e-13, gtol=1e-13
    )
    q = result.x
    error, minimum, _ = evaluate(q, start, end, landing, True, True)
    print(
        "SHOT",
        landing,
        q.tolist(),
        "error",
        np.linalg.norm(error),
        "clearance",
        minimum - radius,
        flush=True,
    )
    assert np.linalg.norm(error) < 5e-8 and minimum > radius + 4e-6
    first, last = dirs(q, start, end, landing)

    def arc(id, start, duration, angles):
        vectors = [[cos(x), sin(x), 0] for x in angles]
        return dict(
            id=id,
            start=start,
            end=start + duration,
            direction=vectors[0],
            throttle=1,
            steering=dict(
                kind="spherical-smoothstep-v1",
                keys=[dict(offset=duration * i / 2, direction=v) for i, v in enumerate(vectors)],
            ),
        )

    return [
        arc("return-release" if landing else "surface-boost", start, q[6], first),
        arc("surface-braking" if landing else "station-braking", end - q[7], q[7], last),
    ], dict(residual=error.tolist(), minimumClearance=minimum - radius, evaluations=result.nfev)


if __name__ == "__main__":
    out, report0 = shoot(
        1.0, 11.0, False, [n, n + 0.2, n + 0.4, pi + n * 11, pi + n * 11, pi + n * 11, 0.65, 0.3]
    )
    # Rotating-frame time reversal with reflection about the Moon line is exact.
    # Constant capped acceleration is independent of the different return mass.
    back: list[dict[str, Any]] = []
    for index, original in enumerate(reversed(out)):
        start = 25 - original["end"]
        duration = original["end"] - original["start"]
        keys = []
        for key in reversed(original["steering"]["keys"]):
            theta = n * 25 - atan2(key["direction"][1], key["direction"][0])
            keys.append(
                dict(offset=duration - key["offset"], direction=[cos(theta), sin(theta), 0])
            )
        back.append(
            dict(
                id="return-release" if index == 0 else "surface-braking",
                start=start,
                end=25 - original["start"],
                direction=keys[0]["direction"],
                throttle=1,
                steering=dict(kind="spherical-smoothstep-v1", keys=keys),
            )
        )
    angles = [
        atan2(k["direction"][1], k["direction"][0]) for arc in back for k in arc["steering"]["keys"]
    ]
    # Unwrap the angle representation to match the shortest C1 spherical turns.
    angles = np.unwrap(angles).tolist()
    error, minimum, _ = evaluate(
        angles + [back[0]["end"] - 14, 24 - back[-1]["start"]], 14, 24, True, True, True
    )
    report1 = dict(
        residual=error.tolist(),
        minimumClearance=minimum - radius,
        method="time-reversal-reflection",
    )
    print("RETURN", report1, flush=True)
    assert np.linalg.norm(error) < 5e-8 and minimum > radius + 4e-6
    phi = moon["rail"]["phase"]
    for arc in out + back:
        duration = arc["end"] - arc["start"]
        for i, key in enumerate(arc["steering"]["keys"]):
            key["offset"] = duration * i / 2
        arc["direction"] = rotate([*arc["direction"], 0, 0, 0], phi)[:3].tolist()
        for key in arc["steering"]["keys"]:
            key["direction"] = rotate([*key["direction"], 0, 0, 0], phi)[:3].tolist()
    payload = dict(
        root=l2,
        rate=n,
        period=32,
        launch=1,
        arrival=11,
        departure=14,
        landing=24,
        refill=30,
        acceleration=a,
        arcs=out + back,
        reports=[report0, report1],
    )
    dest = ROOT / "docs/design/libration-service/shooting.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(payload, indent=2) + "\n")
