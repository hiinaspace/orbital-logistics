"""Freeze the offline witness; target phases are authored once, never moved at runtime."""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
w = json.loads((ROOT / "docs/design/staging/witness.json").read_text())
a = math.pi / 2
split = w["split"]
upper = w["upper"]
recovery = w["recovery"]


def arc(id, start, end, headings, throttle=1):
    duration = end - start
    directions = [[math.cos(h + a), math.sin(h + a), 0] for h in headings]
    return dict(
        id=id,
        start=start,
        end=end,
        direction=directions[0],
        throttle=throttle,
        steering={
            "kind": "spherical-smoothstep-v1",
            "keys": [
                {
                    "offset": duration * i / (len(headings) - 1)
                    if i < len(headings) - 1
                    else duration,
                    "direction": d,
                }
                for i, d in enumerate(directions)
            ],
        },
    )


def program(id, arcs, operations):
    return dict(schemaVersion=4, id=id, burns=[], thrustArcs=arcs, operations=operations)


rate = math.sqrt(1 / 1.25**3)
pad = {
    "id": "Cairn",
    "rail": {
        "kind": "surface",
        "bodyId": "Selene",
        "centerHeight": 1e-6,
        "center": [0, 0, 0],
        "u": [1, 0, 0],
        "v": [0, 1, 0],
        "radius": 1.000001,
        "rate": 0.003,
        "phase": a,
    },
    "cargo": 0.2,
    "cargoCapacity": 1,
    "propellant": 1,
    "tankCapacity": 2,
    "serviceDuration": 0.3,
}
depot = {
    "id": "Lantern",
    "rail": {
        "kind": "circular",
        "center": [0, 0, 0],
        "u": [1, 0, 0],
        "v": [0, 1, 0],
        "radius": 1.25,
        "rate": rate,
        "phase": math.atan2(upper["state"][1], upper["state"][0]) + a - rate * upper["arrival"],
    },
    "cargo": 0,
    "cargoCapacity": 1,
    "propellant": 1,
    "tankCapacity": 2,
    "serviceDuration": 0.3,
}
d = {
    "schemaVersion": 1,
    "modelVersion": "staged-flight-v1",
    "id": "selene-staging",
    "name": "Selene · Launch & recovery",
    "extent": 1.55,
    "description": "Kestrel launches Wren to Lantern and returns to Cairn.",
    "provenance": (
        "Fictional airless world. Smooth bounded thrust; conserved zero-kick separation. "
        "Offline authored finite mission, unchanged gravity and paid captures. "
        "Point spacecraft without hull or atmospheric simulation."
    ),
    "stations": [
        {"id": "Cairn", "role": "Launch & recovery terminal", "berths": 1},
        {"id": "Lantern", "role": "Orbital freight depot", "berths": 1},
    ],
    "rotating": {"name": "Surface rotating", "rate": 0.003, "phase": 0},
    "world": {
        "schemaVersion": 3,
        "modelVersion": "rk4-canonical-v3",
        "id": "selene-staging",
        "units": {"length": "Selene radius", "time": "√(R³/μ)", "mass": "mass unit"},
        "epoch": 0,
        "duration": 4,
        "policy": {"step": 1 / 2048, "maxNodes": 65536, "maxSubdivision": 20},
        "bodies": [
            {"id": "Selene", "mu": 1, "radius": 1, "rail": {"kind": "fixed", "position": [0, 0, 0]}}
        ],
        "logistics": {
            "modelVersion": "surface-ports-v3",
            "ports": [pad, depot],
            "cargoCapacity": 0.1,
            "capture": {"position": 1e-7, "velocity": 1e-7},
            "objective": {
                "destinationId": "Lantern",
                "quota": 0.1,
                "returnPortId": "Cairn",
                "minPropellant": 0,
                "hardwareCost": 1,
            },
        },
    },
    "separation": {"id": "stage-separation", "t": split},
    "booster": {
        "id": "kestrel",
        "name": "Kestrel",
        "color": "#f2bd72",
        "dryMass": 0.3,
        "propellant": 1.55,
        "tankCapacity": 1.7,
        "exhaustVelocity": 3,
        "engine": {"maxThrust": 5, "maxAcceleration": 3},
    },
    "payload": {
        "id": "wren",
        "name": "Wren",
        "color": "#85c9c0",
        "dryMass": 0.25,
        "cargoMass": 0.1,
        "propellant": 0.3,
        "tankCapacity": 0.35,
        "exhaustVelocity": 3,
        "engine": {"maxThrust": 1.8, "maxAcceleration": 3},
    },
    "stack": {"id": "kestrel-stack", "name": "Kestrel + Wren", "color": "#f2bd72"},
    "programs": {},
}
d["programs"]["stack"] = program(
    "stack-ascent-v1",
    [arc("boost", 0.3, split, w["lowerKeys"])],
    [
        {"id": "on-pad", "kind": "dock", "t": 0, "portId": "Cairn"},
        {"id": "lift-off", "kind": "launch", "t": 0.3, "portId": "Cairn", "thrustArcId": "boost"},
    ],
)
d["programs"]["payload"] = program(
    "wren-insertion-v1",
    [arc("insertion", split, split + upper["burn"], upper["keys"])],
    [
        {"id": "delivery-arrival", "kind": "dock", "t": upper["arrival"], "portId": "Lantern"},
        {
            "id": "unload",
            "kind": "transfer",
            "t": upper["arrival"],
            "portId": "Lantern",
            "cargo": -0.1,
            "propellant": 0,
        },
    ],
)
d["programs"]["booster"] = program(
    "kestrel-recovery-v1",
    [
        arc(
            "recovery",
            split + recovery["coast"],
            recovery["landing"],
            [h + recovery["phase"] for h in reversed(recovery["reverseKeys"])],
            0.6,
        )
    ],
    [{"id": "touchdown", "kind": "land", "t": recovery["landing"], "portId": "Cairn"}],
)
(ROOT / "fixtures/model-sets/selene-staging.json").write_text(json.dumps(d, indent=2) + "\n")
