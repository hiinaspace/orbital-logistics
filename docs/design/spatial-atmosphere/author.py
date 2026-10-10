"""Offline northern atmospheric launch: real zspin, latitude and six-state capture."""

import copy
import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import root

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
d = json.loads((REPO / "fixtures/model-sets/aster-launch.json").read_text())
A, G, RECOVERY = d["atmosphere"], d["guidance"], d["recovery"]
SPIN = np.array(A["spin"])


def aero(z, area, ld):
    p, v = z[:3], z[3:6]
    r = np.linalg.norm(p)
    alt = r - 1
    normal = p / r
    relative = v - np.cross(SPIN, p)
    speed = np.linalg.norm(relative)
    density = A["density"] * np.exp(-max(0, alt) / A["scaleHeight"])
    f = np.clip((A["topHeight"] - alt) / (A["topHeight"] - A["fadeHeight"]), 0, 1)
    density *= f * f * (3 - 2 * f)
    q = 0.5 * density * speed**2
    drag = -0.5 * density * area * speed * relative
    flow = relative / speed if speed > 1e-12 else np.zeros(3)
    crossflow = normal - flow * np.dot(normal, flow)
    h = np.clip(alt / 0.04, 0, 1)
    lift = (
        q
        * area
        * ld
        * h
        * h
        * (3 - 2 * h)
        * crossflow
        / np.sqrt(np.dot(crossflow, crossflow) + 1e-8)
    )
    return drag, lift, q, relative, normal, alt


def rhs(z, nonfuel, force, direction, area=0.015, ld=0):
    drag, lift, *_ = aero(z, area, ld)
    return np.r_[
        z[3:6],
        -z[:3] / np.linalg.norm(z[:3]) ** 3 + (drag + lift + force * direction) / (nonfuel + z[6]),
        -force / 3,
    ]


def coast(z, start, duration, nonfuel, area=0.015, tight=False):
    if duration < 1e-14:
        return z.copy(), float(np.linalg.norm(z[:3]))
    sol = solve_ivp(
        lambda t, s: rhs(s, nonfuel, 0, np.zeros(3), area),
        (start, start + duration),
        z,
        method="DOP853",
        rtol=2e-12 if tight else 2e-8,
        atol=2e-13 if tight else 2e-10,
        max_step=0.02,
    )
    return sol.y[:, -1], float(np.min(np.linalg.norm(sol.y[:3], axis=0)))


def entry(z, start, nonfuel, maximum, cap=3, duration=8):
    def rate(t, s):
        drag, lift, _, relative, normal, alt = aero(s, 2, 0.25)
        gravity = -s[:3] / np.linalg.norm(s[:3]) ** 3
        u = np.clip((G["startHeight"] - alt) / (G["startHeight"] - G["fullHeight"]), 0, 1)
        engagement = u * u * (3 - 2 * u)
        target = -np.sqrt(
            G["descentSpeed"] ** 2 + 2 * G["descentGain"] * max(0, alt - RECOVERY["height"])
        )
        force = (
            (nonfuel + s[6])
            * engagement
            * (
                -gravity
                - (drag + lift) / (nonfuel + s[6])
                + G["velocityGain"] * (target * normal - relative)
            )
        )
        length = np.linalg.norm(force)
        maximum_now = min(maximum, cap * (nonfuel + s[6]))
        if length > maximum_now:
            force *= maximum_now / length
        return np.r_[
            s[3:6], gravity + (drag + lift + force) / (nonfuel + s[6]), -np.linalg.norm(force) / 3
        ]

    def contact(t, s):
        return np.linalg.norm(s[:3]) - 1 - RECOVERY["height"]

    setattr(contact, "terminal", True)
    setattr(contact, "direction", -1)
    sol = solve_ivp(
        rate,
        (start, start + duration),
        z,
        method="DOP853",
        rtol=2e-12,
        atol=2e-13,
        max_step=0.002,
        events=contact,
    )
    y = sol.y[:, -1]
    speed = np.linalg.norm(aero(y, 2, 0.25)[3])
    return {
        "t": float(sol.t[-1]),
        "state": y.tolist(),
        "speed": float(speed),
        "contact": bool(len(sol.t_events[0])),
    }


def vecs(x):
    return np.array(
        [
            [math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)]
            for az, el in np.array(x).reshape(-1, 2)
        ]
    )


