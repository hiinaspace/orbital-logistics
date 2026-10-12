"""Fresh two-circuit coupled oracle for the finite pass-through service.

Frozen commands are seeds; physical carrier and shuttle states continue at actual
absolute epochs. No phase modulo or periodic state/resource reset is used.
"""

from __future__ import annotations

import json
from pathlib import Path

import compact_cycler as m
import numpy as np
from scipy.interpolate import CubicSpline
from scipy.optimize import minimize_scalar

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "docs/design/compact-cycler/redesign"
OUT = ROOT / "fixtures/model-sets/pass-through-profile.json"


def main():
    frozen = json.loads((HERE / "controls.json").read_text())
    period = frozen["period"]
    duration = 2 * period
    phases = frozen["padPhases"]
    initial = np.array(frozen["carrierInitial"])[[0, 1, 3, 4]]
    carrier = m.forward(0, duration, initial)
    base = frozen["segments"]
    if len(base) != 19 or period != 120.50467632722804:
        raise ValueError("Frozen pass-through identity/choreography")
    landing = base[-1]["end"]
    routes = [base[:5], base[5:10], base[10:14], base[14:]]
    expected = [(1.0, 56.0), (66.0, 73.5), (74.5, 79.5), (83.5, landing)]
    if [(r[0]["start"], r[-1]["end"]) for r in routes] != expected:
        raise ValueError("Frozen routes")

    def port(id, t):
        r = 1.00001 if id == "Cairn" else 0.20001
        local = m.rotate([r, 0, 0, m.RATE * r], m.RATE * t + phases[id])
        return local + (m.circular(t, 5) if id == "Haven" else 0)

    def convert(id, a, b, q, initial, control=None):
        return dict(
            id=id,
            start=a,
            end=b,
            initial=m.state6(initial),
            endpoint=m.state6(q.y[:4, -1]),
            oracle=m.oracle(dict(t0=a, t1=b, result=q)),
            **({"control": control} if control is not None else {}),
        )

    carrier_parts = []
    cuts = sorted(
        set(
            [
                0,
                duration,
                *np.arange(64, duration, 64),
                *[cycle * period + t for cycle in range(2) for t in [56, 66, 79.5, 83.5]],
            ]
        )
    )
    actual = initial.copy()
    for a, b in zip(cuts[:-1], cuts[1:]):
        q = m.forward(a, b, actual)
        carrier_parts.append(convert("Wayfarer coast", float(a), float(b), q, actual))
        actual = q.y[:4, -1]
    # The uninterrupted independent provider is used for all physical rendezvous.
    missions = []
    halves = []
    capsules = []
    total_fuel = 0.0
    for cycle in range(2):
        offset = cycle * period
        angle = m.RATE * offset
        stages = []
        fuel = 3.0
        half_dv = 0.0
        for index, route in enumerate(routes):
            start = offset + route[0]["start"]
            end = offset + route[-1]["end"]
            origin = "Cairn" if index == 0 else "Haven" if index == 2 else None
            destination = "Haven" if index == 1 else "Cairn" if index == 3 else None
            actual = port(origin, start) if origin else carrier.sol(start)[:4]
            parts = []
            for s in route:
                a, b = offset + s["start"], offset + s["end"]
                control = None
                spline = None
                if "control" in s:
                    c = s["control"]
                    keys = [
                        [offset + k[0], *m.rotate([k[1], k[2], 0, 0], angle)[:2], 0.0]
                        for k in c["keys"]
                    ]
                    coef = np.array(c["coefficients"])
                    C, S = np.cos(angle), np.sin(angle)
                    rotated = coef.copy()
                    rotated[:, :, 0] = C * coef[:, :, 0] - S * coef[:, :, 1]
                    rotated[:, :, 1] = S * coef[:, :, 0] + C * coef[:, :, 1]
                    control = dict(
                        id=s["id"], start=a, end=b, keys=keys, coefficients=rotated.tolist()
                    )
                    spline = CubicSpline.construct_fast(
                        rotated[:, :, :2].transpose(1, 0, 2), np.array(keys)[:, 0]
                    )
                q = m.forward(a, b, actual, spline)
                parts.append(convert(s["id"], a, b, q, actual, control))
                half_dv += float(q.y[4, -1])
                before = fuel
                fuel = (1.15 + fuel) * np.exp(-q.y[4, -1] / 4) - 1.15
                total_fuel += before - fuel
                actual = q.y[:4, -1]
            target = port(destination, end) if destination else carrier.sol(end)[:4]
            cap = m.capture(actual, target)
            capsules.append(dict(t=end, **cap))
            before = fuel
            fuel = (1.15 + fuel) * np.exp(-cap["paidDeltaV"] / 4) - 1.15
            total_fuel += before - fuel
            half_dv += cap["paidDeltaV"]
            if destination:
                if fuel < 0.3:
                    raise RuntimeError(f"Reserve {cycle=} {destination=} {fuel=} {half_dv=}")
                halves.append(dict(cycle=cycle, port=destination, deltaV=half_dv, fuel=fuel))
                half_dv = 0.0
                fuel = 3.0
            stages.append(dict(origin=origin, destination=destination, segments=parts))
        missions.append(
            dict(
                funding={id: dict(fuelCap=2.8, cargo=0.15) for id in ["Cairn", "Haven"]},
                stages=stages,
                moonUnload=offset + 73.75,
                moonRefill=offset + 74.0,
                asterUnload=offset + landing + 0.25,
                asterRefill=offset + landing + 0.5,
            )
        )

    encounters = []
    for cycle in range(2):
        offset = cycle * period
        for body, interval in [
            ("Aster", (5, 15)),
            ("Aster", (51, 62)),
            ("Selene", (65, 75)),
            ("Aster", (79, 90)),
        ]:

            def distance(t):
                y = carrier.sol(t)[:2]
                if body == "Selene":
                    y = y - m.circular(t, 5)[:2]
                return np.linalg.norm(y)

            z = minimize_scalar(
                distance,
                bounds=(offset + interval[0], offset + interval[1]),
                method="bounded",
                options={"xatol": 1e-11, "maxiter": 80},
            )
            encounters.append(dict(t=float(z.x), body=body, distance=float(z.fun)))
    profile = dict(
        schemaVersion=1,
        modelVersion="pass-through-profile-v1",
        period=period,
        duration=duration,
        rate=m.RATE,
        step=1 / 512,
        height=1e-5,
        exhaustVelocity=4.0,
        padPhases=phases,
        carrier=dict(
            id="Wayfarer",
            name="Wayfarer",
            color="#efc689",
            dryMass=4.0,
            fuel=6.0,
            cargo=0.0,
            maxAcceleration=0.0,
            maxForce=0.0,
        ),
        shuttle=dict(
            id="Pipit",
            name="Pipit",
            color="#84cbd4",
            dryMass=1.0,
            fuel=3.0,
            cargo=0.15,
            maxAcceleration=4.0,
            maxForce=16.6,
        ),
        carrierSegments=carrier_parts,
        missions=missions,
        encounters=encounters,
        proof=dict(halves=halves, captures=capsules, shuttleFuel=total_fuel, carrierDeltaV=0.0),
    )
    temporary = OUT.with_suffix(".json.next")
    temporary.write_text(json.dumps(profile, separators=(",", ":")) + "\n")
    temporary.replace(OUT)
    print("PROFILE", OUT.stat().st_size, profile["proof"], flush=True)


if __name__ == "__main__":
    main()
