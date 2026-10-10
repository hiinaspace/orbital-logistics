"""Offline full-binary moving-Moon latitude sortie in a translating local frame."""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import least_squares

parser = argparse.ArgumentParser()
parser.add_argument("--resume", action="store_true")
args = parser.parse_args()
HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
seed = json.loads((REPO / "fixtures/model-sets/orison-latitude-shuttle.json").read_text())
binary = json.loads((REPO / "fixtures/model-sets/selene-powered.json").read_text())
L = 0.025
UNIT = math.sqrt(L**3 / 0.02)
V = L / UNIT
ACC = L / UNIT**2
HEIGHT = 1e-6
LAT = math.radians(20)
DURATION = 0.5
launch = 0.5
departure = 11.45
bodies = binary["vessels"][0]["bundle"]["scenario"]["bodies"]


def body(b, t):
    r = b["rail"]
    a = r["phase"] + r["rate"] * t
    u, v = np.array(r["u"]), np.array(r["v"])
    p = r["radius"] * (u * math.cos(a) + v * math.sin(a))
    return np.r_[p, r["radius"] * r["rate"] * (-u * math.sin(a) + v * math.cos(a))]


def gravity(tau, y):
    t = tau * UNIT
    moon = body(bodies[1], t)
    primary = body(bodies[0], t)
    p = moon[:3] + L * y[:3]
    q = primary[:3] - p
    inertial = 0.98 * q / np.linalg.norm(q) ** 3
    moon_acc = -moon[:3]
    return -y[:3] / np.linalg.norm(y[:3]) ** 3 + (inertial - moon_acc) / ACC


def pad(tau):
    a = UNIT * tau
    r = 1 + HEIGHT / L
    return np.array(
        [
            r * math.cos(LAT) * math.cos(a),
            r * math.cos(LAT) * math.sin(a),
            r * math.sin(LAT),
            -r * UNIT * math.cos(LAT) * math.sin(a),
            r * UNIT * math.cos(LAT) * math.cos(a),
            0,
        ]
    )


u = np.array([math.cos(LAT), 0, math.sin(LAT)])
v = np.array([0, 1, 0])
phase = -0.9385220143071458
target_initial = np.r_[
    1.4 * (u * math.cos(phase) + v * math.sin(phase)),
    (-u * math.sin(phase) + v * math.cos(phase)) / math.sqrt(1.4),
]
target_solution = solve_ivp(
    lambda t, y: np.r_[y[3:], gravity(t, y)],
    (0, DURATION / UNIT),
    target_initial,
    method="DOP853",
    rtol=2e-13,
    atol=2e-14,
    max_step=0.03,
    dense_output=True,
)


def target(tau):
    return target_solution.sol(tau)


def angles(v):
    return [math.atan2(v[1], v[0]), math.asin(v[2])]


def vectors(x):
    return np.array(
        [
            [math.cos(el) * math.cos(a), math.cos(el) * math.sin(a), math.sin(el)]
            for a, el in np.array(x).reshape(-1, 2)
        ]
    )


def rotate(v, angle):
    c, s = math.cos(angle), math.sin(angle)
    return np.array([c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]])


def flight(x, start, initial, tight=False):
    ds = vectors(x[:-1])
    T = x[-1]
    y = initial.copy()
    minimum = 2.0
    maximum = 0.0
    for i in range(4):
        a, b = ds[i : i + 2]
        theta = math.acos(np.clip(np.dot(a, b), -1, 1))
        lo, hi = start + T * i / 4, start + T * (i + 1) / 4

        def rhs(t, y, a=a, b=b, theta=theta, lo=lo, hi=hi):
            f = np.clip((t - lo) / (hi - lo), 0, 1)
            f = f * f * (3 - 2 * f)
            d = (
                (1 - f) * a + f * b
                if theta < 1e-8
                else (math.sin((1 - f) * theta) * a + math.sin(f * theta) * b) / math.sin(theta)
            )
            return np.r_[y[3:], gravity(t, y) + 1.2 * d]

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
        minimum = min(minimum, float(min(rr)))
        maximum = max(maximum, float(max(rr)))
    return y, minimum, maximum


