"""Independent DOP853 replay of all lunar courier burns in the actual global field."""

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from scipy.integrate import solve_ivp

report = json.loads(Path("docs/evidence/libration.json").read_text())
definition = report["definition"]
d = definition["courier"]
s = definition["source"]["source"]["source"]["scenario"]
moon = s["bodies"][1]
rail = moon["rail"]
n = rail["rate"]
phi = rail["phase"]
mu0 = s["bodies"][0]["mu"]


def rotate(v, a):
    c, sn = math.cos(a), math.sin(a)
    return np.array([c * v[0] - sn * v[1], sn * v[0] + c * v[1], v[2]])


def provider(port, t):
    r = port["rail"]
    angle = r["phase"] + r["rate"] * t
    radius = r["radius"] + (rail["radius"] if r["kind"] == "surface" else 0.0)
    return np.array(
        [
            radius * math.cos(angle),
            radius * math.sin(angle),
            0.0,
            -radius * n * math.sin(angle),
            radius * n * math.cos(angle),
            0.0,
        ]
    )


def direction(arc, t):
    keys = arc["steering"]["keys"]
    elapsed = t - arc["start"]
    i = next((i for i in range(1, len(keys)) if keys[i]["offset"] >= elapsed), len(keys) - 1)
    a, b = keys[i - 1], keys[i]
    u = max(0.0, min(1.0, (elapsed - a["offset"]) / (b["offset"] - a["offset"])))
    u = u * u * (3 - 2 * u)
    p, q = np.array(a["direction"]), np.array(b["direction"])
    angle = math.acos(max(-1.0, min(1.0, float(p @ q))))
    result = (
        (1 - u) * p + u * q
        if angle < 1e-8
        else (math.sin((1 - u) * angle) * p + math.sin(u * angle) * q) / math.sin(angle)
    )
    return result / np.linalg.norm(result)


