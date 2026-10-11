"""Independent DOP853 replay of the complete staged graph, with no TS restart states."""

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp

report = json.loads(Path("docs/evidence/staged-apollo.json").read_text())
d = report["definition"]
s = d["world"]
body = s["bodies"][1]
rail = body["rail"]
a = d["entry"]["atmosphere"]
c = d["entry"]["aero"]
g = d["entry"]["guidance"]
rec = d["entry"]["recovery"]
cycle = int(sys.argv[1]) if len(sys.argv) > 1 else 0
period = 2 * math.pi / (rail["rate"] - d["ports"][0]["rail"]["rate"])
shift = cycle * period
angle = cycle * d["ports"][0]["rail"]["rate"] * period


def rotate(v):
    co, si = math.cos(angle), math.sin(angle)
    return [co * v[0] - si * v[1], si * v[0] + co * v[1], v[2]]


# Integrate with a small local numerical clock, while the field and supports
# retain their phases at the actual absolute calendar epoch. At cycle9000,
# absolute-time stage/subtraction roundoff exceeds DOP853's requested tolerance.
rail["phase"] += rail["rate"] * shift
for port in d["ports"]:
    port["rail"]["phase"] += port["rail"]["rate"] * shift
for arc in sum(d["programs"].values(), []):
    arc["direction"] = rotate(arc["direction"])
    for key in arc["steering"]["keys"]:
        key["direction"] = rotate(key["direction"])
for rows in report["samples"].values():
    for q in rows:
        q["y"] = rotate(q["y"][:3]) + rotate(q["y"][3:])
for r in report["recovery"].values():
    r["state"] = rotate(r["state"][:3]) + rotate(r["state"][3:6]) + r["state"][6:]
ship = {}
engine = {}
current_area = 0


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
        z, c["dragArea"] if entry else current_area, c["liftToDrag"] if entry else 0
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


errors = []
clearance = 1e9
air_clearance = 1e9
capture_reports = {}


def set_hardware(part, attached=0, area=0):
    global ship, engine, current_area
    ship = dict(d["hardware"][part])
    ship["dryMass"] += attached
    engine = ship["engine"]
    current_area = area


def check_sample(part, t, z, left=False):
    candidates = [q for q in report["samples"][part] if abs(q["t"] - t) < 1e-12]
    if candidates:
        q = candidates[0]
        errors.append(float(np.max(np.abs(compact([*q["y"], q["propellant"]]) - z))))


def integrate(part, z, start, end, arcs, air=False, check_end=True):
    global clearance, air_clearance
    cuts = {start, end}
    for arc in arcs:
        cuts.update([arc["start"], arc["end"]])
        cuts.update(arc["start"] + key["offset"] for key in arc["steering"]["keys"])
    cuts.update(q["t"] for q in report["samples"][part] if start < q["t"] < end)
    cuts = sorted(t for t in cuts if start <= t <= end)
    t = start
    for stop in cuts[1:]:
        arc = next((b for b in arcs if b["start"] <= (t + stop) / 2 < b["end"]), None)
        # Launch error amplifies through the complete lunar/return graph. Independent
        # DOP853 precision was checked against canonical h/h2/h4; see oracle-accuracy.md.
        sol = solve_ivp(
            lambda at, y: rate(at, y, arc),
            (t, stop),
            z,
            method="DOP853",
            rtol=3e-14,
            atol=3e-15,
            max_step=min(0.0005 if air else 0.001 if arc else 0.02, stop - t),
            dense_output=True,
        )
        assert sol.success, sol.message
        for at in np.linspace(t, stop, 17):
            y = sol.sol(at)
            height = float(np.linalg.norm(y[:2]) - 1)
            clearance = min(
                clearance, height, float(np.linalg.norm(y[:2] - moon(at)[:2]) - body["radius"])
            )
            if not air:
                air_clearance = min(air_clearance, height - a["topHeight"])
        z = sol.y[:, -1]
        t = stop
        assert z[4] > 0, "depleted " + part
        if t < end or check_end:
            check_sample(part, t, z)
    return z


def capture(name, z, target):
    speed = float(np.linalg.norm(z[2:4] - target[2:4]))
    miss = float(np.linalg.norm(z[:2] - target[:2]))
    assert miss < 2e-6 and speed < 2e-6, (name, miss, speed)
    used = (ship["dryMass"] + z[4]) * -math.expm1(-speed / ship["exhaustVelocity"])
    capture_reports[name] = {"position": miss, "velocity": speed, "fuel": used}
    return np.r_[target, z[4] - used]


