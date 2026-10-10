import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

repo = Path(__file__).resolve().parents[3]
base = json.loads((repo / "fixtures/traffic/orison-shuttle-service.json").read_text())
lat = math.radians(20)
launch = 0.5
duration = base["templates"][0]["duration"]


def rotate(v, a):
    c, s = math.cos(a), math.sin(a)
    return np.array([c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]])


rad = rotate([math.cos(lat), 0, math.sin(lat)], 0.05)
east = rotate([0, 1, 0], 0.05)


def pad(t):
    a = 0.1 * t
    r = 1.000001
    return np.array(
        [
            r * math.cos(lat) * math.cos(a),
            r * math.cos(lat) * math.sin(a),
            r * math.sin(lat),
            -r * 0.1 * math.cos(lat) * math.sin(a),
            r * 0.1 * math.cos(lat) * math.cos(a),
            0,
        ]
    )


phase = base["world"]["scenario"]["logistics"]["ports"][1]["rail"]["phase"]


def depot(t):
    a = phase + 1.4**-1.5 * t - 0.05
    c, s = math.cos(a), math.sin(a)
    return np.r_[1.4 * (rad * c + east * s), 1.4**-0.5 * (-rad * s + east * c)]


def angles(v):
    return [math.atan2(v[1], v[0]), math.asin(v[2])]


def dirs(x):
    return np.array(
        [
            [math.cos(el) * math.cos(a), math.cos(el) * math.sin(a), math.sin(el)]
            for a, el in np.array(x).reshape(-1, 2)
        ]
    )


def flight(x, initial, T, tight=False):
    vectors = dirs(x)
    y = initial.copy()
    minimum = 2.0
    maximum = 0
    for i in range(4):
        a, b = vectors[i : i + 2]
        theta = math.acos(np.clip(np.dot(a, b), -1, 1))
        lo, hi = T * i / 4, T * (i + 1) / 4

        def rhs(t, y, a=a, b=b, theta=theta, lo=lo, hi=hi):
            h = np.clip((t - lo) / (hi - lo), 0, 1)
            h = h * h * (3 - 2 * h)
            d = (
                (1 - h) * a + h * b
                if theta < 1e-8
                else (math.sin((1 - h) * theta) * a + math.sin(h * theta) * b) / math.sin(theta)
            )
            return np.r_[y[3:], -y[:3] / np.linalg.norm(y[:3]) ** 3 + 1.2 * d]

        sol = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-8,
            atol=2e-13 if tight else 2e-10,
            max_step=(hi - lo) / 8,
        )
        y = sol.y[:, -1]
        rr = np.linalg.norm(sol.y[:3], axis=0)
        minimum = min(minimum, min(rr))
        maximum = max(maximum, max(rr))
    return y, minimum, maximum


results = []
for leg, start, T, initial, target in [
    ("ascent", launch, duration, pad(launch), depot(launch + duration)),
    (
        "descent",
        13.749399215612783,
        duration,
        depot(13.749399215612783),
        pad(13.749399215612783 + duration),
    ),
]:
    raw = base["templates"][0 if leg == "ascent" else 1]["arcs"][0]["steering"]["keys"]
    seed = []
    for k in raw:
        v = np.array(k["direction"])
        a = math.atan2(v[1], v[0]) - 0.05
        # Ascent seed follows launch plane; descent seed starts with old inertial angles.
        d = rad * math.cos(a) + east * math.sin(a) if leg == "ascent" else v
        seed.extend(angles(d))
    seed = np.array(seed)
    if leg == "ascent":
        seed[:2] = angles(rad)

    if leg == "descent":
        seed[-2:] = angles(pad(start + T)[:3] / 1.000001)
    indices = np.arange(2, 10) if leg == "ascent" else np.arange(10)
    seed = np.r_[seed, T]
    indices = np.r_[indices, 10]

    def residual(
        v,
        tight=False,
        seed=seed,
        indices=indices,
        initial=initial,
        start=start,
        leg=leg,
    ):
        x = seed.copy()
        x[indices] = v
        y, lo, hi = flight(x[:10], initial, x[10], tight)
        target = depot(start + x[10]) if leg == "ascent" else pad(start + x[10])
        return y - target, x, lo, hi

    def objective(v, residual=residual, seed=seed, indices=indices):
        e, _x, lo, _hi = residual(v)
        return np.r_[1000 * e, 1000 * min(0, lo - 1.0000009), 0.002 * (v - seed[indices])]

    fit = least_squares(
        objective,
        seed[indices],
        max_nfev=100,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-11,
        bounds=(seed[indices] - 1.0, seed[indices] + 1.0),
    )
    # underdetermined exact tightening
    fine = least_squares(
        lambda v, residual=residual: residual(v, True)[0],
        fit.x,
        max_nfev=240,
        bounds=(seed[indices] - 1.0, seed[indices] + 1.0),
        x_scale="jac",
        ftol=1e-13,
        xtol=1e-13,
        gtol=1e-13,
    )
    e, x, lo, hi = residual(fine.x, True)
    result = {
        "leg": leg,
        "start": start,
        "duration": float(x[10]),
        "keys": dirs(x[:10]).tolist(),
        "error": float(np.linalg.norm(e)),
        "minimumRadius": float(lo),
        "maximumRadius": float(hi),
        "evaluations": fit.nfev,
    }
    print(json.dumps(result), flush=True)
    results.append(result)
    Path(__file__).with_name("latitude-authoring.json").write_text(
        json.dumps(
            {
                "latitude": lat,
                "u": rad.tolist(),
                "v": east.tolist(),
                "phase": phase - 0.05,
                "flights": results,
            },
            indent=2,
        )
    )
Path(__file__).with_name("latitude-authoring.json").write_text(
    json.dumps(
        {
            "latitude": lat,
            "u": rad.tolist(),
            "v": east.tolist(),
            "phase": phase - 0.05,
            "flights": results,
        },
        indent=2,
    )
)