program = seed["vessels"][0]["bundle"]["program"]
results = []
previous_flights = (
    json.loads((HERE / "authoring.json").read_text())["flights"]
    if (HERE / "authoring.json").exists()
    else []
)
for name, start, initial, destination, arc in [
    ("ascent", launch, pad(launch), target, program["thrustArcs"][0]),
    ("descent", departure, target(departure), pad, program["thrustArcs"][1]),
]:
    if args.resume and len(previous_flights) > (0 if name == "ascent" else 1):
        previous = previous_flights[0 if name == "ascent" else 1]
        xx = np.r_[
            np.array([angles(v) for v in previous["keys"]]).ravel(), previous["duration"] / UNIT
        ]
        yy, lo, hi = flight(xx, start, initial, True)
        assert np.linalg.norm(yy - destination(start + xx[-1])) < 1e-8 and lo > 1
        if all(
            np.dot(a, b) >= -0.5
            for a, b in zip(previous["keys"], previous["keys"][1:], strict=False)
        ):
            results.append(previous)
            continue
    directions = [
        rotate(k["direction"], -0.05 if name == "ascent" else -1.25)
        for k in arc["steering"]["keys"]
    ]
    if name == "ascent":
        directions[0] = pad(start)[:3] / (1 + HEIGHT / L)
    if name == "descent":
        directions[-1] = pad(start + (arc["end"] - arc["start"]))[:3] / (1 + HEIGHT / L)
    x0 = np.r_[np.array([angles(v) for v in directions]).ravel(), arc["end"] - arc["start"]]
    if args.resume and len(previous_flights) > (0 if name == "ascent" else 1):
        previous = previous_flights[0 if name == "ascent" else 1]
        x0 = np.r_[
            np.array([angles(v) for v in previous["keys"]]).ravel(), previous["duration"] / UNIT
        ]
    indices = np.r_[np.arange(2, 10) if name == "ascent" else np.arange(8), 10]

    def residual(controls, tight=False):
        x = x0.copy()
        x[indices] = controls
        if name == "descent":
            x[8:10] = angles(pad(start + x[-1])[:3] / (1 + HEIGHT / L))
        y, lo, hi = flight(x, start, initial, tight)
        return y - destination(start + x[-1]), x, lo, hi

    def objective(controls):
        e, x, lo, hi = residual(controls)
        ds = vectors(x[:-1])
        turns = np.array([min(0, np.dot(a, b) + 0.499) for a, b in zip(ds, ds[1:], strict=False)])
        return np.r_[
            1000 * e,
            1000 * min(0, lo - (1 + HEIGHT / L) * 0.999999),
            1000 * turns,
            0.002 * (controls - x0[indices]),
        ]

    fit = least_squares(
        objective,
        x0[indices],
        bounds=(x0[indices] - 1.2, x0[indices] + 1.2),
        max_nfev=200,
        ftol=1e-11,
        xtol=1e-11,
        gtol=1e-11,
    )

    def fine_objective(controls):
        e, x, lo, hi = residual(controls, True)
        ds = vectors(x[:-1])
        turns = np.array([min(0, np.dot(a, b) + 0.499) for a, b in zip(ds, ds[1:], strict=False)])
        return np.r_[e, 100 * min(0, lo - (1 + HEIGHT / L) * 0.999999), 100 * turns]

    fine = least_squares(
        fine_objective,
        fit.x,
        bounds=(x0[indices] - 1.2, x0[indices] + 1.2),
        max_nfev=240,
        x_scale="jac",
        ftol=1e-13,
        xtol=1e-13,
        gtol=1e-13,
    )
    e, x, lo, hi = residual(fine.x, True)
    result = {
        "name": name,
        "start": start * UNIT,
        "duration": float(x[-1] * UNIT),
        "keys": vectors(x[:-1]).tolist(),
        "error": float(np.linalg.norm(e)),
        "minimumLocalRadius": lo,
        "maximumLocalRadius": hi,
        "evaluations": fit.nfev + fine.nfev,
    }
    print(json.dumps(result), flush=True)
    assert max(abs(e)) < 1e-8 and lo > 1 and x[-1] > 0
    results.append(result)
    (HERE / "authoring.json").write_text(
        json.dumps(
            {
                "units": {"length": L, "time": UNIT, "speed": V, "acceleration": ACC},
                "flights": results,
            },
            indent=2,
        )
        + "\n"
    )


def physical(local, t):
    moon = body(bodies[1], t)
    return np.r_[moon[:3] + L * local[:3], moon[3:] + V * local[3:]].tolist()


def arc(result):
    start = result["start"]
    end = start + result["duration"]
    keys = result["keys"]
    return {
        "id": result["name"],
        "start": start,
        "end": end,
        "direction": keys[0],
        "throttle": 1,
        "steering": {
            "kind": "spherical-smoothstep-v1",
            "keys": [{"offset": (end - start) * i / 4, "direction": d} for i, d in enumerate(keys)],
        },
    }