def recover(part, z, start):
    def contact(t, y):
        return np.linalg.norm(y[:2]) - 1 - rec["height"]

    contact_event: Any = contact
    contact_event.terminal = True
    contact_event.direction = -1
    sol = solve_ivp(
        lambda t, y: rate(t, y, entry=True),
        (start, start + 8),
        z,
        method="DOP853",
        rtol=3e-14,
        atol=3e-15,
        max_step=0.002,
        events=contact_event,
    )
    assert sol.success and len(sol.t_events[0]) == 1, (part, sol.message)
    q = report["recovery"][part]
    state_error = float(np.max(np.abs(sol.y[:, -1] - compact(q["state"]))))
    epoch_error = abs(float(sol.t[-1]) - q["t"])
    speed = float(np.linalg.norm(aero(sol.y[:, -1], c["dragArea"], c["liftToDrag"])[2]))
    assert speed < rec["maxSpeed"] and sol.y[4, -1] > 0
    return {
        "t": float(sol.t[-1]) + shift,
        "stateError": state_error,
        "epochError": epoch_error,
        "speed": speed,
        "fuel": float(sol.y[4, -1]),
    }


h = d["hardware"]
reserved = sum(h[p]["dryMass"] + h[p]["propellant"] for p in ["orbiter", "lander"])
set_hardware("booster", reserved, d["dragAreas"]["stack"])
z = np.r_[pad(d["launch"], 0), h["booster"]["propellant"]]
z = integrate("stack", z, d["launch"], d["boosterSeparation"], d["programs"]["stack"], air=True)
split = z.copy()
set_hardware("orbiter", h["lander"]["dryMass"] + h["lander"]["propellant"], d["dragAreas"]["upper"])
z = np.r_[split[:4], h["orbiter"]["propellant"]]
arcs = d["programs"]["orbiterOutbound"]
z = integrate(
    "orbiter",
    z,
    d["boosterSeparation"],
    d["ascentEnd"],
    [a for a in arcs if a["end"] <= d["ascentEnd"]],
    air=True,
)
current_area = 0
z = integrate(
    "orbiter",
    z,
    d["ascentEnd"],
    d["lunarSeparation"],
    [a for a in arcs if a["start"] >= d["ascentEnd"]],
)
lunar_split = z.copy()
set_hardware("orbiter")
orbiter = integrate("orbiter", z, d["lunarSeparation"], d["lunarDock"], [])
set_hardware("lander")
z = np.r_[lunar_split[:4], h["lander"]["propellant"]]
z = integrate(
    "lander",
    z,
    d["lunarSeparation"],
    d["landing"],
    [a for a in d["programs"]["lander"] if a["end"] <= d["landing"]],
    check_end=False,
)
z = capture("landing", z, pad(d["landing"], 1))
check_sample("lander", d["landing"], z)
z = np.r_[pad(d["liftoff"], 1), z[4]]
z = integrate(
    "lander",
    z,
    d["liftoff"],
    d["lunarDock"],
    [a for a in d["programs"]["lander"] if a["start"] >= d["liftoff"]],
    check_end=False,
)
z = capture("dock", z, orbiter[:4])
check_sample("lander", d["lunarDock"], z)
lander_final = float(z[4])
set_hardware("orbiter", h["lander"]["dryMass"] + lander_final)
z = integrate("orbiter", orbiter, d["lunarDock"], d["entryStart"], d["programs"]["orbiterReturn"])
orbiter_recovery = recover("orbiter", z, d["entryStart"])
set_hardware("booster", area=d["dragAreas"]["booster"])
z = integrate(
    "booster",
    split,
    d["boosterSeparation"],
    d["boosterEntryStart"],
    d["programs"]["booster"],
    air=True,
)
booster_recovery = recover("booster", z, d["boosterEntryStart"])
result = {
    "cycle": cycle,
    "absoluteEpoch": shift,
    "clock": "local solver clock with absolute field/support phases",
    "captures": capture_reports,
    "maxReplayError": max(errors),
    "comparisons": len(errors),
    "sampledClearance": clearance,
    "sampledVacuumAtmosphereClearance": air_clearance,
    "recoveries": {"booster": booster_recovery, "orbiter": orbiter_recovery},
    "landerFuel": lander_final,
}
result["passed"] = bool(
    max(errors) < 1e-4
    and all(
        r["stateError"] < 1e-4 and r["epochError"] < 1e-4 for r in result["recoveries"].values()
    )
    and clearance > 0
    and air_clearance > 0
)
Path(f"docs/evidence/staged-apollo-oracle-{cycle}.json").write_text(
    json.dumps(result, indent=2) + "\n"
)
print(result)
assert result["passed"], result
