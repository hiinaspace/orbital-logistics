"""Independent seven-state DOP853 ephemerides for finite trajectory-backed ports."""

from math import cos, sin
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp
from steering_law import direction_at


def body_position(body, t):
    r = body["rail"]
    if r["kind"] == "fixed":
        return np.array(r["position"])
    a = r["phase"] + r["rate"] * t
    return np.array(r["center"]) + r["radius"] * (
        np.array(r["u"]) * cos(a) + np.array(r["v"]) * sin(a)
    )


def integrate_target(s, rail, tight=True):
    powered = rail["kind"] == "powered"
    ship: dict[str, Any] = (
        rail["propulsion"] if powered else dict(dryMass=1.0, propellant=0.0, exhaustVelocity=1.0)
    )
    arcs = rail["program"]["thrustArcs"] if powered else []
    knots = sorted(
        set(
            [rail["epoch"], rail["validUntil"]]
            + [
                t
                for a in arcs
                for t in [a["start"], a["end"]]
                + [a["start"] + k["offset"] for k in a.get("steering", {}).get("keys", [])]
            ]
        )
    )
    y = np.r_[rail["state"], ship["propellant"]]
    pieces = []
    for lo, hi in zip(knots, knots[1:]):
        arc = next((a for a in arcs if a["start"] <= lo < a["end"]), None)

        def rhs(t, y):
            g = np.zeros(3)
            for body in s["bodies"]:
                delta = body_position(body, t) - y[:3]
                r = np.linalg.norm(delta)
                assert r > body["radius"] + rail["minClearance"]
                g += body["mu"] * delta / r**3
            mass = ship["dryMass"] + y[6]
            f = (
                0
                if arc is None
                else min(
                    ship["engine"]["maxThrust"] * arc["throttle"],
                    ship["engine"].get("maxAcceleration", float("inf")) * mass,
                )
            )
            return np.r_[
                y[3:6],
                g if arc is None else g + f / mass * direction_at(arc, t),
                -f / ship["exhaustVelocity"],
            ]

        result = solve_ivp(
            rhs,
            (lo, hi),
            y,
            method="DOP853",
            dense_output=True,
            rtol=2.3e-14 if tight else 2e-12,
            atol=2e-15 if tight else 2e-14,
        )
        assert result.success and result.y[6, -1] >= 0
        pieces.append((lo, hi, result.sol))
        y = result.y[:, -1]
    if powered:
        assert y[6] >= rail["minPropellant"]
    return pieces


def target_at(pieces, t):
    assert pieces[0][0] <= t <= pieces[-1][1]
    return next(sol(t) for lo, hi, sol in reversed(pieces) if lo <= t <= hi)
