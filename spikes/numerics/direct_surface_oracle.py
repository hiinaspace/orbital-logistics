"""Independent full-field flight and loaded-station replay using DOP853."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / "docs/evidence/direct-surface-input.json").read_text())


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
    initial = np.r_[s["ship"]["state"], s["ship"]["propellant"]]
    begin, end = s["epoch"], entry["end"]
    pieces = integrate(
        initial, begin, end, b["program"]["thrustArcs"], s["bodies"], s["ship"]["engine"]
    )
    coarse = integrate(
        initial, begin, end, b["program"]["thrustArcs"], s["bodies"], s["ship"]["engine"], False
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

service = data["definition"]["service"]
relay = service["relay"]["ship"]
arcs = [a for c in data["station"] for a in c["arcs"]]
y = np.r_[relay["state"], relay["propellant"]]
epoch, visitor = 0.0, None
station_pieces = []
for event in [*data["ownership"], None]:
    until = event["t"] if event else data["station"][-1]["end"]
    dry = 4 + (1.05 + visitor if visitor is not None else 0)
    pieces = integrate(
        y, epoch, until, arcs, service["world"]["scenario"]["bodies"], relay["engine"], dry=dry
    )
    y = at(pieces, until).copy()
    station_pieces.extend(pieces)
    epoch = until
    if event is None:
        break
    if event["kind"] == "capture":
        visitor = event["fuel"]
    elif event["kind"] == "transfer":
        visitor -= event["amount"]
        y[6] += event["amount"]
    else:
        visitor = None
error = np.zeros(3)
for c in data["station"]:
    for s in c["station"]:
        if any(abs(s["t"] - e["t"]) < 1e-10 for e in data["ownership"]):
            continue
        truth = at(station_pieces, s["t"])
        delta = np.array(s["y"]) - truth[:6]
        error = np.maximum(
            error,
            [np.linalg.norm(delta[:3]), np.linalg.norm(delta[3:]), abs(s["propellant"] - truth[6])],
        )
assert max(error[:2]) < 1e-8 and error[2] < 1e-10
report = dict(legs=results, station=dict(position=error[0], velocity=error[1], fuel=error[2]))
(ROOT / "docs/evidence/direct-surface-oracle.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
