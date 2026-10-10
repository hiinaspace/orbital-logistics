"""Independent DOP853 mission tree; every child starts from this oracle's parent.
Frozen station and steering are inputs, never adjusted to production endpoints.
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

parser = argparse.ArgumentParser()
parser.add_argument("--input", default="docs/evidence/atmospheric-mission-oracle-input.json")
parser.add_argument("--output", default="docs/evidence/atmospheric-mission-oracle.json")
args = parser.parse_args()
source = json.loads(Path(args.input).read_text())
d = source["definition"]
body = d["world"]["bodies"][0]
a = d["atmosphere"]
spin = np.array(a["spin"])
center = np.array(body["rail"]["position"])
g = d["guidance"]
water = d["recovery"]
ports = d["world"]["logistics"]["ports"]
pad = next(p for p in ports if p["rail"]["kind"] == "surface")
station = next(p for p in ports if p["rail"]["kind"] == "circular")


def rail(port, t):
    r = port["rail"]
    angle = r["phase"] + r["rate"] * t
    u, v = np.array(r["u"]), np.array(r["v"])
    if r["kind"] == "surface" and "latitude" in r:
        latitude = r["latitude"]
        return np.r_[
            np.array(r["center"])
            + r["radius"]
            * np.array(
                [
                    math.cos(latitude) * math.cos(angle),
                    math.cos(latitude) * math.sin(angle),
                    math.sin(latitude),
                ]
            ),
            r["radius"]
            * r["rate"]
            * math.cos(latitude)
            * np.array([-math.sin(angle), math.cos(angle), 0]),
        ]
    return np.r_[
        np.array(r["center"]) + r["radius"] * (u * math.cos(angle) + v * math.sin(angle)),
        r["radius"] * r["rate"] * (-u * math.sin(angle) + v * math.cos(angle)),
    ]


def aero(z, configuration):
    p = z[:3] - center
    radius = np.linalg.norm(p)
    normal = p / radius
    altitude = radius - body["radius"]
    relative = z[3:6] - np.cross(spin, p)
    speed = np.linalg.norm(relative)
    density = a["density"] * np.exp(-max(0, altitude) / a["scaleHeight"])
    f = np.clip((a["topHeight"] - altitude) / (a["topHeight"] - a["fadeHeight"]), 0, 1)
    density *= f * f * (3 - 2 * f)
    pressure = 0.5 * density * speed**2
    drag = -0.5 * density * configuration["dragArea"] * speed * relative
    flow = relative / speed if speed > 1e-12 else np.zeros(3)
    crossflow = normal - flow * np.dot(normal, flow)
    h = np.clip(altitude / configuration["liftFadeHeight"], 0, 1)
    lift = (
        pressure
        * configuration["dragArea"]
        * configuration["liftToDrag"]
        * h
        * h
        * (3 - 2 * h)
        * crossflow
        / np.sqrt(np.dot(crossflow, crossflow) + 1e-8)
    )
    return drag, lift, pressure, np.sqrt(density) * speed**3, relative, normal, altitude


def direction(arc, t):
    keys = arc["steering"]["keys"]
    elapsed = t - arc["start"]
    if elapsed <= 0:
        return np.array(keys[0]["direction"])
    if elapsed >= keys[-1]["offset"]:
        return np.array(keys[-1]["direction"])
    k = next(i for i in range(1, len(keys)) if keys[i]["offset"] > elapsed)
    lo, hi = keys[k - 1], keys[k]
    f = (elapsed - lo["offset"]) / (hi["offset"] - lo["offset"])
    f = f * f * (3 - 2 * f)
    if d["modelVersion"] == "atmospheric-mission-v2":
        # Independent Rodrigues rotation about the great-circle normal.
        start, end = np.array(lo["direction"]), np.array(hi["direction"])
        normal = np.cross(start, end)
        length = np.linalg.norm(normal)
        if length < 1e-14:
            return start
        normal /= length
        angle = math.atan2(length, np.dot(start, end)) * f
        return (
            start * math.cos(angle)
            + np.cross(normal, start) * math.sin(angle)
            + normal * np.dot(normal, start) * (1 - math.cos(angle))
        )
    # Independent planar unwrapped-angle form of the shortest great-circle turn.
    aa, bb = (
        math.atan2(lo["direction"][1], lo["direction"][0]),
        math.atan2(hi["direction"][1], hi["direction"][0]),
    )
    delta = (bb - aa + math.pi) % (2 * math.pi) - math.pi
    return np.array([math.cos(aa + f * delta), math.sin(aa + f * delta), 0])


def model(z, t, hardware, nonfuel, arc=None, entry=False):
    configuration = d["entryAero"] if entry else d["ascentAero"]
    drag, lift, pressure, heat, relative, normal, altitude = aero(z, configuration)
    gravity = -body["mu"] * (z[:3] - center) / np.linalg.norm(z[:3] - center) ** 3
    mass = nonfuel + z[6]
    if entry:
        f = np.clip((g["startHeight"] - altitude) / (g["startHeight"] - g["fullHeight"]), 0, 1)
        engagement = f * f * (3 - 2 * f)
        speed = -np.sqrt(
            g["descentSpeed"] ** 2 + 2 * g["descentGain"] * max(0, altitude - water["height"])
        )
        thrust = (
            mass
            * engagement
            * (-gravity - (drag + lift) / mass + g["velocityGain"] * (speed * normal - relative))
        )
        maximum = min(hardware["engine"]["maxThrust"], hardware["engine"]["maxAcceleration"] * mass)
        length = np.linalg.norm(thrust)
        if length > maximum:
            thrust *= maximum / length
    elif arc:
        thrust = min(
            hardware["engine"]["maxThrust"] * arc["throttle"],
            hardware["engine"]["maxAcceleration"] * mass,
        ) * direction(arc, t)
    else:
        thrust = np.zeros(3)
    rate = np.r_[
        z[3:6],
        gravity + (drag + lift + thrust) / mass,
        -np.linalg.norm(thrust) / hardware["exhaustVelocity"],
    ]
    return rate, {
        "pressure": float(pressure),
        "heat": float(heat),
        "force": float(np.linalg.norm(thrust)),
        "acceleration": float(np.linalg.norm(drag + lift + thrust) / mass),
    }


def solve_tree(tolerance, maximum_step):
    booster, upper = d["booster"], d["payload"]
    legs, entries = {}, {}

    def fixed(name, z, start, end, hardware, nonfuel, arcs):
        cuts = sorted(
            {
                start,
                end,
                *[
                    t
                    for arc in arcs
                    for t in [
                        arc["start"],
                        arc["end"],
                        *[arc["start"] + k["offset"] for k in arc["steering"]["keys"]],
                    ]
                    if start < t < end
                ],
            }
        )
        parts = []
        for lo, hi in zip(cuts, cuts[1:]):
            arc = next((arc for arc in arcs if arc["start"] <= (lo + hi) / 2 < arc["end"]), None)
            sol = solve_ivp(
                lambda t, z: model(z, t, hardware, nonfuel, arc)[0],
                (lo, hi),
                z,
                method="DOP853",
                rtol=tolerance,
                atol=tolerance / 100,
                max_step=maximum_step,
                dense_output=True,
            )
            assert sol.success
            parts.append((sol, arc))
            z = sol.y[:, -1]
        legs[name] = (parts, hardware, nonfuel)
        return z

    def entry(name, z, start, hardware, nonfuel):
        def contact(t, z):
            return np.linalg.norm(z[:3] - center) - body["radius"] - water["height"]

        setattr(contact, "terminal", True)
        setattr(contact, "direction", -1)
        sol = solve_ivp(
            lambda t, z: model(z, t, hardware, nonfuel, entry=True)[0],
            (start, d["world"]["duration"]),
            z,
            method="DOP853",
            rtol=tolerance,
            atol=tolerance / 100,
            max_step=maximum_step,
            events=contact,
            dense_output=True,
        )
        assert sol.success and len(sol.t_events[0]) == 1
        assert sol.y[6, -1] > 0
        entries[name] = (sol, hardware, nonfuel)

    boost = d["programs"]["stack"]["thrustArcs"][0]
    initial = np.r_[rail(pad, boost["start"]), booster["propellant"]]
    parent_nonfuel = (
        booster["dryMass"] + upper["dryMass"] + upper["propellant"] + upper["cargoMass"]
    )
    split = fixed(
        "stack", initial, boost["start"], d["separation"]["t"], booster, parent_nonfuel, [boost]
    )
    boostback = fixed(
        "boostback",
        split.copy(),
        d["separation"]["t"],
        d["entryStarts"]["booster"],
        booster,
        booster["dryMass"],
        d["programs"]["booster"]["thrustArcs"],
    )
    entry("boosterEntry", boostback, d["entryStarts"]["booster"], booster, booster["dryMass"])
    newborn = split.copy()
    newborn[6] = upper["propellant"]
    arrival = d["programs"]["payload"]["operations"][0]["t"]
    incoming = fixed(
        "insertion",
        newborn,
        d["separation"]["t"],
        arrival,
        upper,
        upper["dryMass"] + upper["cargoMass"],
        [d["programs"]["payload"]["thrustArcs"][0]],
    )
    target = rail(station, arrival)
    miss = np.linalg.norm(target[:3] - incoming[:3])
    dv = np.linalg.norm(target[3:6] - incoming[3:6])
    assert miss + 1e-8 < 1e-7 and dv + 1e-8 < 1e-7
    fuel_used = (upper["dryMass"] + upper["cargoMass"] + incoming[6]) * (
        -np.expm1(-dv / upper["exhaustVelocity"])
    )
    departure = d["programs"]["payload"]["operations"][2]["t"]
    undocked = np.r_[rail(station, departure), incoming[6] - fuel_used]
    deorbit = fixed(
        "deorbit",
        undocked,
        departure,
        d["entryStarts"]["payload"],
        upper,
        upper["dryMass"],
        [d["programs"]["payload"]["thrustArcs"][1]],
    )
    entry("payloadEntry", deorbit, d["entryStarts"]["payload"], upper, upper["dryMass"])
    return (
        legs,
        entries,
        {"position": float(miss), "velocity": float(dv), "fuelUsed": float(fuel_used)},
    )


regular = solve_tree(1e-12, 0.002)
tight = solve_tree(1e-13, 0.0005)
rows = []
gap = 0.0
peak = {}


def evaluate(parts, t):
    return next(sol.sol(t) for sol, _ in parts if sol.t[0] - 1e-13 <= t <= sol.t[-1] + 1e-13)


for name, (parts, hardware, nonfuel) in tight[0].items():
    old = regular[0][name][0]
    epochs = np.linspace(parts[0][0].t[0], parts[-1][0].t[-1], 501)
    gap = max(
        gap, float(max(np.max(np.abs(evaluate(parts, t) - evaluate(old, t))) for t in epochs))
    )
    maxima = {key: 0.0 for key in ["pressure", "heat", "force", "acceleration"]}
    for sol, arc in parts:
        for t in np.linspace(sol.t[0], sol.t[-1], 2001):
            values = model(sol.sol(t), t, hardware, nonfuel, arc)[1]
            for key in maxima:
                maxima[key] = max(maxima[key], values[key])
    peak[name] = maxima
for name, (sol, hardware, nonfuel) in tight[1].items():
    old = regular[1][name][0]
    epochs = np.linspace(sol.t[0], min(sol.t[-1], old.t[-1]), 501)
    gap = max(gap, float(np.max(np.abs(sol.sol(epochs) - old.sol(epochs)))))
    maxima = {key: 0.0 for key in ["pressure", "heat", "force", "acceleration"]}
    for t in np.linspace(sol.t[0], sol.t[-1], 10001):
        values = model(sol.sol(t), t, hardware, nonfuel, entry=True)[1]
        for key in maxima:
            maxima[key] = max(maxima[key], values[key])
    peak[name] = maxima
assert gap < 2e-9, gap
for case in source["cases"]:
    errors = {}
    for name, leg in case["legs"].items():
        parts = tight[0][name][0]
        error = max(
            float(np.max(np.abs(np.array(sample["z"]) - evaluate(parts, sample["t"]))))
            for sample in leg["samples"]
        )
        errors[name] = error
        assert error < 8e-8, (case["step"], name, error)
    for name, entry_data in case["entries"].items():
        sol = tight[1][name][0]
        error = max(
            float(np.max(np.abs(np.array(sample["z"]) - sol.sol(sample["t"]))))
            for sample in entry_data["samples"]
        )
        contact_error = abs(entry_data["offset"] + entry_data["contact"]["t"] - sol.t[-1])
        errors[name] = {"state": error, "contact": contact_error}
        assert error < 1e-7 and contact_error < 2e-7, (case["step"], name, error, contact_error)
        for key in peak[name]:
            assert abs(peak[name][key] - entry_data["maxima"][key]) < 0.003, (name, key)
    rows.append(
        {
            "step": case["step"],
            "errors": errors,
            "work": case["work"],
            "elapsedMs": case["elapsedMs"],
        }
    )
report = {
    "oracle": "independent original-state DOP853 branch tree",
    "tighteningMaxStateDifference": gap,
    "capture": tight[2],
    "maxima": peak,
    "recoveries": {
        name: {
            "t": float(sol.t[-1]),
            "fuel": float(sol.y[6, -1]),
            "speed": float(np.linalg.norm(aero(sol.y[:, -1], d["entryAero"])[4])),
        }
        for name, (sol, _, _) in tight[1].items()
    },
    "cases": rows,
}
Path(args.output).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
