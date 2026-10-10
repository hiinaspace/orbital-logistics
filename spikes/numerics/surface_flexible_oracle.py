"""Independent surface cache and coupled orbital leg replay using DOP853."""

import json
import math
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / "docs/evidence/surface-flexible-input.json").read_text())
contracts = json.loads((ROOT / "fixtures/traffic/orison-surface-contracts.json").read_text())


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
        {begin, end, *[x for a in arcs for x in (a["start"], a["end"]) if begin < x < end]}
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


surface = []
for entry in data["surface"]:
    f = entry["flight"]
    w = contracts[f["leg"]]
    angle = f["rotation"]
    c, s = math.cos(angle), math.sin(angle)
    matrix = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    initial = np.array([w["initial"][0], w["initial"][1], 0, w["initial"][2], w["initial"][3], 0])
    initial[:3] = matrix @ initial[:3]
    initial[3:] = matrix @ initial[3:]
    y = np.r_[initial, f["fuel"]]
    arcs = []
    for a in w["arcs"]:
        directions = [matrix @ np.array([math.cos(k), math.sin(k), 0]) for k in a["keys"]]
        arcs.append(
            dict(
                start=f["start"] + a["start"],
                end=f["start"] + a["start"] + a["duration"],
                throttle=1,
                direction=directions[0],
                steering=dict(
                    keys=[
                        dict(offset=a["duration"] * i / (len(directions) - 1), direction=d)
                        for i, d in enumerate(directions)
                    ]
                ),
            )
        )
    begin, end = f["start"], f["start"] + w["duration"]
    primary = data["definition"]["world"]["scenario"]["bodies"][:1]
    engine = dict(maxThrust=32, maxAcceleration=3)
    pieces = integrate(y, begin, end, arcs, primary, engine)
    full = integrate(y, begin, end, arcs, data["definition"]["world"]["scenario"]["bodies"], engine)
    errors = np.zeros(3)
    for sample in entry["samples"]:
        truth = at(pieces, sample["t"])
        delta = np.array(sample["y"]) - truth[:6]
        errors = np.maximum(
            errors,
            [
                np.linalg.norm(delta[:3]),
                np.linalg.norm(delta[3:]),
                abs(truth[6] - sample["propellant"]),
            ],
        )
    # The full-field reference is an unconstrained point trajectory solely for
    # quantifying the omitted perturbation, not a candidate landing/contact proof.
    difference = at(full, end) - at(pieces, end)
    assert max(errors[:2]) < 2e-9 and errors[2] < 1e-10
    assert np.linalg.norm(difference[:3]) < 0.001 and np.linalg.norm(difference[3:6]) < 0.001
    surface.append(
        dict(
            leg=f["leg"],
            epoch=begin,
            position=errors[0],
            velocity=errors[1],
            fuel=errors[2],
            omittedFieldPosition=float(np.linalg.norm(difference[:3])),
            omittedFieldVelocity=float(np.linalg.norm(difference[3:6])),
        )
    )

orbital = []
for entry in data["orbital"]:
    b = entry["bundle"]
    s = b["scenario"]
    y = np.r_[s["ship"]["state"], s["ship"]["propellant"]]
    pieces = integrate(
        y,
        s["epoch"],
        s["epoch"] + s["duration"],
        b["program"]["thrustArcs"],
        s["bodies"],
        s["ship"]["engine"],
    )
    coarse = integrate(
        y,
        s["epoch"],
        s["epoch"] + s["duration"],
        b["program"]["thrustArcs"],
        s["bodies"],
        s["ship"]["engine"],
        False,
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
                np.linalg.norm(at(coarse, sample["t"]) - truth),
            ],
        )
    assert max(errors[:2]) < 1e-7 and errors[2] < 1e-10 and errors[3] < 1e-8
    orbital.append(
        dict(
            epoch=s["epoch"],
            position=errors[0],
            velocity=errors[1],
            fuel=errors[2],
            oracleRefinement=errors[3],
        )
    )

station_data = data["station"]
chunks = sorted(station_data["chunks"], key=lambda c: c["start"])
arcs = [a for c in chunks for a in c["arcs"]]
events = sorted(station_data["ownership"], key=lambda e: e["t"])
relay = data["definition"]["relay"]["ship"]
y = np.r_[relay["state"], relay["propellant"]]
end = chunks[-1]["end"]
epoch = 0.0
visitor = None
station_pieces = []
for event in [*events, None]:
    until = event["t"] if event else end
    if until > end:
        break
    if until > epoch:
        dry = 4 + (1.05 + visitor if visitor is not None else 0)
        pieces = integrate(
            y,
            epoch,
            until,
            arcs,
            data["definition"]["world"]["scenario"]["bodies"],
            relay["engine"],
            dry=dry,
        )
        y = at(pieces, until).copy()
        station_pieces.extend(pieces)
        epoch = until
    if event is None:
        break
    if event["kind"] == "dock":
        assert visitor is None
        visitor = event["propellantAfter"]
    elif event["kind"] == "transfer":
        amount = event["propellantBefore"] - event["propellantAfter"]
        assert visitor is not None
        visitor -= amount
        y[6] += amount
    else:
        assert visitor is not None
        visitor = None
station_errors = np.zeros(3)
for chunk in chunks:
    for sample in chunk["station"]:
        # Fuel jumps have explicit sides. Validate interval interiors here.
        if any(abs(sample["t"] - e["t"]) < 1e-10 for e in events):
            continue
        truth = at(station_pieces, sample["t"])
        delta = np.array(sample["y"]) - truth[:6]
        station_errors = np.maximum(
            station_errors,
            [
                np.linalg.norm(delta[:3]),
                np.linalg.norm(delta[3:]),
                abs(truth[6] - sample["propellant"]),
            ],
        )
assert max(station_errors[:2]) < 1e-7 and station_errors[2] < 1e-10
report = dict(
    station=dict(
        end=end, position=station_errors[0], velocity=station_errors[1], fuel=station_errors[2]
    ),
    surface=surface,
    orbital=orbital,
    omittedAccelerationBound=0.004 / (6 - 2) ** 2,
)
(ROOT / "docs/evidence/surface-flexible-oracle.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
