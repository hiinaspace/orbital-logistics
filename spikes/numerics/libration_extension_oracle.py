"""Independent seven-state replay of frozen controls, including unsnapped stage handoffs."""

import json
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / "docs/evidence/libration-extension-oracle-input.json").read_text())


def body_position(body, t):
    rail = body["rail"]
    angle = rail["phase"] + rail["rate"] * t
    return np.array(rail["center"]) + rail["radius"] * (
        np.array(rail.get("u", [1, 0, 0])) * np.cos(angle)
        + np.array(rail.get("v", [0, 1, 0])) * np.sin(angle)
    )


def replay(record, initial=None):
    s = record["bundle"]["scenario"]
    ship = s["ship"]
    arcs = record["bundle"]["program"].get("thrustArcs", [])
    start, end = s["epoch"], s["epoch"] + s["duration"]
    state = np.r_[ship["state"], ship["propellant"]] if initial is None else initial.copy()
    cuts = sorted(
        {
            start,
            end,
            *(a[k] for a in arcs for k in ["start", "end"]),
            *(
                a["start"] + key["offset"]
                for a in arcs
                for key in a.get("steering", {}).get("keys", [])
            ),
        }
    )
    pieces = []
    for lo, hi in zip(cuts[:-1], cuts[1:], strict=True):
        arc = next((a for a in arcs if a["start"] <= lo < a["end"]), None)
        held = start == 0 and hi <= 0.5
        if held:

            def pose(t, state=state):
                owner = s["bodies"][1]
                rail = s["logistics"]["ports"][0]["rail"]
                angle = rail["phase"] + rail["rate"] * t
                planet_angle = owner["rail"]["phase"] + owner["rail"]["rate"] * t
                p = body_position(owner, t)
                pv = (
                    owner["rail"]["radius"]
                    * owner["rail"]["rate"]
                    * np.array([-np.sin(planet_angle), np.cos(planet_angle), 0])
                )
                r = rail["radius"]
                return np.r_[
                    p + r * np.array([np.cos(angle), np.sin(angle), 0]),
                    pv + r * rail["rate"] * np.array([-np.sin(angle), np.cos(angle), 0]),
                    state[6],
                ]

            pieces.append((lo, hi, pose))
            state = pose(hi)
            continue

        def derivative(t, y):
            acc = np.zeros(3)
            for body in s["bodies"]:
                delta = body_position(body, t) - y[:3]
                acc += body["mu"] * delta / np.linalg.norm(delta) ** 3
            mass = ship["dryMass"] + ship["cargoMass"] + y[6]
            force = (
                0
                if arc is None
                else min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"].get("maxAcceleration", np.inf) * mass,
                )
            )
            if arc is not None:
                acc += force / mass * direction_at(arc, t)
            return np.r_[y[3:6], acc, -force / ship["exhaustVelocity"]]

        result = solve_ivp(
            derivative,
            [lo, hi],
            state,
            method="DOP853",
            rtol=2e-13,
            atol=2e-14,
            max_step=0.01,
            dense_output=True,
        )
        assert result.success
        pieces.append((lo, hi, result.sol))
        state = result.y[:, -1]
    position = velocity = fuel = 0.0
    for sample in record["samples"]:
        sol = next(fn for lo, hi, fn in reversed(pieces) if lo - 1e-12 <= sample["t"] <= hi + 1e-12)
        y = sol(sample["t"])
        position = max(position, float(np.linalg.norm(y[:3] - sample["y"][:3])))
        velocity = max(velocity, float(np.linalg.norm(y[3:6] - sample["y"][3:])))
        fuel = max(fuel, abs(float(y[6]) - sample["propellant"]))
    assert max(position, velocity) < 3e-6 and fuel < 1e-8, (position, velocity, fuel)
    return state, dict(position=position, velocity=velocity, fuel=fuel)


parent, check = replay(data["mission"][0])
checks = [check]
lower, check = replay(data["mission"][1], parent)
checks.append(check)
upper = np.r_[parent[:6], 0.4]
for record in data["mission"][2:]:
    upper, check = replay(record, upper)
    checks.append(check)
survey_checks = [replay(record)[1] for record in data["survey"]]
report = dict(
    mission=checks,
    missionBudget=data["missionBudget"],
    surveyFrozenControls=survey_checks,
    independentUpperFinal=upper.tolist(),
    independentBoosterFinal=lower.tolist(),
    continuousRollout=data["rollout"],
)
(ROOT / "docs/evidence/libration-extension-oracle.json").write_text(
    json.dumps(report, indent=2) + "\n"
)
print(json.dumps(report, indent=2))
