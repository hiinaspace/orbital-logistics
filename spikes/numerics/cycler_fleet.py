"""Independent finite later-pass fleet admission; no periodic state resets."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import compact_cycler as m
import numpy as np
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "docs/design/cycler-fleet"
OUT = ROOT / "fixtures/model-sets/cycler-fleet-profile.json"


def main():
    old = json.loads((ROOT / "docs/design/compact-cycler/redesign/controls.json").read_text())
    lunar = json.loads((HERE / "lunar-return.json").read_text())
    T = old["period"]
    delta = T / 2
    duration = T + old["segments"][-1]["end"] + 0.75
    initial = np.array(old["carrierInitial"])[[0, 1, 3, 4]]
    seed = m.forward(0, T, initial)
    initial_b = m.rotate(seed.sol(delta)[:4], -m.RATE * delta)
    providers = [m.forward(0, duration, y) for y in [initial, initial_b]]
    phases = old["padPhases"]
    routes = [old["segments"][:5], old["segments"][5:10], lunar["segments"], old["segments"][14:]]
    halves, captures = [], []

    def port(id, t):
        r = 1.00001 if id == "Cairn" else 0.20001
        local = m.rotate([r, 0, 0, m.RATE * r], m.RATE * t + phases[id])
        return local + (m.circular(t, 5) if id == "Haven" else 0)

    def convert(id, a, b, q, initial, control=None):
        return dict(
            id=id,
            start=float(a),
            end=float(b),
            initial=m.state6(initial),
            endpoint=m.state6(q.y[:4, -1]),
            oracle=m.oracle(dict(t0=a, t1=b, result=q)),
            **({"control": control} if control else {}),
        )

    riders = []
    handoffs = [set([0.0, duration, *map(float, np.arange(64, duration, 64))]) for _ in range(2)]
    for rider, name in enumerate(["Pipit", "Wren"]):
        offset = rider * delta
        stages: list[dict[str, Any]] = []
        fuel = 3.0
        half = 0.0
        for index, route in enumerate(routes):
            shift = offset + (delta if index >= 2 else 0)
            parent = rider if index < 2 else 1 - rider
            origin = "Cairn" if index == 0 else "Haven" if index == 2 else None
            destination = "Haven" if index == 1 else "Cairn" if index == 3 else None
            start, end = shift + route[0]["start"], shift + route[-1]["end"]
            actual = port(origin, start) if origin else providers[parent].sol(start)[:4]
            if not origin:
                handoffs[parent].add(start)
            parts = []
            for s in route:
                a, b = shift + s["start"], shift + s["end"]
                spline, control = None, None
                if "control" in s:
                    c = s["control"]
                    angle = m.RATE * shift
                    keys = [
                        [shift + k[0], *m.rotate([k[1], k[2], 0, 0], angle)[:2], 0.0]
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
                dv = float(q.y[4, -1])
                fuel = (1.15 + fuel) * np.exp(-dv / 4) - 1.15
                half += dv
                actual = q.y[:4, -1]
            target = port(destination, end) if destination else providers[parent].sol(end)[:4]
            cap = m.capture(actual, target)
            captures.append(
                dict(actor=name, t=end, target=destination or ["Wayfarer", "Nomad"][parent], **cap)
            )
            fuel = (1.15 + fuel) * np.exp(-cap["paidDeltaV"] / 4) - 1.15
            half += cap["paidDeltaV"]
            if destination:
                if fuel < 0.3:
                    raise RuntimeError(f"Landing reserve {name} {destination} {fuel}")
                halves.append(dict(actor=name, port=destination, fuel=fuel, deltaV=half))
                fuel, half = 3.0, 0.0
            else:
                handoffs[parent].add(end)
            stages.append(dict(origin=origin, destination=destination, segments=parts))
        moonland = stages[1]["segments"][-1]["end"]
        asterland = stages[3]["segments"][-1]["end"]
        riders.append(
            dict(
                hardware=dict(
                    id=name,
                    name=name,
                    color=["#84cbd4", "#b2d593"][rider],
                    dryMass=1.0,
                    fuel=3.0,
                    cargo=0.15,
                    maxAcceleration=4.0,
                    maxForce=16.6,
                ),
                outbound=["Wayfarer", "Nomad"][rider],
                inbound=["Nomad", "Wayfarer"][rider],
                mission=dict(
                    stages=stages,
                    moonUnload=moonland + 0.25,
                    moonRefill=moonland + 0.5,
                    asterUnload=asterland + 0.25,
                    asterRefill=asterland + 0.5,
                    funding={id: dict(fuelCap=2.8, cargo=0.15) for id in ["Cairn", "Haven"]},
                ),
            )
        )
    carriers = []
    for actor, name in enumerate(["Wayfarer", "Nomad"]):
        parts = []
        actual = [initial, initial_b][actor].copy()
        cuts = sorted(handoffs[actor])
        for a, b in zip(cuts[:-1], cuts[1:]):
            q = m.forward(a, b, actual)
            parts.append(convert(name + " coast", a, b, q, actual))
            actual = q.y[:4, -1]
        carriers.append(
            dict(
                hardware=dict(
                    id=name,
                    name=name,
                    color=["#efc689", "#dba5c8"][actor],
                    dryMass=4.0,
                    fuel=6.0,
                    cargo=0.0,
                    maxAcceleration=0.0,
                    maxForce=0.0,
                ),
                segments=parts,
            )
        )
    profile = dict(
        schemaVersion=1,
        modelVersion="cycler-fleet-profile-v1",
        period=T,
        duration=duration,
        rate=m.RATE,
        step=1 / 512,
        height=1e-5,
        exhaustVelocity=4.0,
        padPhases=phases,
        carriers=carriers,
        riders=riders,
        proof=dict(
            halves=halves, captures=captures, phaseSpacing=delta, lunarReturnDeltaV=lunar["score"]
        ),
    )
    tmp = OUT.with_suffix(".json.next")
    tmp.write_text(json.dumps(profile, separators=(",", ":")) + "\n")
    tmp.replace(OUT)
    print("PROFILE", OUT.stat().st_size, profile["proof"], flush=True)


if __name__ == "__main__":
    main()
