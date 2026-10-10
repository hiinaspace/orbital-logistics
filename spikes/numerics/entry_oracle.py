"""Independent point-mass entry, feedback propulsion and water recovery oracle.
No production helpers or propagated restart states are used.
"""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

source = json.loads(Path("docs/evidence/entry-oracle-input.json").read_text())
d = source["definition"]
s = d["scenario"]
body = s["bodies"][0]
a = d["atmosphere"]
c = d["aero"]
g = d["guidance"]
r = d["recovery"]
center = np.array(body["rail"]["position"])
spin = np.array(a["spin"])
nonfuel = s["ship"]["dryMass"] + s["ship"]["cargoMass"]


def forces(z):
    p = z[:3] - center
    radius = np.linalg.norm(p)
    normal = p / radius
    alt = radius - body["radius"]
    mass = nonfuel + z[6]
    relative = z[3:6] - np.cross(spin, p)
    speed = np.linalg.norm(relative)
    density = a["density"] * np.exp(-max(0, alt) / a["scaleHeight"])
    u = np.clip((a["topHeight"] - alt) / (a["topHeight"] - a["fadeHeight"]), 0, 1)
    density *= u * u * (3 - 2 * u)
    q = 0.5 * density * speed**2
    drag = -0.5 * density * c["dragArea"] * speed * relative
    direction = relative / speed if speed > 1e-12 else np.zeros(3)
    perpendicular = normal - direction * np.dot(normal, direction)
    h = np.clip(alt / c["liftFadeHeight"], 0, 1)
    lift = (
        q
        * c["dragArea"]
        * c["liftToDrag"]
        * h
        * h
        * (3 - 2 * h)
        * perpendicular
        / np.sqrt(np.dot(perpendicular, perpendicular) + 1e-8)
    )
    gravity = -body["mu"] * p / radius**3
    engagement = np.clip((g["startHeight"] - alt) / (g["startHeight"] - g["fullHeight"]), 0, 1)
    engagement = engagement**2 * (3 - 2 * engagement)
    target = -np.sqrt(g["descentSpeed"] ** 2 + 2 * g["descentGain"] * max(0, alt - r["height"]))
    thrust = (
        mass
        * engagement
        * (-gravity - (drag + lift) / mass + g["velocityGain"] * (target * normal - relative))
    )
    maximum = min(s["ship"]["engine"]["maxThrust"], s["ship"]["engine"]["maxAcceleration"] * mass)
    force = np.linalg.norm(thrust)
    if force > maximum:
        thrust *= maximum / force
    return gravity, drag, lift, thrust, q, np.sqrt(density) * speed**3, relative


def derivative(t, z):
    gravity, drag, lift, thrust, *_ = forces(z)
    return np.r_[
        z[3:6],
        gravity + (drag + lift + thrust) / (nonfuel + z[6]),
        -np.linalg.norm(thrust) / s["ship"]["exhaustVelocity"],
    ]


def recovery(t, z):
    return np.linalg.norm(z[:3] - center) - (body["radius"] + r["height"])


setattr(recovery, "terminal", True)
setattr(recovery, "direction", -1)
initial = np.r_[s["ship"]["state"], s["ship"]["propellant"]]


def solve(rtol, atol, max_step):
    return solve_ivp(
        derivative,
        [0, s["duration"]],
        initial,
        method="DOP853",
        rtol=rtol,
        atol=atol,
        max_step=max_step,
        events=recovery,
        dense_output=True,
    )


regular = solve(1e-11, 1e-13, 0.005)
tight = solve(1e-13, 1e-15, 0.001)
assert len(tight.t_events[0]) == 1 and len(regular.t_events[0]) == 1
epoch = tight.t[-1]
final = tight.y[:, -1]
oracle_gap = np.max(
    np.abs(
        regular.sol(np.linspace(0, min(epoch, regular.t[-1]), 2001))
        - tight.sol(np.linspace(0, min(epoch, regular.t[-1]), 2001))
    )
)
assert oracle_gap < 1e-9, oracle_gap
peak = {"pressure": 0.0, "acceleration": 0.0, "heat": 0.0, "force": 0.0}
drag_power = 0.0
lift_power = 0.0
for z in tight.sol(np.linspace(0, epoch, 10001)).T:
    _, drag, lift, thrust, q, heat, relative = forces(z)
    peak["pressure"] = max(peak["pressure"], float(q))
    peak["heat"] = max(peak["heat"], float(heat))
    peak["force"] = max(peak["force"], float(np.linalg.norm(thrust)))
    peak["acceleration"] = max(
        peak["acceleration"], float(np.linalg.norm(drag + lift + thrust) / (nonfuel + z[6]))
    )
    drag_power = max(drag_power, float(np.dot(drag, relative)))
    lift_power = max(lift_power, abs(float(np.dot(lift, relative))))
assert drag_power <= 1e-13 and lift_power < 1e-12
rows = []
for case in source["cases"]:
    actual = np.array([x["z"] for x in case["samples"]]).T
    times = np.array([x["t"] for x in case["samples"]])
    expected = tight.sol(times)
    error = float(np.max(np.abs(actual - expected)))
    event = abs(case["contact"]["t"] - epoch)
    assert error < source["tolerances"]["state"], (case["step"], error)
    if case["step"] == 1 / 2048:
        assert error < source["tolerances"]["fineState"]
    assert event < source["tolerances"]["event"]
    for key in peak:
        assert abs(case["maxima"][key] - peak[key]) < source["tolerances"]["peak"], (
            key,
            case["maxima"][key],
            peak[key],
        )
    rows.append(
        {
            "step": case["step"],
            "maxStateError": error,
            "eventError": event,
            "fuelError": abs(case["contact"]["before"][6] - final[6]),
            "nodes": case["nodes"],
            "elapsedMs": case["elapsedMs"],
        }
    )
_, _, _, _, _, _, relative = forces(final)
mass = nonfuel + final[6]
report = {
    "schemaVersion": 1,
    "oracle": "independent DOP853",
    "oracleTighteningMaxStateDifference": float(oracle_gap),
    "contactEpoch": float(epoch),
    "impactSpeed": float(np.linalg.norm(relative)),
    "fuelRemaining": float(final[6]),
    "waterEnergy": float(0.5 * mass * np.dot(relative, relative)),
    "impulse": (-mass * relative).tolist(),
    "peak": peak,
    "maxDragPower": drag_power,
    "maxAbsoluteLiftPower": lift_power,
    "cases": rows,
}
Path("docs/evidence/entry-oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
