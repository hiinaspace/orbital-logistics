"""Independent primary-field cached shuttle occurrence replay using DOP853."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / "docs/evidence/shuttle-service-input.json").read_text())


def body_position(body, t):
    r = body["rail"]
    if r["kind"] == "fixed":
        return np.array(r["position"])
    angle = r["phase"] + r["rate"] * t
    return np.array(r["center"]) + r["radius"] * (
        np.array(r["u"]) * math.cos(angle) + np.array(r["v"]) * math.sin(angle)
    )


def integrate(y, begin, end, arcs, bodies, engine, tight=True, dry=1.05):
    cuts = sorted(
        {
            begin,
            end,
            *[
                x
                for a in arcs
                for x in (
                    a["start"],
                    a["end"],
                    *[a["start"] + k["offset"] for k in a.get("steering", {}).get("keys", [])],
                )
                if begin < x < end
            ],
        }
    )
    pieces = []
    for lo, hi in zip(cuts, cuts[1:], strict=False):
        arc = next((a for a in arcs if a["start"] <= lo and a["end"] >= hi), None)

        def rhs(t, state):
            accel = np.zeros(3)
            for body in bodies:
                delta = body_position(body, t) - state[:3]
                accel += body["mu"] * delta / np.linalg.norm(delta) ** 3
            wet = dry + state[6]
            force = (
                min(engine["maxThrust"] * arc["throttle"], engine["maxAcceleration"] * wet)
                if arc
                else 0.0
            )
            direction = direction_at(arc, t) if arc else np.zeros(3)
            return np.r_[state[3:6], accel + force / wet * direction, -force / 3]

        sol = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            dense_output=True,
            rtol=2e-12 if tight else 2e-10,
            atol=2e-13 if tight else 2e-11,
            max_step=min(0.03, (hi - lo) / 4),
        )
        assert sol.success
        pieces.append((lo, hi, sol.sol))
        y = sol.y[:, -1]
    return pieces


def at(pieces, t):
    for lo, hi, dense in pieces:
        if lo - 1e-10 <= t <= hi + 1e-10:
            return dense(t)
    raise ValueError(t)


results = []
for entry in data["legs"]:
    b = entry["bundle"]
    s = b["scenario"]
    # The negative support prelude holds the pad analytically; free flight
    # begins at local zero, rather than falling under gravity from that prelude.
    source = next(
        p for p in s["logistics"]["ports"] if p["id"] != b["program"]["operations"][-1]["portId"]
    )
    rail = source["rail"]
    angle, rate, radius = rail["phase"], rail["rate"], rail["radius"]
    u, v = np.array(rail["u"]), np.array(rail["v"])
    position = np.array(rail["center"]) + radius * (math.cos(angle) * u + math.sin(angle) * v)
    velocity = radius * rate * (-math.sin(angle) * u + math.cos(angle) * v)
    initial = np.r_[position, velocity, s["ship"]["propellant"]]
    begin, end = 0.0, entry["end"]
    pieces = integrate(
        initial,
        begin,
        end,
        b["program"]["thrustArcs"],
        s["bodies"],
        s["ship"]["engine"],
        dry=s["ship"]["dryMass"] + s["ship"]["cargoMass"],
    )
    coarse = integrate(
        initial,
        begin,
        end,
        b["program"]["thrustArcs"],
        s["bodies"],
        s["ship"]["engine"],
        False,
        dry=s["ship"]["dryMass"] + s["ship"]["cargoMass"],
    )
    errors = np.zeros(4)
    for sample in entry["samples"]:
        truth = at(pieces, sample["t"])
        delta = np.array(sample["y"]) - truth[:6]
        errors = np.maximum(
            errors,
            [
                np.linalg.norm(delta[:3]),
                np.linalg.norm(delta[3:]),
                abs(truth[6] - sample["propellant"]),
                np.linalg.norm(truth - at(coarse, sample["t"])),
            ],
        )
    minimum = min(float(np.linalg.norm(at(pieces, t)[:3])) for t in np.linspace(begin, end, 4097))
    print("leg numerical errors", begin, errors, flush=True)
    assert max(errors[:2]) < 1e-8 and errors[2] < 1e-10 and errors[3] < 1e-8
    assert minimum >= 1.0000009
    target = np.array(entry["capture"]["y"])
    terminal = at(pieces, end)
    assert np.linalg.norm(terminal[:6] - target) < 2e-8
    results.append(
        dict(
            departure=entry["departure"],
            epoch=begin,
            end=end,
            position=errors[0],
            velocity=errors[1],
            fuel=errors[2],
            oracleRefinement=errors[3],
            minimumRadius=minimum,
            targetError=float(np.linalg.norm(terminal[:6] - target)),
        )
    )

report = dict(legs=results)
(ROOT / "docs/evidence/shuttle-service-oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
