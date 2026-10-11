"""Independent DOP853 full-field replay from frozen controls and initial state."""

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

p = Path("docs/evidence/apollo.json")
report = json.loads(p.read_text())
d = report["definition"]
s = d["scenario"]
ship = s["ship"]
body = s["bodies"][1]
rail = body["rail"]
a = d["entry"]["atmosphere"]
c = d["entry"]["aero"]
g = d["entry"]["guidance"]
rec = d["entry"]["recovery"]
engine = ship["engine"]
cycle = int(sys.argv[1]) if len(sys.argv) > 1 else 0
loose = "--loose" in sys.argv
relative_tolerance = 2e-12 if loose else 3e-14
absolute_tolerance = 2e-13 if loose else 3e-15
assert 0 <= cycle <= 10000
period = 2 * math.pi / (rail["rate"] - d["ports"][0]["rail"]["rate"])
shift = cycle * period
angle = cycle * d["ports"][0]["rail"]["rate"] * period


def rotate(vector):
    co, si = math.cos(angle), math.sin(angle)
    return [co * vector[0] - si * vector[1], si * vector[0] + co * vector[1], vector[2]]


if cycle:
    for key in ["launch", "ascentEnd", "landing", "liftoff", "entryStart"]:
        d[key] += shift
    for arc in d["arcs"]:
        arc["start"] += shift
        arc["end"] += shift
        arc["direction"] = rotate(arc["direction"])
        for key in arc["steering"]["keys"]:
            key["direction"] = rotate(key["direction"])
    for sample in report["samples"]:
        sample["t"] += shift
        sample["y"] = rotate(sample["y"][:3]) + rotate(sample["y"][3:])
    recovery = report["recovery"]
    recovery["t"] += shift
    recovery["state"] = (
        rotate(recovery["state"][:3]) + rotate(recovery["state"][3:6]) + recovery["state"][6:]
    )


def moon(t):
    phase = rail["phase"] + rail["rate"] * t
    return np.array(
        [
            rail["radius"] * math.cos(phase),
            rail["radius"] * math.sin(phase),
            -rail["radius"] * rail["rate"] * math.sin(phase),
            rail["radius"] * rail["rate"] * math.cos(phase),
        ]
    )


def pad(t, which):
    port = d["ports"][which]
    r = port["rail"]
    angle = r["phase"] + r["rate"] * t
    p = r["radius"] * np.array([math.cos(angle), math.sin(angle)])
    return np.r_[p, r["rate"] * np.array([-p[1], p[0]])] + (moon(t) if which else np.zeros(4))


def aero(z, area, ld):
    pos, vel = z[:2], z[2:4]
    radius = np.linalg.norm(pos)
    normal = pos / radius
    alt = radius - 1
    rel = vel - a["spin"][2] * np.array([-pos[1], pos[0]])
    speed = np.linalg.norm(rel)
    u = np.clip((a["topHeight"] - alt) / (a["topHeight"] - a["fadeHeight"]), 0, 1)
    density = a["density"] * math.exp(-max(0, alt) / a["scaleHeight"]) * u * u * (3 - 2 * u)
    q = 0.5 * density * speed**2
    drag = -0.5 * density * area * speed * rel
    flow = rel / speed if speed else np.zeros(2)
    projected = normal - flow * np.dot(normal, flow)
    u = np.clip(alt / c["liftFadeHeight"], 0, 1)
    lift = (
        q
        * area
        * ld
        * u
        * u
        * (3 - 2 * u)
        * projected
        / math.sqrt(np.dot(projected, projected) + 1e-8)
    )
    return drag, lift, rel, normal, alt


def gravity(t, z):
    q = moon(t)[:2] - z[:2]
    return -z[:2] / np.linalg.norm(z[:2]) ** 3 + body["mu"] * q / np.linalg.norm(q) ** 3


def direction(arc, t):
    keys = arc["steering"]["keys"]
    u = t - arc["start"]
    i = next((i for i in range(len(keys) - 1) if u <= keys[i + 1]["offset"]), len(keys) - 2)
    k0, k1 = keys[i : i + 2]
    f = np.clip((u - k0["offset"]) / (k1["offset"] - k0["offset"]), 0, 1)
    f = f * f * (3 - 2 * f)
    p0 = np.array(k0["direction"][:2])
    p1 = np.array(k1["direction"][:2])
    angle = math.atan2(p0[0] * p1[1] - p0[1] * p1[0], np.dot(p0, p1)) * f
    return np.array(
        [
            p0[0] * math.cos(angle) - p0[1] * math.sin(angle),
            p0[0] * math.sin(angle) + p0[1] * math.cos(angle),
        ]
    )