results = []
for witness in report["witnesses"]:
    cycle = witness["cycle"]
    offset = cycle * d["period"]
    angle = n * offset
    arcs = json.loads(json.dumps(d["arcs"]))
    for arc in arcs:
        arc["start"] += offset
        arc["end"] += offset
        arc["direction"] = rotate(arc["direction"], angle).tolist()
        for key in arc["steering"]["keys"]:
            key["direction"] = rotate(key["direction"], angle).tolist()
    legs: list[dict[str, Any]] = []
    fuel = d["ship"]["propellant"]
    captures = []
    min_clearance = math.inf
    for start, end, source, target, cargo, controls in [
        (
            offset + d["launch"],
            offset + d["arrival"],
            d["pad"],
            definition["station"],
            0.15,
            arcs[:2],
        ),
        (
            offset + d["departure"],
            offset + d["landing"],
            definition["station"],
            d["pad"],
            0.0,
            arcs[2:],
        ),
    ]:
        y = np.r_[provider(source, start), fuel]
        cuts = sorted(
            {
                start,
                end,
                *[arc["start"] + k["offset"] for arc in controls for k in arc["steering"]["keys"]],
            }
        )
        segments = []
        for lo, hi in zip(cuts[:-1], cuts[1:]):
            mid = (lo + hi) / 2
            active = next((a for a in controls if a["start"] < mid < a["end"]), None)

            def rhs(t, z, active=active, cargo=cargo):
                lunar_phase = phi + n * t
                lunar_position = rail["radius"] * np.array(
                    [math.cos(lunar_phase), math.sin(lunar_phase), 0.0]
                )
                delta = lunar_position - z[:3]
                gravity = (
                    -mu0 * z[:3] / np.linalg.norm(z[:3]) ** 3
                    + moon["mu"] * delta / np.linalg.norm(delta) ** 3
                )
                mass = d["ship"]["dryMass"] + cargo + z[6]
                force = min(16.0, 1.2 * mass) if active else 0.0
                if active:
                    gravity += force / mass * direction(active, t)
                return np.r_[z[3:6], gravity, -force / d["ship"]["exhaustVelocity"]]

            sol = solve_ivp(
                rhs,
                (lo, hi),
                y,
                method="DOP853",
                rtol=2e-13,
                atol=2e-14,
                max_step=0.015,
                dense_output=True,
            )
            assert sol.success
            y = sol.y[:, -1]
            segments.append(sol)
            epochs = np.linspace(lo, hi, 1001)
            positions = sol.sol(epochs)[:3]
            centers = rail["radius"] * np.array(
                [np.cos(phi + n * epochs), np.sin(phi + n * epochs), np.zeros(len(epochs))]
            )
            lunar_clearance = np.linalg.norm(positions - centers, axis=0) - moon["radius"]
            planetary_clearance = np.linalg.norm(positions, axis=0) - 1.2
            min_clearance = min(
                min_clearance, float(min(lunar_clearance)), float(min(planetary_clearance))
            )
        residual = y[:6] - provider(target, end)
        speed = float(np.linalg.norm(residual[3:]))
        paid = (1 + cargo + y[6]) * -math.expm1(-speed / 4)
        fuel = y[6] - paid
        captures.append(
            dict(position=float(np.linalg.norm(residual[:3])), velocity=speed, fuelPaid=paid)
        )
        legs.append(dict(start=start, end=end, segments=segments, before=y.copy(), fuelAfter=fuel))
    errors = []
    fuel_errors = []
    for q in witness["samples"]:
        t = q["t"]
        local = t - offset
        if local < d["launch"]:
            expected = provider(d["pad"], t)
            expected_fuel = 6.0
        elif local < d["arrival"]:
            leg = legs[0]
            segment = next(x for x in leg["segments"] if x.t[0] <= t <= x.t[-1])
            z = segment.sol(t)
            expected, expected_fuel = z[:6], z[6]
        elif local < d["departure"]:
            expected = provider(definition["station"], t)
            expected_fuel = legs[0]["fuelAfter"]
        elif local < d["landing"]:
            leg = legs[1]
            segment = next(x for x in leg["segments"] if x.t[0] <= t <= x.t[-1])
            z = segment.sol(t)
            expected, expected_fuel = z[:6], z[6]
        else:
            expected = provider(d["pad"], t)
            expected_fuel = legs[1]["fuelAfter"] if local < d["refill"] else 6.0
        errors.append(float(np.max(np.abs(expected - q["y"]))))
        fuel_errors.append(abs(float(expected_fuel) - q["propellant"]))
    for leg, q in zip(legs, witness["left"]):
        errors.append(float(np.max(np.abs(leg["before"][:6] - q["y"]))))
        fuel_errors.append(abs(float(leg["before"][6]) - q["propellant"]))
    result: dict[str, Any] = dict(
        cycle=cycle,
        maxStateError=max(errors),
        maxFuelError=max(fuel_errors),
        minimumClearance=min_clearance,
        captures=captures,
    )
    results.append(result)
    assert result["maxStateError"] < 2e-7, result
    assert result["maxFuelError"] < 2e-7, result
    assert min_clearance > 0, result
    assert max(c["position"] for c in captures) < 2e-7
    assert max(c["velocity"] for c in captures) < 2e-7
station_checks = []
for epoch in [0, 9000 * 32]:

    def passive_rhs(t, y):
        phase = phi + n * t
        center = rail["radius"] * np.array([math.cos(phase), math.sin(phase), 0.0])
        delta = center - y[:3]
        gravity = -mu0 * y[:3] / np.linalg.norm(y[:3]) ** 3
        gravity += moon["mu"] * delta / np.linalg.norm(delta) ** 3
        return np.r_[y[3:], gravity]

    sol = solve_ivp(
        passive_rhs,
        (epoch, epoch + 8),
        provider(definition["station"], epoch),
        method="DOP853",
        rtol=2e-13,
        atol=2e-14,
        max_step=0.02,
        dense_output=True,
    )
    assert sol.success
    error = max(
        float(np.max(np.abs(sol.sol(t) - provider(definition["station"], t))))
        for t in np.linspace(epoch, epoch + 8, 257)
    )
    assert error < 1e-8
    station_checks.append(dict(epoch=epoch, maxStateError=error))
Path("docs/evidence/libration-station-oracle.json").write_text(
    json.dumps(station_checks, indent=2) + "\n"
)
Path("docs/evidence/libration-oracle.json").write_text(json.dumps(results, indent=2) + "\n")
print(json.dumps(results, indent=2))