def angles(vectors):
    return np.array([[math.atan2(v[1], v[0]), math.asin(v[2])] for v in vectors]).ravel()


def integrate(z, arc, nonfuel, maximum, tight=False):
    y = z.copy()
    keys = arc["steering"]["keys"]
    for lo, hi in zip(keys, keys[1:]):
        a, b = np.array(lo["direction"]), np.array(hi["direction"])
        theta = math.acos(np.clip(np.dot(a, b), -1, 1))
        start, end = arc["start"] + lo["offset"], arc["start"] + hi["offset"]

        def rate(t, s, a=a, b=b, theta=theta, start=start, end=end):
            u = np.clip((t - start) / (end - start), 0, 1)
            u = u * u * (3 - 2 * u)
            direction = (
                (1 - u) * a + u * b
                if theta < 1e-8
                else (math.sin((1 - u) * theta) * a + math.sin(u * theta) * b) / math.sin(theta)
            )
            force = min(maximum, 3 * (nonfuel + s[6]))
            return rhs(s, nonfuel, force, direction)

        sol = solve_ivp(
            rate,
            (start, end),
            y,
            method="DOP853",
            rtol=2e-12 if tight else 2e-9,
            atol=2e-13 if tight else 2e-11,
            max_step=(end - start) / 8,
        )
        y = sol.y[:, -1]
    return y


lat = math.radians(26)
pad = d["world"]["logistics"]["ports"][0]["rail"]
station = d["world"]["logistics"]["ports"][1]["rail"]
launch = d["programs"]["stack"]["thrustArcs"][0]["start"]
longitude = pad["phase"] + pad["rate"] * launch
rad = np.array([math.cos(longitude), math.sin(longitude), 0])
east = np.array([-math.sin(longitude), math.cos(longitude), 0])
new_rad = math.cos(lat) * rad + np.array([0, 0, math.sin(lat)])
normal = np.cross(new_rad, east)
rotation = np.outer(new_rad, rad) + np.outer(east, east) + np.outer(normal, [0, 0, 1])
for program in d["programs"].values():
    for arc in program["thrustArcs"]:
        arc["direction"] = (rotation @ np.array(arc["direction"])).tolist()
        for key in arc["steering"]["keys"]:
            key["direction"] = (rotation @ np.array(key["direction"])).tolist()
for key in ["u", "v"]:
    station[key] = (rotation @ np.array(station[key])).tolist()
pad["latitude"] = lat
d["world"]["logistics"]["modelVersion"] = "surface-ports-v5"
d["modelVersion"] = "atmospheric-mission-v2"
d["id"] = "aster-northern-launch"
d["world"]["id"] = d["id"]
d["name"] = "Aster · Northern launch & station visit"
d["description"] = (
    "Kestrel launches Wren from Northhaven to an inclined Lantern orbit. Both return to the ocean."
)
d["provenance"] = (
    "Fictional spherical planet, 26° northern pad, real axial air rotation. "
    "Prepared full 3D bounded-thrust stages, paid freight capture and ocean recovery."
)
for port in d["world"]["logistics"]["ports"]:
    if port["id"] == "Cairn":
        port["id"] = "Northhaven"
for station_meta in d["stations"]:
    if station_meta["id"] == "Cairn":
        station_meta["id"] = "Northhaven"
for program in d["programs"].values():
    for op in program.get("operations", []):
        if op["portId"] == "Cairn":
            op["portId"] = "Northhaven"
d["world"]["logistics"]["objective"]["returnPortId"] = "Northhaven"
initial = np.r_[
    pad["radius"] * new_rad,
    pad["rate"] * pad["radius"] * math.cos(lat) * east,
    d["booster"]["propellant"],
]
boost = d["programs"]["stack"]["thrustArcs"][0]
split = integrate(initial, boost, 1.0, 5, True)
upper_initial = split.copy()
upper_initial[6] = d["payload"]["propellant"]
insertion = d["programs"]["payload"]["thrustArcs"][0]
arrival = d["programs"]["payload"]["operations"][0]["t"]


def rail(t):
    a = station["phase"] + station["rate"] * t
    u, v = np.array(station["u"]), np.array(station["v"])
    return np.r_[
        station["radius"] * (u * math.cos(a) + v * math.sin(a)),
        station["radius"] * station["rate"] * (-u * math.sin(a) + v * math.cos(a)),
    ]