def rate(t, z, arc=None, entry=False):
    mass = ship["dryMass"] + z[4]
    force = np.zeros(2)
    drag, lift, rel, normal, alt = aero(
        z, c["dragArea"] if entry else 0.015, c["liftToDrag"] if entry else 0
    )
    grav = gravity(t, z)
    if entry:
        u = np.clip((g["startHeight"] - alt) / (g["startHeight"] - g["fullHeight"]), 0, 1)
        engage = u * u * (3 - 2 * u)
        speed = -math.sqrt(
            g["descentSpeed"] ** 2 + 2 * g["descentGain"] * max(0, alt - rec["height"])
        )
        force = (
            mass
            * engage
            * (-grav - (drag + lift) / mass + g["velocityGain"] * (speed * normal - rel))
        )
        maximum = min(engine["maxThrust"], engine["maxAcceleration"] * mass)
        length = np.linalg.norm(force)
        if length > maximum:
            force *= maximum / length
    elif arc:
        force = min(
            engine["maxThrust"] * arc["throttle"], engine["maxAcceleration"] * mass
        ) * direction(arc, t)
    return np.r_[
        z[2:4],
        grav + (drag + lift + force) / mass,
        -np.linalg.norm(force) / ship["exhaustVelocity"],
    ]


def compact(z):
    return np.array([z[0], z[1], z[3], z[4], z[6]])


t = d["launch"]
z = np.r_[pad(t, 0), ship["propellant"]]
errors = []
minimum = 1e9
minimum_air = 1e9
samples = report["samples"]
cuts = {d["ascentEnd"], d["landing"], d["liftoff"], d["entryStart"]}
cuts.update(x["t"] for x in samples if d["launch"] < x["t"] < d["entryStart"])
for arc in d["arcs"]:
    cuts.update([arc["start"], arc["end"]])
    cuts.update(arc["start"] + k["offset"] for k in arc["steering"]["keys"])
cuts = sorted(cuts)

for end in cuts:
    if end <= t:
        continue
    if d["landing"] <= t < d["liftoff"]:
        z = np.r_[pad(end, 1), z[4]]
    else:
        arc = next((arc for arc in d["arcs"] if arc["start"] <= (t + end) / 2 < arc["end"]), None)
        sol = solve_ivp(
            lambda at, y: rate(at, y, arc),
            (t, end),
            z,
            method="DOP853",
            rtol=relative_tolerance,
            atol=absolute_tolerance,
            max_step=min(0.02, end - t),
            dense_output=True,
        )
        assert sol.success, sol.message
        # Dense independent clearance observations complement the production interval certificate.
        for at in np.linspace(t, end, 65):
            y = sol.sol(at)
            mp = moon(at)[:2]
            minimum = min(
                minimum, np.linalg.norm(y[:2]) - 1, np.linalg.norm(y[:2] - mp) - body["radius"]
            )
            if t >= d["ascentEnd"]:
                minimum_air = min(minimum_air, np.linalg.norm(y[:2]) - 1 - a["topHeight"])
        z = sol.y[:, -1]
    if end == d["landing"]:
        target = pad(end, 1)
        dv = np.linalg.norm(z[2:4] - target[2:4])
        miss = np.linalg.norm(z[:2] - target[:2])
        assert miss < 2e-6 and dv < 2e-6, (miss, dv)
        fuel = (ship["dryMass"] + z[4]) * (-math.expm1(-dv / ship["exhaustVelocity"]))
        capture = dict(
            positionError=float(miss), velocityCorrection=float(dv), fuelCost=float(fuel)
        )
        z = np.r_[target, z[4] - fuel]
    t = end
    for sample in samples:
        if sample["t"] == t:
            actual = compact([*sample["y"], sample["propellant"]])
            errors.append(float(np.max(np.abs(actual - z))))


def contact(at, y):
    return np.linalg.norm(y[:2]) - 1 - rec["height"]


setattr(contact, "terminal", True)
setattr(contact, "direction", -1)
sol = solve_ivp(
    lambda at, y: rate(at, y, entry=True),
    (t, t + 8),
    z,
    method="DOP853",
    rtol=relative_tolerance,
    atol=absolute_tolerance,
    max_step=0.002,
    events=contact,
)
assert sol.success, sol.message
assert len(sol.t_events[0]) == 1
end = float(sol.t[-1])
last = sol.y[:, -1]
recovery_error = float(np.max(np.abs(last - compact(report["recovery"]["state"]))))
result = dict(
    capture=capture,
    recoveryRelativeSpeed=float(np.linalg.norm(aero(last, c["dragArea"], c["liftToDrag"])[2])),
    maxReplayError=max(errors),
    clearance=float(minimum),
    vacuumAtmosphereClearance=float(minimum_air),
    recoveryEpochError=abs(end - report["recovery"]["t"]),
    recoveryStateError=recovery_error,
    remainingFuel=float(last[4]),
)

result["relativeTolerance"] = relative_tolerance
result["absoluteTolerance"] = absolute_tolerance
result["passed"] = bool(
    max(errors) < 1e-3
    and abs(end - report["recovery"]["t"]) < 1e-3
    and recovery_error < 1e-3
    and minimum > 0
    and minimum_air > 0
    and np.linalg.norm(aero(last, c["dragArea"], c["liftToDrag"])[2]) < rec["maxSpeed"]
)
suffix = "-loose" if loose else ""
output = (
    f"docs/evidence/apollo-oracle-cycle-{cycle}{suffix}.json"
    if cycle or loose
    else "docs/evidence/apollo-oracle.json"
)
Path(output).write_text(json.dumps(result, indent=2) + "\n")
print(result)
assert result["passed"], result
