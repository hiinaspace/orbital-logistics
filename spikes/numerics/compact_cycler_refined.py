"""Independent full coupled replay of frozen local-connection cycler controls."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import compact_cycler as m
import numpy as np
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parents[2]


def compile_profile():
    v = json.loads(
        (ROOT / "docs/design/compact-cycler/refinement/refined-controls.json").read_text()
    )
    phases = v["padPhases"]
    groups = v["groups"]
    period = v["period"]
    if v["schemaVersion"] != 2 or period != 74 or phases != {"Cairn": 1.2, "Haven": 0.0}:
        raise ValueError("Frozen refinement identity")
    ve = v["exhaustVelocity"]
    if (
        ve != 4
        or len(groups) != 7
        or [(g[0]["start"], g[-1]["end"]) for g in groups]
        != [(1, 5), (5, 69), (69, 73), (6, 9), (16, 19.5), (21.5, 25), (65, 69)]
    ):
        raise ValueError("Frozen refinement choreography")
    original = m.port

    def port(id, t):
        if id == "Cairn":
            return m.rotate([1.00001, 0, 0, m.RATE * 1.00001], m.RATE * t + phases[id])
        if id == "Haven":
            return m.circular(t, 5) + m.rotate(
                [0.20001, 0, 0, m.RATE * 0.20001], m.RATE * t + phases[id]
            )
        return original(id, t)

    segments = []
    routes = []
    traces: list[dict[str, Any]] = []

    def replay(group, initial):
        actual = initial.copy()
        ids = []
        dv = 0.0
        for s in group:
            c = s.get("control")
            spline = (
                None
                if c is None
                else CubicSpline.construct_fast(
                    np.array(c["coefficients"])[:, :, :2].transpose(1, 0, 2),
                    np.array(c["keys"])[:, 0],
                )
            )
            q = m.forward(s["start"], s["end"], actual, spline)
            traces.append(dict(start=s["start"], end=s["end"], result=q))
            ids.append(len(segments))
            segments.append(
                dict(
                    id=s["id"],
                    start=s["start"],
                    end=s["end"],
                    initial=m.state6(actual),
                    endpoint=m.state6(q.y[:4, -1]),
                    oracle=m.oracle(dict(t0=s["start"], t1=s["end"], result=q)),
                    **({"control": c} if c else {}),
                )
            )
            dv += q.y[4, -1]
            actual = q.y[:4, -1]
        routes.append(ids)
        return actual, float(dv)

    actual = port("Beacon", 1.0)
    carrier_dv = 0.0
    for g in groups[:3]:
        actual, dv = replay(g, actual)
        carrier_dv += dv
    cap = m.capture(actual, port("Beacon", period - 1))
    carrier_dv += cap["paidDeltaV"]
    carrier_fuel = 10 * np.exp(-carrier_dv / ve) - 4
    if carrier_fuel < 0.6:
        raise RuntimeError("Carrier reserve")
    carrier_traces = traces.copy()

    def carrier_at(t):
        return next(q for q in carrier_traces if q["start"] <= t <= q["end"])["result"].sol(t)[:4]

    halves = []
    cost = 0.0
    fuel = 3.0
    caps = [cap]
    for i, g in enumerate(groups[3:]):
        a, b = g[0]["start"], g[-1]["end"]
        origin = port("Haven", a) if i == 0 else port("Cairn", a) if i == 2 else carrier_at(a)
        target = port("Cairn", b) if i == 1 else port("Haven", b) if i == 3 else carrier_at(b)
        actual, dv = replay(g, origin)
        cap = m.capture(actual, target)
        caps.append(cap)
        cost += dv + cap["paidDeltaV"]
        fuel = 4.15 * np.exp(-cost / ve) - 1.15
        print(
            "leg",
            i,
            "dv",
            dv,
            "coast",
            sum(s["end"] - s["start"] for s in g if "control" not in s),
            flush=True,
        )
        if i in [1, 3]:
            if fuel < 0.3:
                raise RuntimeError("Shuttle reserve")
            halves.append(dict(deltaV=cost, fuel=fuel))
            cost = 0.0
            fuel = 3.0
    times = dict(
        carrierLaunch=1.0,
        coastStart=5.0,
        coastEnd=69.0,
        carrierDock=73.0,
        carrierRefill=73.5,
        moonLaunch=6.0,
        boardIn=9.0,
        releaseIn=16.0,
        asterLand=19.5,
        asterUnload=19.75,
        asterRefill=20.0,
        asterLaunch=21.5,
        boardOut=25.0,
        releaseOut=65.0,
        moonLand=69.0,
        moonUnload=69.25,
        moonRefill=69.5,
    )
    profile = dict(
        schemaVersion=1,
        modelVersion="compact-cycler-profile-v2",
        period=period,
        rate=m.RATE,
        step=1 / 512,
        height=1e-5,
        beaconRadius=m.BEACON,
        exhaustVelocity=ve,
        padPhases=phases,
        times=times,
        routes=routes,
        carrier=dict(
            id="Wayfarer",
            name="Wayfarer",
            color="#efc689",
            dryMass=4.0,
            fuel=6.0,
            cargo=0.0,
            maxAcceleration=0.6,
            maxForce=6.0,
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
        segments=segments,
        proof=dict(
            carrierFuel=carrier_fuel,
            halves=halves,
            captures=caps,
            carrierCoastFraction=64 / 74,
            shuttleCoast=7.5,
            shuttleFlight=14.0,
            ride=47.0,
        ),
    )
    m.OUT.write_text(json.dumps(profile, separators=(",", ":")) + "\n")
    print("profile", m.OUT.stat().st_size, profile["proof"], flush=True)


if __name__ == "__main__":
    compile_profile()