ship = {
    "id": "Tern",
    "state": physical(pad(0), 0),
    "dryMass": 1,
    "cargoMass": 0,
    "propellant": 6,
    "tankCapacity": 6,
    "exhaustVelocity": 3 * V,
    "engine": {"maxThrust": 32 * ACC, "maxAcceleration": 1.2 * ACC},
}
ground = {
    "id": "Northhaven",
    "rail": {
        "kind": "surface",
        "bodyId": "moon",
        "centerHeight": HEIGHT,
        "latitude": LAT,
        "rate": 1,
        "phase": 0,
    },
    "cargo": 0.2,
    "cargoCapacity": 1,
    "propellant": 10,
    "tankCapacity": 10,
    "serviceDuration": 0.2 * UNIT,
}
station = {
    "id": "Crescent",
    "rail": {
        "kind": "ballistic",
        "epoch": 0,
        "validUntil": DURATION,
        "state": physical(target_initial, 0),
        "policy": {"step": 1 / 8192, "maxNodes": 16384, "maxSubdivision": 20},
        "minClearance": 0.0001,
        "provenance": "Inclined moon-local depot, propagated in both gravitational fields",
    },
    "cargo": 0,
    "cargoCapacity": 1,
    "propellant": 4,
    "tankCapacity": 4,
    "serviceDuration": 0.2 * UNIT,
}
ascent, descent = map(arc, results)
arrival = ascent["end"]
# Return hardware uses the actual arrival reserve plus a finite stock top-up.
used = (1 + 0.05 + 6) * (1 - math.exp(-1.2 * ACC * (ascent["end"] - ascent["start"]) / (3 * V)))
remaining = 6 - used
assert remaining < 2.8
ops = [
    {"id": "at-pad", "kind": "dock", "t": 0, "portId": "Northhaven"},
    {
        "id": "load",
        "kind": "transfer",
        "t": 0,
        "portId": "Northhaven",
        "cargo": 0.05,
        "propellant": 0,
    },
    {
        "id": "launch",
        "kind": "launch",
        "t": ascent["start"],
        "portId": "Northhaven",
        "thrustArcId": "ascent",
    },
    {"id": "arrival", "kind": "dock", "t": arrival, "portId": "Crescent"},
    {
        "id": "unload",
        "kind": "transfer",
        "t": arrival,
        "portId": "Crescent",
        "cargo": -0.05,
        "propellant": 0,
    },
    {
        "id": "top-up",
        "kind": "transfer",
        "t": arrival + 0.2 * UNIT,
        "portId": "Crescent",
        "cargo": 0,
        "propellant": 2.8 - remaining,
    },
    {"id": "depart", "kind": "undock", "t": descent["start"], "portId": "Crescent"},
    {"id": "land", "kind": "land", "t": descent["end"], "portId": "Northhaven"},
]
scenario = {
    "schemaVersion": 3,
    "modelVersion": "rk4-canonical-v3",
    "id": "selene-ground",
    "units": {
        "length": "planet–moon separation",
        "time": "inverse binary angular rate",
        "mass": "ship dry mass",
    },
    "epoch": 0,
    "duration": DURATION,
    "policy": {"step": 1 / 8192, "maxNodes": 32768, "maxSubdivision": 20},
    "bodies": bodies,
    "ship": ship,
    "logistics": {
        "modelVersion": "moving-surface-ports-v6",
        "ports": [ground, station],
        "cargoCapacity": 0.05,
        "capture": {"position": 1e-7, "velocity": 1e-7},
        "objective": {
            "destinationId": "Crescent",
            "quota": 0.05,
            "returnPortId": "Northhaven",
            "minPropellant": 0.1,
            "hardwareCost": 1,
        },
    },
}
model = {
    "schemaVersion": 1,
    "id": "selene-ground",
    "name": "Selene · Northern ground service",
    "extent": 1.2,
    "frameExtents": {"moon": 0.026, "Northhaven": 0.04, "Tern": 0.045},
    "description": (
        "Tern carries supplies from Selene's northern surface to an inclined Crescent "
        "depot, then lands back at Northhaven."
    ),
    "provenance": (
        "Fictional circular binary, actual moving body-relative pad at 20° north with "
        "explicitly synchronous spin. Full two-body gravity, ballistic inclined "
        "depot, independently authored smooth finite-thrust sortie and paid captures. "
        "Finite prepared scene."
    ),
    "rotating": {"name": "Planet–moon rotating", "rate": 1, "phase": 0},
    "stations": [
        {"id": "Northhaven", "role": "Lunar surface freight terminal", "berths": 1},
        {"id": "Crescent", "role": "Inclined lunar depot", "berths": 1},
    ],
    "vessels": [
        {
            "name": "Tern",
            "color": "#efb878",
            "cargo": "Supplies",
            "glyph": "rocket",
            "bundle": {
                "scenario": scenario,
                "program": {
                    "schemaVersion": 4,
                    "id": "selene-ground-sortie",
                    "burns": [],
                    "thrustArcs": [ascent, descent],
                    "operations": ops,
                },
            },
        }
    ],
}
(REPO / "fixtures/model-sets/selene-ground.json").write_text(json.dumps(model, indent=2) + "\n")