original = np.r_[
    angles([k["direction"] for k in insertion["steering"]["keys"]]),
    insertion["end"] - insertion["start"],
    arrival - insertion["end"],
]


def chosen(x):
    a = copy.deepcopy(insertion)
    a["end"] = a["start"] + x[-2]
    for i, key in enumerate(a["steering"]["keys"]):
        key["offset"] = (a["end"] - a["start"]) * i / 4
    for key, v in zip(a["steering"]["keys"], vecs(x[:-2])):
        key["direction"] = v.tolist()
    a["direction"] = a["steering"]["keys"][0]["direction"]
    return a


def terminal(x, tight=False):
    arc = chosen(x)
    z = integrate(upper_initial, arc, 0.35, 1.8, tight)
    return coast(z, arc["end"], x[-1], 0.35, tight=tight)[0]


# The exhibit authors its station from the independent circular insertion.
# Freeze that rail before production/oracle validation; never fit production data.
radius = station["radius"]
selected = [0, 8, 10]


def circular(v, tight=False):
    x = original.copy()
    x[selected] = v
    z = terminal(x, tight)
    r = np.linalg.norm(z[:3])
    return np.array(
        [
            r - radius,
            np.dot(z[:3], z[3:6]) / r,
            np.linalg.norm(np.cross(z[:3], z[3:6])) / r - 1 / math.sqrt(radius),
        ]
    )


fit = root(lambda v: circular(v, True), original[selected], tol=1e-10, options={"eps": 1e-7})
print("circular", fit.message, circular(fit.x, True), flush=True)
x = original.copy()
x[selected] = fit.x
assert max(abs(circular(fit.x, True))) < 1e-9
assert 0.2 < x[-2] < 0.5 and 0.02 < x[-1] < 0.7
upper = terminal(x, True)
arrival = insertion["start"] + x[-2] + x[-1]
u = upper[:3] / radius
v = upper[3:6] / np.linalg.norm(upper[3:6])
station["u"] = u.tolist()
station["v"] = v.tolist()
station["phase"] = -station["rate"] * arrival
error = upper[:6] - rail(arrival)
print("capture", error, "fuel", upper[6], flush=True)
assert max(abs(error)) < 1e-9
d["programs"]["payload"]["thrustArcs"][0] = chosen(x)
booster = integrate(split, d["programs"]["booster"]["thrustArcs"][0], 0.3, 5, True)
booster_recovery = entry(booster, d["entryStarts"]["booster"], 0.3, 5)
departure = arrival + 2.5
ops = d["programs"]["payload"]["operations"]
ops[0]["t"] = arrival
ops[1]["t"] = arrival
ops[2]["t"] = departure
deorbit = d["programs"]["payload"]["thrustArcs"][1]
duration = deorbit["end"] - deorbit["start"]
deorbit["start"] = departure
deorbit["end"] = departure + duration
direction = -rail(departure)[3:]
direction /= np.linalg.norm(direction)
deorbit["direction"] = direction.tolist()
for i, key in enumerate(deorbit["steering"]["keys"]):
    key["offset"] = (deorbit["end"] - deorbit["start"]) * i
    key["direction"] = direction.tolist()
d["entryStarts"]["payload"] = deorbit["end"]
return_initial = np.r_[rail(departure), upper[6]]
return_state = integrate(return_initial, d["programs"]["payload"]["thrustArcs"][1], 0.25, 1.8, True)
payload_recovery = entry(return_state, d["entryStarts"]["payload"], 0.25, 1.8)
print("recoveries", booster_recovery, payload_recovery, flush=True)
assert all(
    r["contact"] and r["speed"] < 0.06 and r["state"][6] > 0.001
    for r in [booster_recovery, payload_recovery]
)
(REPO / "fixtures/model-sets/aster-northern-launch.json").write_text(json.dumps(d, indent=2) + "\n")
(HERE / "authoring.json").write_text(
    json.dumps(
        {
            "latitude": lat,
            "rotation": rotation.tolist(),
            "captureError": error.tolist(),
            "captureFuel": upper[6],
            "boosterRecovery": booster_recovery,
            "payloadRecovery": payload_recovery,
        },
        indent=2,
    )
    + "\n"
)
